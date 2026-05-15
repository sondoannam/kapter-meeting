import { Inject, Injectable } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import type { ConfigType } from "@nestjs/config";
import type { Prisma } from "prisma/generated/prisma/client";

import { PrismaService } from "src/database/prisma.service";
import { appConfig } from "src/config/app.config";
import { LlmService } from "../llm/llm.service";
import {
  applyTaskMutationsToDraft,
  parseMeetingArtifactDraftTasks,
  type MeetingArtifactDraftTask,
} from "./meeting-artifact-draft.utils";
import {
  MEETING_EXTRACTION_MAX_RETRIES,
  MEETING_EXTRACTION_OVERLAP_WINDOW_MS,
  MEETING_EXTRACTION_RETRY_BASE_DELAY_MS,
  MEETING_EXTRACTION_TARGET_WINDOW_MS,
} from "./meeting-artifact-extraction.constants";
import { planMeetingExtractionChunks } from "./meeting-extraction-chunk-planner";
import { MeetingArtifactExtractionTraceWriter } from "./meeting-artifact-extraction-trace.writer";
import { MeetingSpeakerPostProcessingService } from "./meeting-speaker-post-processing.service";

@Injectable()
export class MeetingArtifactExtractionService {
  private readonly processingMeetings = new Set<string>();
  private readonly pendingMeetings = new Set<string>();
  private readonly retryTimers = new Map<string, NodeJS.Timeout>();
  private readonly retryAvailableAt = new Map<string, number>();
  private readonly traceWriter: MeetingArtifactExtractionTraceWriter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    private readonly meetingSpeakerPostProcessing: MeetingSpeakerPostProcessingService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {
    this.traceWriter = new MeetingArtifactExtractionTraceWriter(
      {
        enabled: config.meetingExtraction.enableTraceDump,
        traceDir: config.meetingExtraction.traceDir,
      },
      logger,
    );
  }

  notifyTranscriptPersisted(meetingId: string): void {
    this.trace(meetingId, "transcript_batch_persisted");
    this.scheduleMeetingArtifactProcessing(meetingId);
  }

  notifyMeetingCaptureCompleted(meetingId: string): void {
    this.trace(meetingId, "meeting_capture_completed");
    this.scheduleMeetingArtifactProcessing(meetingId);
  }

  scheduleMeetingArtifactProcessing(meetingId: string): void {
    if (this.processingMeetings.has(meetingId)) {
      this.pendingMeetings.add(meetingId);
      return;
    }

    if (this.pendingMeetings.has(meetingId)) {
      return;
    }

    this.pendingMeetings.add(meetingId);

    setImmediate(() => {
      void this.runMeetingProcessingLoop(meetingId);
    });
  }

  async resetMeetingArtifacts(meetingId: string): Promise<void> {
    this.clearRetryState(meetingId);

    await this.prisma.$transaction(async (tx) => {
      await tx.actionItem.deleteMany({
        where: { meetingId },
      });

      await tx.meetingExtractionChunk.deleteMany({
        where: { meetingId },
      });

      await tx.meetingArtifactDraft.deleteMany({
        where: { meetingId },
      });

      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          summary: null,
          artifactReviewStatus: "PENDING",
          artifactExtractionError: null,
          artifactApprovedAt: null,
        },
      });
    });

    this.trace(meetingId, "artifacts_reset");
  }

  private async runMeetingProcessingLoop(meetingId: string): Promise<void> {
    if (this.processingMeetings.has(meetingId)) {
      return;
    }

    this.processingMeetings.add(meetingId);

    try {
      while (true) {
        this.pendingMeetings.delete(meetingId);

        const didWork = await this.processMeetingWork(meetingId);

        if (this.pendingMeetings.has(meetingId)) {
          continue;
        }

        if (!didWork) {
          break;
        }
      }
    } finally {
      this.processingMeetings.delete(meetingId);

      if (
        this.pendingMeetings.has(meetingId) &&
        !this.isRetryBackoffActive(meetingId)
      ) {
        setImmediate(() => {
          void this.runMeetingProcessingLoop(meetingId);
        });
      }
    }
  }

  private async processMeetingWork(meetingId: string): Promise<boolean> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        status: true,
        artifactReviewStatus: true,
        speakerPostProcessStatus: true,
      },
    });

    if (!meeting) {
      this.clearRetryState(meetingId);
      return false;
    }

    if (meeting.status === "FAILED" || meeting.artifactReviewStatus === "APPROVED") {
      return false;
    }

    if (
      meeting.status === "COMPLETED" &&
      meeting.speakerPostProcessStatus !== "COMPLETED"
    ) {
      let postProcessingResult = null;

      try {
        postProcessingResult =
          await this.meetingSpeakerPostProcessing.runForCompletedMeeting(
            meeting.id,
          );
      } catch (error) {
        this.logger.error("Meeting speaker post-processing failed", {
          meetingId: meeting.id,
          error: error instanceof Error ? error.message : String(error),
        });

        return false;
      }

      if (postProcessingResult?.materialChanges) {
        await this.resetMeetingArtifacts(meeting.id);
        return true;
      }
    }

    if (
      meeting.artifactReviewStatus === "READY" ||
      meeting.artifactReviewStatus === "FAILED"
    ) {
      return false;
    }

    const plannedChunks = await this.planExtractionChunks(
      meeting.id,
      meeting.status === "COMPLETED",
    );

    const processedChunk = await this.processNextPendingChunk(meeting.id);
    const finalizedMeeting = await this.finalizeMeetingArtifactsIfReady(
      meeting.id,
    );

    return plannedChunks || processedChunk || finalizedMeeting;
  }

  private async planExtractionChunks(
    meetingId: string,
    captureCompleted: boolean,
  ): Promise<boolean> {
    const [latestTranscriptSegment, latestChunk] = await Promise.all([
      this.prisma.transcriptSegment.findFirst({
        where: {
          meetingId,
          isSuppressed: false,
        },
        orderBy: {
          endTime: "desc",
        },
        select: {
          endTime: true,
        },
      }),
      this.prisma.meetingExtractionChunk.findFirst({
        where: { meetingId },
        orderBy: {
          chunkIndex: "desc",
        },
        select: {
          chunkIndex: true,
        },
      }),
    ]);

    const maxTranscriptEndMs = latestTranscriptSegment
      ? Math.ceil(latestTranscriptSegment.endTime * 1000)
      : 0;

    if (maxTranscriptEndMs <= 0) {
      if (captureCompleted) {
        await this.markMeetingArtifactFailed(
          meetingId,
          "Meeting transcript is empty, so extraction could not start.",
        );
        return true;
      }

      return false;
    }

    const plannedChunks = planMeetingExtractionChunks({
      existingChunkCount: latestChunk ? latestChunk.chunkIndex + 1 : 0,
      maxTranscriptEndMs,
      captureCompleted,
      targetWindowMs: MEETING_EXTRACTION_TARGET_WINDOW_MS,
      overlapWindowMs: MEETING_EXTRACTION_OVERLAP_WINDOW_MS,
    });

    if (plannedChunks.length === 0) {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingArtifactDraft.upsert({
        where: {
          meetingId,
        },
        create: {
          meetingId,
          rollingTasksJson: [],
        },
        update: {},
      });

      for (const plannedChunk of plannedChunks) {
        await tx.meetingExtractionChunk.upsert({
          where: {
            meetingId_chunkIndex: {
              meetingId,
              chunkIndex: plannedChunk.chunkIndex,
            },
          },
          create: {
            meetingId,
            chunkIndex: plannedChunk.chunkIndex,
            newContentStartMs: plannedChunk.newContentStartMs,
            promptStartMs: plannedChunk.promptStartMs,
            promptEndMs: plannedChunk.promptEndMs,
          },
          update: {},
        });
      }
    });

    this.trace(meetingId, "chunks_planned", {
      captureCompleted,
      maxTranscriptEndMs,
      plannedChunkCount: plannedChunks.length,
      plannedChunks,
    });

    return true;
  }

  private async processNextPendingChunk(meetingId: string): Promise<boolean> {
    if (this.isRetryBackoffActive(meetingId)) {
      return false;
    }

    const draft = await this.prisma.meetingArtifactDraft.findUnique({
      where: { meetingId },
      select: {
        rollingTasksJson: true,
        lastCompletedChunkIndex: true,
      },
    });

    if (!draft) {
      return false;
    }

    const nextChunkIndex = draft.lastCompletedChunkIndex + 1;
    const nextChunk = await this.prisma.meetingExtractionChunk.findUnique({
      where: {
        meetingId_chunkIndex: {
          meetingId,
          chunkIndex: nextChunkIndex,
        },
      },
      select: {
        id: true,
        meetingId: true,
        chunkIndex: true,
        newContentStartMs: true,
        promptStartMs: true,
        promptEndMs: true,
        retryCount: true,
        status: true,
      },
    });

    if (!nextChunk || nextChunk.status !== "PENDING") {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingExtractionChunk.update({
        where: { id: nextChunk.id },
        data: {
          status: "PROCESSING",
          lastError: null,
        },
      });

      await tx.meetingArtifactDraft.update({
        where: { meetingId },
        data: {
          finalizationStatus: "PROCESSING",
          lastError: null,
        },
      });
    });

    try {
      const chunkStartedAt = Date.now();
      const chunkInput = await this.buildChunkExtractionInput(
        meetingId,
        nextChunk,
        parseMeetingArtifactDraftTasks(draft.rollingTasksJson),
      );
      this.trace(meetingId, "chunk_processing_started", {
        chunkIndex: nextChunk.chunkIndex,
        newContentStartMs: nextChunk.newContentStartMs,
        promptStartMs: nextChunk.promptStartMs,
        promptEndMs: nextChunk.promptEndMs,
        currentRollingTaskCount: chunkInput.currentRollingTasks.length,
        transcriptSegmentCount: chunkInput.transcriptSegments.length,
        speakerCount: chunkInput.speakers.length,
        tacticalTaskCount: chunkInput.tacticalTasks.length,
      });
      const hasNewTranscriptContent = chunkInput.transcriptSegments.some(
        (segment) =>
          Math.round(segment.endTime * 1000) > nextChunk.newContentStartMs,
      );

      if (!hasNewTranscriptContent) {
        await this.prisma.$transaction(async (tx) => {
          await tx.meetingExtractionChunk.update({
            where: { id: nextChunk.id },
            data: {
              status: "COMPLETED",
              partialSummary: "",
              taskMutationsJson: [] as Prisma.InputJsonValue,
              processedAt: new Date(),
              lastError: null,
            },
          });

          await tx.meetingArtifactDraft.update({
            where: { meetingId },
            data: {
              lastCompletedChunkIndex: nextChunk.chunkIndex,
              finalizationStatus: "PROCESSING",
              lastError: null,
            },
          });
        });

        this.clearRetryState(meetingId);
        this.trace(meetingId, "chunk_completed_without_new_content", {
          chunkIndex: nextChunk.chunkIndex,
          durationMs: Date.now() - chunkStartedAt,
        });

        return true;
      }

      const chunkArtifacts =
        await this.llmService.extractMeetingChunkArtifacts(chunkInput);
      const nextDraftTasks = applyTaskMutationsToDraft(
        chunkInput.currentRollingTasks,
        chunkArtifacts.taskMutations,
        nextChunk.chunkIndex,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.meetingExtractionChunk.update({
          where: { id: nextChunk.id },
          data: {
            status: "COMPLETED",
            partialSummary: chunkArtifacts.partialSummary,
            taskMutationsJson:
              chunkArtifacts.taskMutations as unknown as Prisma.InputJsonValue,
            processedAt: new Date(),
            lastError: null,
          },
        });

        await tx.meetingArtifactDraft.update({
          where: { meetingId },
          data: {
            rollingTasksJson:
              nextDraftTasks as unknown as Prisma.InputJsonValue,
            lastCompletedChunkIndex: nextChunk.chunkIndex,
            finalizationStatus: "PROCESSING",
            lastError: null,
          },
        });
      });

      this.clearRetryState(meetingId);
      this.trace(meetingId, "chunk_completed", {
        chunkIndex: nextChunk.chunkIndex,
        durationMs: Date.now() - chunkStartedAt,
        partialSummary: chunkArtifacts.partialSummary,
        taskMutations: chunkArtifacts.taskMutations,
        activeDraftTaskCount: nextDraftTasks.filter((task) => task.active)
          .length,
      });

      return true;
    } catch (error) {
      await this.handleChunkFailure(meetingId, nextChunk, error);
      return false;
    }
  }

  private async buildChunkExtractionInput(
    meetingId: string,
    nextChunk: {
      chunkIndex: number;
      newContentStartMs: number;
      promptStartMs: number;
      promptEndMs: number;
    },
    currentRollingTasks: MeetingArtifactDraftTask[],
  ) {
    const [meeting, transcriptSegments] = await Promise.all([
      this.prisma.meeting.findUnique({
        where: { id: meetingId },
        select: {
          title: true,
          createdAt: true,
          projectId: true,
          project: {
            select: {
              title: true,
              description: true,
              context: {
                select: {
                  contextMarkdown: true,
                },
              },
            },
          },
          speakers: {
            orderBy: {
              aiLabel: "asc",
            },
            select: {
              aiLabel: true,
              realName: true,
            },
          },
        },
      }),
      this.prisma.transcriptSegment.findMany({
        where: {
          meetingId,
          isSuppressed: false,
          startTime: {
            lt: nextChunk.promptEndMs / 1000,
          },
          endTime: {
            gt: nextChunk.promptStartMs / 1000,
          },
        },
        orderBy: {
          startTime: "asc",
        },
        select: {
          startTime: true,
          endTime: true,
          content: true,
          speaker: {
            select: {
              aiLabel: true,
              realName: true,
            },
          },
        },
      }),
    ]);

    if (!meeting) {
      throw new Error("Meeting not found.");
    }

    const tacticalTasks = meeting.projectId
      ? await this.prisma.actionItem.findMany({
          where: {
            meeting: {
              projectId: meeting.projectId,
              artifactReviewStatus: "APPROVED",
              id: {
                not: meetingId,
              },
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 30,
          select: {
            taskContent: true,
            deadline: true,
            status: true,
            meeting: {
              select: {
                title: true,
              },
            },
          },
        })
      : [];

    return {
      meetingTitle: meeting.title,
      meetingCreatedAt: meeting.createdAt.toISOString(),
      projectTitle: meeting.project?.title ?? null,
      projectDescription: meeting.project?.description ?? null,
      projectContextMarkdown: meeting.project?.context?.contextMarkdown ?? null,
      tacticalTasks: tacticalTasks.map((task) => ({
        status: task.status as "TODO" | "IN_PROGRESS" | "DONE",
        taskContent: task.taskContent,
        deadline: task.deadline?.toISOString() ?? null,
        sourceMeetingTitle: task.meeting.title,
      })),
      speakers: meeting.speakers,
      transcriptSegments: transcriptSegments.map((segment) => ({
        aiLabel: segment.speaker.aiLabel,
        realName: segment.speaker.realName,
        startTime: segment.startTime,
        endTime: segment.endTime,
        content: segment.content,
      })),
      currentRollingTasks,
      newContentStartMs: nextChunk.newContentStartMs,
      promptStartMs: nextChunk.promptStartMs,
      promptEndMs: nextChunk.promptEndMs,
    };
  }

  private async handleChunkFailure(
    meetingId: string,
    chunk: {
      id: string;
      chunkIndex: number;
      retryCount: number;
    },
    error: unknown,
  ): Promise<void> {
    const retryCount = chunk.retryCount + 1;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (retryCount >= MEETING_EXTRACTION_MAX_RETRIES) {
      await this.prisma.$transaction(async (tx) => {
        await tx.meetingExtractionChunk.update({
          where: {
            id: chunk.id,
          },
          data: {
            status: "FAILED",
            retryCount,
            lastError: errorMessage,
            processedAt: new Date(),
          },
        });

        await tx.meetingArtifactDraft.upsert({
          where: { meetingId },
          create: {
            meetingId,
            rollingTasksJson: [],
            finalizationStatus: "FAILED",
            lastError: errorMessage,
          },
          update: {
            finalizationStatus: "FAILED",
            lastError: errorMessage,
          },
        });

        await tx.meeting.update({
          where: { id: meetingId },
          data: {
            artifactReviewStatus: "FAILED",
            artifactExtractionError: `Chunk ${chunk.chunkIndex} failed after ${retryCount} attempts: ${errorMessage}`,
          },
        });
      });

      this.clearRetryState(meetingId);

      this.logger.error("Meeting extraction chunk failed permanently", {
        meetingId,
        chunkIndex: chunk.chunkIndex,
        retryCount,
        error: errorMessage,
      });
      this.trace(meetingId, "chunk_failed_permanently", {
        chunkIndex: chunk.chunkIndex,
        retryCount,
        error: errorMessage,
      });

      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingExtractionChunk.update({
        where: {
          id: chunk.id,
        },
        data: {
          status: "PENDING",
          retryCount,
          lastError: errorMessage,
          processedAt: null,
        },
      });

      await tx.meetingArtifactDraft.upsert({
        where: { meetingId },
        create: {
          meetingId,
          rollingTasksJson: [],
          finalizationStatus: "PROCESSING",
          lastError: errorMessage,
        },
        update: {
          finalizationStatus: "PROCESSING",
          lastError: errorMessage,
        },
      });
    });

    const retryDelayMs =
      MEETING_EXTRACTION_RETRY_BASE_DELAY_MS * 2 ** (retryCount - 1);

    this.scheduleRetry(meetingId, retryDelayMs);

    this.logger.warn("Retrying meeting extraction chunk", {
      meetingId,
      chunkIndex: chunk.chunkIndex,
      retryCount,
      retryDelayMs,
      error: errorMessage,
    });
    this.trace(meetingId, "chunk_retry_scheduled", {
      chunkIndex: chunk.chunkIndex,
      retryCount,
      retryDelayMs,
      error: errorMessage,
    });
  }

  private async finalizeMeetingArtifactsIfReady(
    meetingId: string,
  ): Promise<boolean> {
    const [meeting, draft, chunks] = await Promise.all([
      this.prisma.meeting.findUnique({
        where: { id: meetingId },
        select: {
          id: true,
          title: true,
          createdAt: true,
          status: true,
          artifactReviewStatus: true,
          speakers: {
            orderBy: {
              aiLabel: "asc",
            },
            select: {
              id: true,
              aiLabel: true,
            },
          },
        },
      }),
      this.prisma.meetingArtifactDraft.findUnique({
        where: { meetingId },
        select: {
          rollingTasksJson: true,
          finalizationStatus: true,
        },
      }),
      this.prisma.meetingExtractionChunk.findMany({
        where: { meetingId },
        orderBy: {
          chunkIndex: "asc",
        },
        select: {
          chunkIndex: true,
          status: true,
          partialSummary: true,
          processedAt: true,
        },
      }),
    ]);

    if (!meeting || !draft) {
      return false;
    }

    if (
      meeting.status !== "COMPLETED" ||
      meeting.artifactReviewStatus !== "PENDING" ||
      draft.finalizationStatus === "READY" ||
      draft.finalizationStatus === "FAILED"
    ) {
      return false;
    }

    if (chunks.length === 0) {
      return false;
    }

    if (chunks.some((chunk) => chunk.status === "FAILED")) {
      return false;
    }

    if (chunks.some((chunk) => chunk.status !== "COMPLETED")) {
      return false;
    }

    const partialSummaries = chunks
      .map((chunk) => chunk.partialSummary?.trim() ?? "")
      .filter(Boolean);

    if (partialSummaries.length === 0) {
      await this.markMeetingArtifactFailed(
        meetingId,
        "Chunk extraction finished without usable partial summaries.",
      );
      return true;
    }

    let reducedSummary = "";
    const reductionStartedAt = Date.now();
    this.trace(meetingId, "finalization_started", {
      chunkCount: chunks.length,
      partialSummaryCount: partialSummaries.length,
      activeDraftTaskCount: parseMeetingArtifactDraftTasks(
        draft.rollingTasksJson,
      ).filter((task) => task.active).length,
    });

    try {
      reducedSummary = await this.llmService.reduceMeetingSummary({
        meetingTitle: meeting.title,
        meetingCreatedAt: meeting.createdAt.toISOString(),
        partialSummaries,
      });
    } catch (error) {
      await this.markMeetingArtifactFailed(
        meetingId,
        `Summary reduction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return true;
    }

    if (!reducedSummary.trim()) {
      reducedSummary = partialSummaries.join(" ").trim();
    }

    if (!reducedSummary.trim()) {
      await this.markMeetingArtifactFailed(
        meetingId,
        "Summary reduction returned an empty final summary.",
      );
      return true;
    }

    const activeDraftTasks = parseMeetingArtifactDraftTasks(
      draft.rollingTasksJson,
    ).filter((task) => task.active);
    const speakerIdByAiLabel = new Map(
      meeting.speakers.map((speaker) => [speaker.aiLabel, speaker.id]),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          summary: reducedSummary,
          artifactReviewStatus: "READY",
          artifactExtractionError: null,
          artifactApprovedAt: null,
        },
      });

      await tx.actionItem.deleteMany({
        where: { meetingId },
      });

      if (activeDraftTasks.length > 0) {
        await tx.actionItem.createMany({
          data: activeDraftTasks.map((task) => ({
            meetingId,
            taskContent: task.taskContent,
            deadline: task.deadline ? new Date(task.deadline) : null,
            status: "TODO",
            isSynced: false,
            notionPageId: null,
            assigneeId: task.assigneeAiLabel
              ? (speakerIdByAiLabel.get(task.assigneeAiLabel) ?? null)
              : null,
          })),
        });
      }

      await tx.meetingArtifactDraft.update({
        where: { meetingId },
        data: {
          finalizationStatus: "READY",
          lastError: null,
        },
      });
    });

    this.trace(meetingId, "finalization_completed", {
      reductionDurationMs: Date.now() - reductionStartedAt,
      finalSummary: reducedSummary,
      materializedActionItemCount: activeDraftTasks.length,
    });

    return true;
  }

  private async markMeetingArtifactFailed(
    meetingId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          artifactReviewStatus: "FAILED",
          artifactExtractionError: errorMessage,
        },
      });

      await tx.meetingArtifactDraft.upsert({
        where: { meetingId },
        create: {
          meetingId,
          rollingTasksJson: [],
          finalizationStatus: "FAILED",
          lastError: errorMessage,
        },
        update: {
          finalizationStatus: "FAILED",
          lastError: errorMessage,
        },
      });
    });

    this.clearRetryState(meetingId);

    this.logger.error("Meeting artifact extraction failed", {
      meetingId,
      error: errorMessage,
    });
    this.trace(meetingId, "meeting_artifact_failed", {
      error: errorMessage,
    });
  }

  private scheduleRetry(meetingId: string, retryDelayMs: number): void {
    this.clearRetryTimer(meetingId);

    this.retryAvailableAt.set(meetingId, Date.now() + retryDelayMs);

    const retryTimer = setTimeout(() => {
      this.clearRetryState(meetingId);
      this.scheduleMeetingArtifactProcessing(meetingId);
    }, retryDelayMs);

    this.retryTimers.set(meetingId, retryTimer);
  }

  private isRetryBackoffActive(meetingId: string): boolean {
    const retryAvailableAt = this.retryAvailableAt.get(meetingId);

    return retryAvailableAt !== undefined && retryAvailableAt > Date.now();
  }

  private clearRetryTimer(meetingId: string): void {
    const retryTimer = this.retryTimers.get(meetingId);

    if (!retryTimer) {
      return;
    }

    clearTimeout(retryTimer);
    this.retryTimers.delete(meetingId);
  }

  private clearRetryState(meetingId: string): void {
    this.clearRetryTimer(meetingId);
    this.retryAvailableAt.delete(meetingId);
  }

  private trace(
    meetingId: string,
    event: string,
    payload?: Record<string, unknown>,
  ): void {
    this.traceWriter.append(meetingId, event, payload);
  }
}

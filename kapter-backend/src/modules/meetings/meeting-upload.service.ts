import { promises as fs } from "node:fs";
import path from "node:path";

import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type {
  DashboardMeetingSummary,
  WorkerAudioBatchRequest,
  WorkerTranscriptionResponse,
} from "@kapter/contracts";
import type { ConfigType } from "@nestjs/config";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { toPrismaAudioSourceType } from "src/modules/audio-stream/audio-source.utils";
import type { Logger } from "winston";

import { appConfig } from "../../config/app.config";
import { PrismaService } from "../../database/prisma.service";
import {
  AiWorkerClient,
  type ProcessedAudioBatch,
} from "../ai-worker/ai-worker.client";
import { BillingService } from "../billing/billing.service";
import { ClerkAuthService } from "../clerk/clerk-auth.service";
import { VoiceProfilesService } from "../voice-profiles/voice-profiles.service";
import {
  DEFAULT_MEETING_UPLOAD_RETENTION_HOURS,
  MEETING_UPLOAD_CLEANUP_INTERVAL_MS,
} from "./meeting-upload.constants";
import { MeetingArtifactExtractionService } from "./meeting-artifact-extraction.service";
import { MeetingsService } from "./meetings.service";
import { TranscriptPersistenceService } from "./transcript-persistence.service";

type UploadedMeetingAudioFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const ACCEPTED_MP3_MIME_TYPES = new Set(["audio/mpeg", "audio/mp3"]);
const PLACEHOLDER_AUDIO_BASE64 = Buffer.from(
  "uploaded-file-batch",
  "utf8",
).toString("base64");

const isMp3Upload = (file: UploadedMeetingAudioFile): boolean => {
  const normalizedMimeType = file.mimetype.trim().toLowerCase();
  const normalizedFileName = file.originalname.trim().toLowerCase();

  return (
    ACCEPTED_MP3_MIME_TYPES.has(normalizedMimeType) ||
    normalizedFileName.endsWith(".mp3")
  );
};

const buildUploadedMeetingTitle = (
  requestedTitle: string | undefined,
  originalFileName: string,
): string => {
  const normalizedTitle = requestedTitle?.trim();

  if (normalizedTitle) {
    return normalizedTitle;
  }

  const parsedFileName = path.parse(originalFileName.trim());

  if (parsedFileName.name.trim()) {
    return parsedFileName.name.trim();
  }

  return `Uploaded recording ${new Date().toISOString()}`;
};

@Injectable()
export class MeetingUploadService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly prisma: PrismaService,
    private readonly clerkAuthService: ClerkAuthService,
    private readonly meetingsService: MeetingsService,
    private readonly aiWorkerClient: AiWorkerClient,
    private readonly billingService: BillingService,
    private readonly transcriptPersistence: TranscriptPersistenceService,
    private readonly meetingArtifactExtraction: MeetingArtifactExtractionService,
    private readonly voiceProfilesService: VoiceProfilesService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reconcilePendingUploadedMeetings();
    await this.cleanupExpiredFailedUploads();
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredFailedUploads();
    }, MEETING_UPLOAD_CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async acceptUpload(
    clerkUserId: string,
    file: UploadedMeetingAudioFile | undefined,
    input: {
      title?: string;
      projectId?: string;
    },
  ): Promise<DashboardMeetingSummary> {
    if (!file || file.size === 0 || file.buffer.length === 0) {
      throw new BadRequestException("Meeting upload file is required.");
    }

    if (!isMp3Upload(file)) {
      throw new BadRequestException("Meeting upload must be an MP3 file.");
    }

    if (file.size > this.config.meetingUpload.maxBytes) {
      throw new BadRequestException(
        `Meeting upload exceeds the ${this.config.meetingUpload.maxBytes} byte limit.`,
      );
    }

    const localUser = await this.clerkAuthService.getOrSyncLocalUser(clerkUserId);
    await this.billingService.ensureCanStartRecording(localUser.id);

    const meeting = await this.meetingsService.createUploadedMeeting({
      userId: localUser.id,
      title: buildUploadedMeetingTitle(input.title, file.originalname),
      projectId: input.projectId,
    });

    try {
      const stagedFilePath = await this.stageUploadFile(meeting.id, file);
      await this.meetingsService.updateMeetingAudioUrl(meeting.id, stagedFilePath);

      const knownVoiceProfileIds =
        await this.voiceProfilesService.listActiveVoiceProfileIdsForUser(
          localUser.id,
        );

      this.logger.info("Meeting upload accepted", {
        meetingId: meeting.id,
        userId: localUser.id,
        bytes: file.size,
        mimeType: file.mimetype,
        originalName: file.originalname,
        stagedFilePath,
      });

      setImmediate(() => {
        void this.processUploadedMeeting({
          meetingId: meeting.id,
          streamId: `upload:${meeting.id}`,
          stagedFilePath,
          fileName: file.originalname,
          mimeType: file.mimetype,
          knownVoiceProfileIds,
        });
      });
    } catch (error) {
      await this.meetingsService.markMeetingFailed(meeting.id);
      throw error;
    }

    return meeting;
  }

  private async processUploadedMeeting(options: {
    meetingId: string;
    streamId: string;
    stagedFilePath: string;
    fileName: string;
    mimeType: string;
    knownVoiceProfileIds: string[];
  }): Promise<void> {
    try {
      this.logger.info("Meeting upload worker started", {
        meetingId: options.meetingId,
        streamId: options.streamId,
      });

      const fileBuffer = await fs.readFile(options.stagedFilePath);
      const workerResponse = await this.aiWorkerClient.processAudioFile({
        backendMeetingId: options.meetingId,
        streamId: options.streamId,
        sourceType: "tab_mix",
        knownVoiceProfileIds: options.knownVoiceProfileIds,
        fileBuffer,
        fileName: options.fileName,
        mimeType: options.mimeType,
      });

      this.logger.info("Meeting upload worker completed", {
        meetingId: options.meetingId,
        streamId: options.streamId,
        batchCount: workerResponse.batches.length,
      });

      for (const batch of workerResponse.batches) {
        const batchRecord = await this.prisma.meetingAudioBatch.create({
          data: {
            meetingId: options.meetingId,
            streamId: options.streamId,
            sourceType: toPrismaAudioSourceType(
              workerResponse.sourceType ?? "tab_mix",
            ),
            sequenceStart: batch.sequenceStart,
            sequenceEnd: batch.sequenceEnd,
            streamOffsetMs: batch.streamOffsetMs,
            durationMs: batch.durationMs,
            mimeType: options.mimeType,
            status: "PROCESSING",
            error: null,
          },
        });

        const request: WorkerAudioBatchRequest = {
          streamId: options.streamId,
          backendMeetingId: options.meetingId,
          sequenceStart: batch.sequenceStart,
          sequenceEnd: batch.sequenceEnd,
          streamOffsetMs: batch.streamOffsetMs,
          durationMs: batch.durationMs,
          mimeType: options.mimeType,
          audioBase64: PLACEHOLDER_AUDIO_BASE64,
          sourceType: "tab_mix",
          knownVoiceProfileIds: options.knownVoiceProfileIds,
        };
        const response: WorkerTranscriptionResponse = {
          streamId: options.streamId,
          backendMeetingId: options.meetingId,
          sequenceStart: batch.sequenceStart,
          sequenceEnd: batch.sequenceEnd,
          streamOffsetMs: batch.streamOffsetMs,
          segments: batch.segments,
          sourceType: workerResponse.sourceType ?? "tab_mix",
          speakerEvidence: batch.speakerEvidence ?? [],
        };

        try {
          await this.transcriptPersistence.persistWorkerBatch({
            batchId: batchRecord.id,
            request,
            response,
          } satisfies ProcessedAudioBatch);
        } catch (error) {
          await this.prisma.meetingAudioBatch.update({
            where: {
              id: batchRecord.id,
            },
            data: {
              status: "FAILED",
              error: error instanceof Error ? error.message : String(error),
            },
          });
          throw error;
        }
      }

      await this.meetingsService.markMeetingCompleted(options.meetingId);
      await this.recordMeetingUsage(options.meetingId, options.streamId);
      void Promise.resolve(
        this.meetingArtifactExtraction.notifyMeetingCaptureCompleted(
          options.meetingId,
        ),
      ).catch((error: unknown) => {
        this.logger.error("Meeting artifact extraction failed after upload.", {
          meetingId: options.meetingId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      await this.cleanupMeetingUploadFile(options.meetingId, options.stagedFilePath);
    } catch (error) {
      await this.meetingsService.markMeetingFailed(options.meetingId);
      this.logger.error("Meeting upload worker failed", {
        meetingId: options.meetingId,
        streamId: options.streamId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.logger.info("Meeting upload cleanup skipped", {
        meetingId: options.meetingId,
        streamId: options.streamId,
        reason: "retained_failed_upload",
        stagedFilePath: options.stagedFilePath,
      });
    }
  }

  private async stageUploadFile(
    meetingId: string,
    file: UploadedMeetingAudioFile,
  ): Promise<string> {
    const uploadDirectory = path.join(this.config.meetingUpload.tmpDir, meetingId);
    const stagedFilePath = path.join(uploadDirectory, "source.mp3");

    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(stagedFilePath, file.buffer);

    return stagedFilePath;
  }

  private async cleanupMeetingUploadFile(
    meetingId: string,
    stagedFilePath: string,
  ): Promise<void> {
    if (!this.isManagedUploadPath(stagedFilePath)) {
      this.logger.info("Meeting upload cleanup skipped", {
        meetingId,
        stagedFilePath,
        reason: "path_outside_upload_tmp_dir",
      });
      return;
    }

    await fs.rm(path.dirname(stagedFilePath), {
      recursive: true,
      force: true,
    });
    await this.meetingsService.updateMeetingAudioUrl(meetingId, null);

    this.logger.info("Meeting upload cleanup succeeded", {
      meetingId,
      stagedFilePath,
    });
  }

  private async cleanupExpiredFailedUploads(): Promise<void> {
    const retentionHours =
      this.config.meetingUpload.retentionHours ||
      DEFAULT_MEETING_UPLOAD_RETENTION_HOURS;
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    const failedUploads = await this.prisma.meeting.findMany({
      where: {
        ingestionSource: "FILE_UPLOAD",
        status: "FAILED",
        audioUrl: {
          not: null,
        },
        updatedAt: {
          lte: cutoff,
        },
      },
      select: {
        id: true,
        audioUrl: true,
      },
    });

    for (const failedUpload of failedUploads) {
      if (!failedUpload.audioUrl) {
        continue;
      }

      try {
        await this.cleanupMeetingUploadFile(failedUpload.id, failedUpload.audioUrl);
      } catch (error) {
        this.logger.warn("Meeting upload cleanup sweep failed", {
          meetingId: failedUpload.id,
          stagedFilePath: failedUpload.audioUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async reconcilePendingUploadedMeetings(): Promise<void> {
    const result = await this.prisma.meeting.updateMany({
      where: {
        ingestionSource: "FILE_UPLOAD",
        status: "PROCESSING",
      },
      data: {
        status: "FAILED",
      },
    });

    if (result.count > 0) {
      this.logger.warn("Marked stranded upload meetings as failed at startup", {
        count: result.count,
      });
    }
  }

  private async recordMeetingUsage(
    meetingId: string,
    streamId: string,
  ): Promise<void> {
    try {
      await this.billingService.recordMeetingUsage(meetingId, "file_upload");
    } catch (error) {
      this.logger.error(
        "Failed to record uploaded meeting usage for billing quota",
        {
          streamId,
          meetingId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  private isManagedUploadPath(candidatePath: string): boolean {
    const normalizedRoot = path.resolve(this.config.meetingUpload.tmpDir);
    const normalizedCandidate = path.resolve(candidatePath);

    return (
      normalizedCandidate === normalizedRoot ||
      normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
    );
  }
}

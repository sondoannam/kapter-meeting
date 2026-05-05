import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  MEETING_STATUS,
  type AudioSourceType,
  type CaptureContext,
} from "@kapter/contracts";

import { PrismaService } from "../../database/prisma.service";
import { LlmService } from "../llm/llm.service";
import { MeetingArtifactExtractionService } from "./meeting-artifact-extraction.service";
import type { SaveMeetingReviewDto } from "./dto/save-meeting-review.dto";

interface CreateRecordingMeetingOptions {
  userId: string;
  externalMeetingId?: string | null;
  projectId?: string;
  captureContext?: CaptureContext;
}

interface UpdateRecordingMeetingCaptureStateOptions {
  degradedWithoutSelfMic?: boolean;
}

const toPrismaCaptureContext = (
  captureContext?: CaptureContext,
): "GOOGLE_MEET_ROOM" | "GENERIC_TAB" | undefined => {
  if (captureContext === "google_meet_room") {
    return "GOOGLE_MEET_ROOM";
  }

  if (captureContext === "generic_tab") {
    return "GENERIC_TAB";
  }

  return undefined;
};

const toContractCaptureContext = (
  captureContext?: "GOOGLE_MEET_ROOM" | "GENERIC_TAB" | null,
): CaptureContext | null => {
  if (captureContext === "GOOGLE_MEET_ROOM") {
    return "google_meet_room";
  }

  if (captureContext === "GENERIC_TAB") {
    return "generic_tab";
  }

  return null;
};

const toContractAudioSourceType = (
  sourceType?: "TAB_MIX" | "SELF_MIC" | null,
): AudioSourceType | null => {
  if (sourceType === "TAB_MIX") {
    return "tab_mix";
  }

  if (sourceType === "SELF_MIC") {
    return "self_mic";
  }

  return null;
};

const toContractTranscriptMergeStrategy = (
  mergeStrategy?: "PREFERRED_SELF_MIC_DUPLICATE" | "AMBIGUOUS_OVERLAP" | null,
): DashboardMeetingTranscriptMergeStrategy | null => {
  if (
    mergeStrategy === "PREFERRED_SELF_MIC_DUPLICATE" ||
    mergeStrategy === "AMBIGUOUS_OVERLAP"
  ) {
    return mergeStrategy;
  }

  return null;
};

const deriveDashboardActiveSourceTypes = (options: {
  captureContext?: "GOOGLE_MEET_ROOM" | "GENERIC_TAB" | null;
  degradedWithoutSelfMic: boolean;
  audioBatches: Array<{
    sourceType?: "TAB_MIX" | "SELF_MIC" | null;
  }>;
}): AudioSourceType[] => {
  const captureContext = toContractCaptureContext(options.captureContext);

  if (captureContext === "google_meet_room") {
    return options.degradedWithoutSelfMic
      ? ["tab_mix"]
      : ["tab_mix", "self_mic"];
  }

  const persistedSourceTypes = Array.from(
    new Set(
      options.audioBatches
        .map((batch) => toContractAudioSourceType(batch.sourceType))
        .filter(
          (sourceType): sourceType is AudioSourceType => sourceType !== null,
        ),
    ),
  );

  if (captureContext === "generic_tab") {
    return persistedSourceTypes.length > 0 ? persistedSourceTypes : ["tab_mix"];
  }

  return persistedSourceTypes;
};

const buildMeetingTitle = (externalMeetingId: string | null): string => {
  if (externalMeetingId) {
    return `Recording ${externalMeetingId}`;
  }

  return `Recording ${new Date().toISOString()}`;
};

const buildDraftProjectTitle = (): string =>
  `Draft Project ${new Date().toISOString()}`;

export interface DashboardMeetingSummary {
  id: string;
  title: string;
  status: string;
  artifactReviewStatus: string;
  captureContext: CaptureContext | null;
  degradedWithoutSelfMic: boolean;
  activeSourceTypes: AudioSourceType[];
  externalMeetingId: string | null;
  projectId: string | null;
  projectTitle: string | null;
  createdAt: string;
  updatedAt: string;
  totalDurationMs: number;
}

export interface DashboardMeetingSpeaker {
  id: string;
  aiLabel: string;
  realName: string | null;
  segmentCount: number;
  actionItemCount: number;
}

export type DashboardMeetingTranscriptMergeStrategy =
  | "PREFERRED_SELF_MIC_DUPLICATE"
  | "AMBIGUOUS_OVERLAP";

export interface DashboardMeetingTranscriptSegment {
  id: string;
  speakerId: string;
  aiLabel: string;
  realName: string | null;
  content: string;
  startTime: number;
  endTime: number;
  sourceType: AudioSourceType | null;
  mergeStrategy: DashboardMeetingTranscriptMergeStrategy | null;
  mergeSourceType: AudioSourceType | null;
}

export interface DashboardMeetingActionItem {
  id: string;
  taskContent: string;
  deadline: string | null;
  status: string;
  isSynced: boolean;
  notionPageId: string | null;
  assigneeId: string | null;
  assigneeAiLabel: string | null;
  assigneeRealName: string | null;
  createdAt: string;
}

export interface DashboardMeetingContextProposal {
  id: string;
  proposedContextMarkdown: string;
  changeSummary: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMeetingNotionWorkspace {
  id: string;
  name: string | null;
  icon: string | null;
}

export interface DashboardMeetingSyncReadiness {
  notion: {
    connected: boolean;
    workspace: DashboardMeetingNotionWorkspace | null;
  };
  projectDestination: {
    mode: "PROJECT_PAGE" | "EXISTING_PAGE" | null;
    projectPageId: string | null;
    taskDatabaseId: string | null;
  };
  syncedActionItemCount: number;
  unsyncedActionItemCount: number;
}

export interface DashboardMeetingProcessing {
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  pendingBatches: number;
  transcriptSegmentCount: number;
  latestProcessedAt: string | null;
}

export interface DashboardMeetingArtifactProcessing {
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  pendingChunks: number;
  latestProcessedAt: string | null;
  finalizationStatus: string | null;
}

export interface DashboardMeetingDetail extends DashboardMeetingSummary {
  summary: string | null;
  artifactExtractionError: string | null;
  artifactApprovedAt: string | null;
  speakers: DashboardMeetingSpeaker[];
  transcriptSegments: DashboardMeetingTranscriptSegment[];
  actionItems: DashboardMeetingActionItem[];
  pendingContextProposal: DashboardMeetingContextProposal | null;
  syncReadiness: DashboardMeetingSyncReadiness;
  processing: DashboardMeetingProcessing;
  artifactProcessing: DashboardMeetingArtifactProcessing;
}

const dashboardMeetingSelect = {
  id: true,
  title: true,
  status: true,
  artifactReviewStatus: true,
  captureContext: true,
  degradedWithoutSelfMic: true,
  externalMeetingId: true,
  projectId: true,
  project: {
    select: {
      title: true,
    },
  },
  createdAt: true,
  updatedAt: true,
  audioBatches: {
    select: {
      durationMs: true,
      sourceType: true,
    },
  },
} as const;

const toDashboardMeetingSummary = (meeting: {
  id: string;
  title: string;
  status: string;
  artifactReviewStatus: string;
  captureContext: "GOOGLE_MEET_ROOM" | "GENERIC_TAB" | null;
  degradedWithoutSelfMic: boolean;
  externalMeetingId: string | null;
  projectId: string | null;
  project: { title: string } | null;
  createdAt: Date;
  updatedAt: Date;
  audioBatches: Array<{
    durationMs: number;
    sourceType: "TAB_MIX" | "SELF_MIC" | null;
  }>;
}): DashboardMeetingSummary => ({
  id: meeting.id,
  title: meeting.title,
  status: meeting.status,
  artifactReviewStatus: meeting.artifactReviewStatus,
  captureContext: toContractCaptureContext(meeting.captureContext),
  degradedWithoutSelfMic: meeting.degradedWithoutSelfMic,
  activeSourceTypes: deriveDashboardActiveSourceTypes({
    captureContext: meeting.captureContext,
    degradedWithoutSelfMic: meeting.degradedWithoutSelfMic,
    audioBatches: meeting.audioBatches,
  }),
  externalMeetingId: meeting.externalMeetingId,
  projectId: meeting.projectId,
  projectTitle: meeting.project?.title ?? null,
  createdAt: meeting.createdAt.toISOString(),
  updatedAt: meeting.updatedAt.toISOString(),
  totalDurationMs: meeting.audioBatches.reduce(
    (totalDurationMs, batch) => totalDurationMs + batch.durationMs,
    0,
  ),
});

const dashboardMeetingDetailSelect = {
  id: true,
  title: true,
  status: true,
  artifactReviewStatus: true,
  artifactExtractionError: true,
  artifactApprovedAt: true,
  captureContext: true,
  degradedWithoutSelfMic: true,
  externalMeetingId: true,
  projectId: true,
  project: {
    select: {
      title: true,
      notionDestinationMode: true,
      notionProjectPageId: true,
      notionTaskDatabaseId: true,
    },
  },
  user: {
    select: {
      NotionConnection: {
        select: {
          workspaceId: true,
          workspaceName: true,
          workspaceIcon: true,
        },
      },
    },
  },
  summary: true,
  createdAt: true,
  updatedAt: true,
  audioBatches: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      status: true,
      processedAt: true,
      durationMs: true,
      sourceType: true,
    },
  },
  speakers: {
    orderBy: {
      aiLabel: "asc",
    },
    select: {
      id: true,
      aiLabel: true,
      realName: true,
      _count: {
        select: {
          segments: true,
          actionItems: true,
        },
      },
    },
  },
  transcript: {
    where: {
      isSuppressed: false,
    },
    orderBy: {
      startTime: "asc",
    },
    select: {
      id: true,
      speakerId: true,
      content: true,
      startTime: true,
      endTime: true,
      sourceType: true,
      mergeStrategy: true,
      mergeSourceType: true,
      speaker: {
        select: {
          aiLabel: true,
          realName: true,
        },
      },
    },
  },
  actionItems: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      taskContent: true,
      deadline: true,
      status: true,
      isSynced: true,
      notionPageId: true,
      updatedAt: true,
      createdAt: true,
      assigneeId: true,
      assignee: {
        select: {
          aiLabel: true,
          realName: true,
        },
      },
    },
  },
  contextUpdateProposals: {
    where: {
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    select: {
      id: true,
      proposedContextMarkdown: true,
      changeSummary: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  extractionChunks: {
    orderBy: {
      chunkIndex: "asc",
    },
    select: {
      chunkIndex: true,
      status: true,
      processedAt: true,
    },
  },
  artifactDraft: {
    select: {
      finalizationStatus: true,
    },
  },
} as const;

const toDashboardMeetingDetail = (meeting: {
  id: string;
  title: string;
  status: string;
  artifactReviewStatus: string;
  artifactExtractionError: string | null;
  artifactApprovedAt: Date | null;
  captureContext: "GOOGLE_MEET_ROOM" | "GENERIC_TAB" | null;
  degradedWithoutSelfMic: boolean;
  externalMeetingId: string | null;
  projectId: string | null;
  project: {
    title: string;
    notionDestinationMode: "PROJECT_PAGE" | "EXISTING_PAGE" | null;
    notionProjectPageId: string | null;
    notionTaskDatabaseId: string | null;
  } | null;
  user?: {
    NotionConnection: {
      workspaceId: string;
      workspaceName: string | null;
      workspaceIcon: string | null;
    } | null;
  } | null;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
  audioBatches: Array<{
    id: string;
    status: string;
    processedAt: Date | null;
    durationMs: number;
    sourceType: "TAB_MIX" | "SELF_MIC" | null;
  }>;
  speakers: Array<{
    id: string;
    aiLabel: string;
    realName: string | null;
    _count: {
      segments: number;
      actionItems: number;
    };
  }>;
  transcript: Array<{
    id: string;
    speakerId: string;
    content: string;
    startTime: number;
    endTime: number;
    sourceType: "TAB_MIX" | "SELF_MIC" | null;
    mergeStrategy: "PREFERRED_SELF_MIC_DUPLICATE" | "AMBIGUOUS_OVERLAP" | null;
    mergeSourceType: "TAB_MIX" | "SELF_MIC" | null;
    speaker: {
      aiLabel: string;
      realName: string | null;
    };
  }>;
  actionItems: Array<{
    id: string;
    taskContent: string;
    deadline: Date | null;
    status: string;
    isSynced: boolean;
    notionPageId: string | null;
    createdAt: Date;
    updatedAt: Date;
    assigneeId: string | null;
    assignee: {
      aiLabel: string;
      realName: string | null;
    } | null;
  }>;
  contextUpdateProposals: Array<{
    id: string;
    proposedContextMarkdown: string;
    changeSummary: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  extractionChunks: Array<{
    chunkIndex: number;
    status: string;
    processedAt: Date | null;
  }>;
  artifactDraft: {
    finalizationStatus: string;
  } | null;
}): DashboardMeetingDetail => {
  const completedBatches = meeting.audioBatches.filter(
    (batch) => batch.status === "COMPLETED",
  ).length;
  const failedBatches = meeting.audioBatches.filter(
    (batch) => batch.status === "FAILED",
  ).length;
  const latestProcessedAt = meeting.audioBatches
    .map((batch) => batch.processedAt)
    .filter((processedAt): processedAt is Date => processedAt !== null)
    .sort((left, right) => right.getTime() - left.getTime())[0];
  const completedChunks = meeting.extractionChunks.filter(
    (chunk) => chunk.status === "COMPLETED",
  ).length;
  const failedChunks = meeting.extractionChunks.filter(
    (chunk) => chunk.status === "FAILED",
  ).length;
  const latestArtifactProcessedAt = meeting.extractionChunks
    .map((chunk) => chunk.processedAt)
    .filter((processedAt): processedAt is Date => processedAt !== null)
    .sort((left, right) => right.getTime() - left.getTime())[0];
  const syncedActionItemCount = meeting.actionItems.filter(
    (actionItem) => actionItem.isSynced,
  ).length;
  const notionConnection = meeting.user?.NotionConnection ?? null;

  return {
    ...toDashboardMeetingSummary(meeting),
    summary: meeting.summary,
    artifactExtractionError: meeting.artifactExtractionError,
    artifactApprovedAt: meeting.artifactApprovedAt?.toISOString() ?? null,
    speakers: meeting.speakers.map((speaker) => ({
      id: speaker.id,
      aiLabel: speaker.aiLabel,
      realName: speaker.realName,
      segmentCount: speaker._count.segments,
      actionItemCount: speaker._count.actionItems,
    })),
    transcriptSegments: meeting.transcript.map((segment) => ({
      id: segment.id,
      speakerId: segment.speakerId,
      aiLabel: segment.speaker.aiLabel,
      realName: segment.speaker.realName,
      content: segment.content,
      startTime: segment.startTime,
      endTime: segment.endTime,
      sourceType: toContractAudioSourceType(segment.sourceType),
      mergeStrategy: toContractTranscriptMergeStrategy(segment.mergeStrategy),
      mergeSourceType: toContractAudioSourceType(segment.mergeSourceType),
    })),
    actionItems: meeting.actionItems.map((actionItem) => ({
      id: actionItem.id,
      taskContent: actionItem.taskContent,
      deadline: actionItem.deadline?.toISOString() ?? null,
      status: actionItem.status,
      isSynced: actionItem.isSynced,
      notionPageId: actionItem.notionPageId,
      assigneeId: actionItem.assigneeId,
      assigneeAiLabel: actionItem.assignee?.aiLabel ?? null,
      assigneeRealName: actionItem.assignee?.realName ?? null,
      createdAt: actionItem.createdAt.toISOString(),
    })),
    pendingContextProposal: meeting.contextUpdateProposals[0]
      ? {
          id: meeting.contextUpdateProposals[0].id,
          proposedContextMarkdown:
            meeting.contextUpdateProposals[0].proposedContextMarkdown,
          changeSummary: meeting.contextUpdateProposals[0].changeSummary,
          status: meeting.contextUpdateProposals[0].status,
          createdAt: meeting.contextUpdateProposals[0].createdAt.toISOString(),
          updatedAt: meeting.contextUpdateProposals[0].updatedAt.toISOString(),
        }
      : null,
    syncReadiness: {
      notion: {
        connected: notionConnection !== null,
        workspace: notionConnection
          ? {
              id: notionConnection.workspaceId,
              name: notionConnection.workspaceName,
              icon: notionConnection.workspaceIcon,
            }
          : null,
      },
      projectDestination: {
        mode: meeting.project?.notionDestinationMode ?? null,
        projectPageId: meeting.project?.notionProjectPageId ?? null,
        taskDatabaseId: meeting.project?.notionTaskDatabaseId ?? null,
      },
      syncedActionItemCount,
      unsyncedActionItemCount:
        meeting.actionItems.length - syncedActionItemCount,
    },
    processing: {
      totalBatches: meeting.audioBatches.length,
      completedBatches,
      failedBatches,
      pendingBatches:
        meeting.audioBatches.length - completedBatches - failedBatches,
      transcriptSegmentCount: meeting.transcript.length,
      latestProcessedAt: latestProcessedAt?.toISOString() ?? null,
    },
    artifactProcessing: {
      totalChunks: meeting.extractionChunks.length,
      completedChunks,
      failedChunks,
      pendingChunks:
        meeting.extractionChunks.length - completedChunks - failedChunks,
      latestProcessedAt: latestArtifactProcessedAt?.toISOString() ?? null,
      finalizationStatus: meeting.artifactDraft?.finalizationStatus ?? null,
    },
  };
};

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService?: LlmService,
    private readonly meetingArtifactExtraction?: MeetingArtifactExtractionService,
  ) {}

  private async resolveProjectId(
    userId: string,
    requestedProjectId?: string,
  ): Promise<string> {
    const normalizedProjectId = requestedProjectId?.trim();

    if (normalizedProjectId) {
      const project = await this.prisma.project.findUnique({
        where: {
          id: normalizedProjectId,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!project || project.userId !== userId) {
        throw new NotFoundException(
          `Project ${normalizedProjectId} was not found for the current user.`,
        );
      }

      return project.id;
    }

    const draftProject = await this.prisma.project.create({
      data: {
        userId,
        title: buildDraftProjectTitle(),
        isDraft: true,
      },
      select: {
        id: true,
      },
    });

    return draftProject.id;
  }

  async createRecordingMeeting({
    userId,
    externalMeetingId,
    projectId,
    captureContext,
  }: CreateRecordingMeetingOptions) {
    const normalizedExternalMeetingId = externalMeetingId?.trim() || null;
    const resolvedProjectId = await this.resolveProjectId(userId, projectId);

    return this.prisma.meeting.create({
      data: {
        userId,
        title: buildMeetingTitle(normalizedExternalMeetingId),
        status: "RECORDING",
        captureContext: toPrismaCaptureContext(captureContext),
        externalMeetingId: normalizedExternalMeetingId,
        projectId: resolvedProjectId,
      },
      select: {
        id: true,
        externalMeetingId: true,
        status: true,
        title: true,
        userId: true,
        projectId: true,
      },
    });
  }

  async updateRecordingMeetingCaptureState(
    meetingId: string,
    { degradedWithoutSelfMic }: UpdateRecordingMeetingCaptureStateOptions,
  ): Promise<void> {
    const updateData: {
      degradedWithoutSelfMic?: boolean;
    } = {};

    if (typeof degradedWithoutSelfMic === "boolean") {
      updateData.degradedWithoutSelfMic = degradedWithoutSelfMic;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: updateData,
    });
  }

  async markMeetingProcessing(meetingId: string): Promise<void> {
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: "PROCESSING",
      },
    });
  }

  async markMeetingCompleted(meetingId: string): Promise<void> {
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: "COMPLETED",
      },
    });
  }

  async markMeetingFailed(meetingId: string): Promise<void> {
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: "FAILED",
      },
    });
  }

  async listMeetingHistory(
    clerkUserId: string,
  ): Promise<DashboardMeetingSummary[]> {
    const meetings = await this.prisma.meeting.findMany({
      where: {
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: dashboardMeetingSelect,
    });

    return meetings.map(toDashboardMeetingSummary);
  }

  async getActiveMeeting(
    clerkUserId: string,
  ): Promise<DashboardMeetingSummary | null> {
    const meeting = await this.prisma.meeting.findFirst({
      where: {
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
        status: {
          in: [MEETING_STATUS.RECORDING, MEETING_STATUS.PROCESSING],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: dashboardMeetingSelect,
    });

    return meeting ? toDashboardMeetingSummary(meeting) : null;
  }

  async getMeetingDetail(
    clerkUserId: string,
    meetingId: string,
    scheduleArtifactProcessing = true,
  ): Promise<DashboardMeetingDetail> {
    const meeting = await this.prisma.meeting.findFirst({
      where: {
        id: meetingId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: dashboardMeetingDetailSelect,
    });

    if (!meeting) {
      throw new NotFoundException("Meeting not found.");
    }

    if (
      scheduleArtifactProcessing &&
      meeting.artifactReviewStatus === "PENDING" &&
      this.meetingArtifactExtraction
    ) {
      this.meetingArtifactExtraction.scheduleMeetingArtifactProcessing(
        meeting.id,
      );
    }

    return toDashboardMeetingDetail(meeting);
  }

  async saveMeetingReview(
    clerkUserId: string,
    meetingId: string,
    input: SaveMeetingReviewDto,
  ): Promise<DashboardMeetingDetail> {
    const meeting = await this.prisma.meeting.findFirst({
      where: {
        id: meetingId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        speakers: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException("Meeting not found.");
    }

    const summary = input.summary.trim();

    if (!summary) {
      throw new BadRequestException("Meeting summary cannot be empty.");
    }

    const speakerIds = new Set(meeting.speakers.map((speaker) => speaker.id));
    const actionItems = input.actionItems.map((actionItem, index) => {
      const taskContent = actionItem.taskContent.trim();

      if (!taskContent) {
        throw new BadRequestException(
          `Action item at index ${index} cannot be empty.`,
        );
      }

      const assigneeId = actionItem.assigneeId?.trim() || null;

      if (assigneeId && !speakerIds.has(assigneeId)) {
        throw new BadRequestException(
          `Action item at index ${index} has an invalid assignee.`,
        );
      }

      return {
        meetingId: meeting.id,
        taskContent,
        deadline: actionItem.deadline ? new Date(actionItem.deadline) : null,
        assigneeId,
        status: actionItem.status ?? "TODO",
        isSynced: false,
        notionPageId: null,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          summary,
          artifactReviewStatus: "READY",
          artifactExtractionError: null,
          artifactApprovedAt: null,
        },
      });

      await tx.actionItem.deleteMany({
        where: { meetingId: meeting.id },
      });

      if (actionItems.length > 0) {
        await tx.actionItem.createMany({
          data: actionItems,
        });
      }
    });

    return this.getMeetingDetail(clerkUserId, meeting.id);
  }

  async retryMeetingExtraction(
    clerkUserId: string,
    meetingId: string,
  ): Promise<DashboardMeetingDetail> {
    if (!this.meetingArtifactExtraction) {
      throw new BadRequestException("Meeting extraction is not available.");
    }

    const meeting = await this.prisma.meeting.findFirst({
      where: {
        id: meetingId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        artifactReviewStatus: true,
        _count: {
          select: {
            transcript: true,
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException("Meeting not found.");
    }

    if (meeting.artifactReviewStatus === "APPROVED") {
      throw new BadRequestException(
        "Approved meeting artifacts cannot be re-extracted.",
      );
    }

    if (meeting._count.transcript === 0) {
      throw new BadRequestException(
        "Meeting extraction cannot run before transcript segments exist.",
      );
    }

    await this.meetingArtifactExtraction.resetMeetingArtifacts(meeting.id);
    this.meetingArtifactExtraction.scheduleMeetingArtifactProcessing(
      meeting.id,
    );

    return this.getMeetingDetail(clerkUserId, meeting.id, false);
  }

  async approveMeetingReview(
    clerkUserId: string,
    meetingId: string,
  ): Promise<DashboardMeetingDetail> {
    const meeting = await this.prisma.meeting.findFirst({
      where: {
        id: meetingId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        title: true,
        summary: true,
        projectId: true,
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            context: {
              select: {
                contextMarkdown: true,
              },
            },
          },
        },
        actionItems: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            taskContent: true,
            deadline: true,
            status: true,
            assignee: {
              select: {
                aiLabel: true,
                realName: true,
              },
            },
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException("Meeting not found.");
    }

    const summary = meeting.summary?.trim();

    if (!summary) {
      throw new BadRequestException("Meeting summary must be reviewed first.");
    }

    await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        artifactReviewStatus: "APPROVED",
        artifactApprovedAt: new Date(),
        artifactExtractionError: null,
      },
    });

    const project = meeting.project;

    if (project && this.llmService) {
      try {
        const proposal = await this.llmService.proposeProjectContextUpdate({
          projectTitle: project.title,
          projectDescription: project.description,
          currentContextMarkdown: project.context?.contextMarkdown ?? null,
          meetingTitle: meeting.title,
          meetingSummary: summary,
          approvedTasks: meeting.actionItems.map((actionItem) => ({
            status: actionItem.status as "TODO" | "IN_PROGRESS" | "DONE",
            taskContent: actionItem.taskContent,
            deadline: actionItem.deadline?.toISOString() ?? null,
            assigneeName:
              actionItem.assignee?.realName ??
              actionItem.assignee?.aiLabel ??
              null,
          })),
        });

        await this.prisma.$transaction(async (tx) => {
          await tx.projectContextUpdateProposal.updateMany({
            where: {
              meetingId: meeting.id,
              status: "PENDING",
            },
            data: {
              status: "DISMISSED",
            },
          });

          await tx.projectContextUpdateProposal.create({
            data: {
              projectId: project.id,
              meetingId: meeting.id,
              proposedContextMarkdown: proposal.contextMarkdown,
              changeSummary: proposal.changeSummary,
            },
          });
        });
      } catch {
        // Approval must remain a human-controlled action even if memory proposal fails.
      }
    }

    return this.getMeetingDetail(clerkUserId, meeting.id);
  }

  async applyProjectContextProposal(
    clerkUserId: string,
    meetingId: string,
    proposalId: string,
  ): Promise<DashboardMeetingDetail> {
    const proposal = await this.prisma.projectContextUpdateProposal.findFirst({
      where: {
        id: proposalId,
        meetingId,
        status: "PENDING",
        meeting: {
          user: {
            is: {
              clerkId: clerkUserId,
              deletedAt: null,
            },
          },
        },
      },
      select: {
        id: true,
        projectId: true,
        meetingId: true,
        proposedContextMarkdown: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException("Project context proposal not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.projectContext.upsert({
        where: {
          projectId: proposal.projectId,
        },
        create: {
          projectId: proposal.projectId,
          contextMarkdown: proposal.proposedContextMarkdown,
        },
        update: {
          contextMarkdown: proposal.proposedContextMarkdown,
        },
      });
      await tx.projectContextUpdateProposal.update({
        where: {
          id: proposal.id,
        },
        data: {
          status: "APPLIED",
        },
      });
    });

    return this.getMeetingDetail(clerkUserId, proposal.meetingId);
  }

  async dismissProjectContextProposal(
    clerkUserId: string,
    meetingId: string,
    proposalId: string,
  ): Promise<DashboardMeetingDetail> {
    const proposal = await this.prisma.projectContextUpdateProposal.findFirst({
      where: {
        id: proposalId,
        meetingId,
        status: "PENDING",
        meeting: {
          user: {
            is: {
              clerkId: clerkUserId,
              deletedAt: null,
            },
          },
        },
      },
      select: {
        id: true,
        meetingId: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException("Project context proposal not found.");
    }

    await this.prisma.projectContextUpdateProposal.update({
      where: {
        id: proposal.id,
      },
      data: {
        status: "DISMISSED",
      },
    });

    return this.getMeetingDetail(clerkUserId, proposal.meetingId);
  }
}

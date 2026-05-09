import type {
  AudioSourceType,
  DashboardMeetingTranscriptMergeStrategy,
} from "@kapter/contracts"

export type {
  ActionItemStatus,
  ActiveMeetingResponse,
  DashboardMeetingActionItem,
  DashboardMeetingArtifactProcessing,
  DashboardMeetingContextProposal,
  DashboardMeetingDetail,
  DashboardMeetingNotionWorkspace,
  DashboardMeetingProcessing,
  DashboardMeetingSpeaker,
  DashboardMeetingSummary,
  DashboardMeetingSyncReadiness,
  DashboardMeetingTranscriptMergeStrategy,
  DashboardMeetingTranscriptSegment,
  DeleteMeetingResponse,
  MeetingArtifactReviewStatus,
  MeetingDetailResponse,
  MeetingHistoryResponse,
  MeetingNotionSyncResponse,
  MeetingNotionSyncResult,
  SaveMeetingReviewActionItemRequest,
  SaveMeetingReviewRequest,
  UpdateMeetingMetadataRequest,
} from "@kapter/contracts"

export interface DashboardMeetingTranscriptTurn {
  id: string
  speakerId: string
  aiLabel: string
  realName: string | null
  content: string
  startTime: number
  endTime: number
  sourceSegmentCount: number
  sourceTypes: AudioSourceType[]
  mergeStrategies: DashboardMeetingTranscriptMergeStrategy[]
  mergeSourceTypes: AudioSourceType[]
}

export type MeetingsRequestStatus = "loading" | "ready" | "error"

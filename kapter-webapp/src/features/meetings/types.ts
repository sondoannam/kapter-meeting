import type {
  AudioSourceType,
  CaptureContext,
  IsoDateTimeString,
  MeetingStatus,
} from "@kapter/contracts"

export type MeetingArtifactReviewStatus =
  | "PENDING"
  | "READY"
  | "APPROVED"
  | "FAILED"

export type ActionItemStatus = "TODO" | "IN_PROGRESS" | "DONE"
export type DashboardMeetingTranscriptMergeStrategy =
  | "PREFERRED_SELF_MIC_DUPLICATE"
  | "AMBIGUOUS_OVERLAP"

export interface DashboardMeetingSummary {
  id: string
  title: string
  status: MeetingStatus
  artifactReviewStatus: MeetingArtifactReviewStatus
  captureContext: CaptureContext | null
  degradedWithoutSelfMic: boolean
  activeSourceTypes: AudioSourceType[]
  externalMeetingId: string | null
  projectId: string | null
  projectTitle: string | null
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
  totalDurationMs: number
}

export interface DashboardMeetingSpeaker {
  id: string
  aiLabel: string
  realName: string | null
  segmentCount: number
  actionItemCount: number
}

export interface DashboardMeetingTranscriptSegment {
  id: string
  speakerId: string
  aiLabel: string
  realName: string | null
  content: string
  startTime: number
  endTime: number
  sourceType: AudioSourceType | null
  mergeStrategy: DashboardMeetingTranscriptMergeStrategy | null
  mergeSourceType: AudioSourceType | null
}

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

export interface DashboardMeetingActionItem {
  id: string
  taskContent: string
  deadline: IsoDateTimeString | null
  status: ActionItemStatus
  isSynced: boolean
  notionPageId: string | null
  assigneeId: string | null
  assigneeAiLabel: string | null
  assigneeRealName: string | null
  createdAt: IsoDateTimeString
}

export interface DashboardMeetingContextProposal {
  id: string
  proposedContextMarkdown: string
  changeSummary: string
  status: "PENDING" | "APPLIED" | "DISMISSED"
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface DashboardMeetingNotionWorkspace {
  id: string
  name: string | null
  icon: string | null
}

export interface DashboardMeetingSyncReadiness {
  notion: {
    connected: boolean
    workspace: DashboardMeetingNotionWorkspace | null
  }
  projectDestination: {
    mode: "PROJECT_PAGE" | "EXISTING_PAGE" | null
    projectPageId: string | null
    taskDatabaseId: string | null
  }
  syncedActionItemCount: number
  unsyncedActionItemCount: number
}

export interface DashboardMeetingProcessing {
  totalBatches: number
  completedBatches: number
  failedBatches: number
  pendingBatches: number
  transcriptSegmentCount: number
  latestProcessedAt: IsoDateTimeString | null
}

export interface DashboardMeetingArtifactProcessing {
  totalChunks: number
  completedChunks: number
  failedChunks: number
  pendingChunks: number
  latestProcessedAt: IsoDateTimeString | null
  finalizationStatus: string | null
}

export interface DashboardMeetingDetail extends DashboardMeetingSummary {
  summary: string | null
  artifactExtractionError: string | null
  artifactApprovedAt: IsoDateTimeString | null
  speakers: DashboardMeetingSpeaker[]
  transcriptSegments: DashboardMeetingTranscriptSegment[]
  actionItems: DashboardMeetingActionItem[]
  pendingContextProposal: DashboardMeetingContextProposal | null
  syncReadiness: DashboardMeetingSyncReadiness
  processing: DashboardMeetingProcessing
  artifactProcessing: DashboardMeetingArtifactProcessing
}

export interface MeetingHistoryResponse {
  meetings: DashboardMeetingSummary[]
}

export interface ActiveMeetingResponse {
  meeting: DashboardMeetingSummary | null
}

export interface MeetingDetailResponse {
  meeting: DashboardMeetingDetail
}

export interface DeleteMeetingResponse {
  deletedMeetingId: string
}

export interface MeetingNotionSyncResult {
  meetingId: string
  projectId: string
  notionProjectPageId: string
  notionTaskDatabaseId: string
  notionTaskDataSourceId: string | null
  createdDestination: boolean
  syncedCount: number
  skippedCount: number
}

export interface MeetingNotionSyncResponse extends MeetingDetailResponse {
  sync: MeetingNotionSyncResult
}

export interface SaveMeetingReviewActionItemRequest {
  taskContent: string
  deadline?: IsoDateTimeString | null
  assigneeId?: string | null
  status?: ActionItemStatus
}

export interface SaveMeetingReviewRequest {
  summary: string
  actionItems: SaveMeetingReviewActionItemRequest[]
}

export interface UpdateMeetingMetadataRequest {
  title?: string
  description?: string
  externalMeetingId?: string
  projectId?: string
}

export type MeetingsRequestStatus = "loading" | "ready" | "error"

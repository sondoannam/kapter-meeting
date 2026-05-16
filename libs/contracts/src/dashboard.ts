import type { AudioSourceType, CaptureContext } from "./capture";
import type {
  ActionItemStatus,
  IsoDateTimeString,
  MeetingArtifactReviewStatus,
  MeetingIngestionSource,
  MeetingStatus,
} from "./domain";
import type { MeetingSpeakerMapping } from "./voice-profiles";

export type NotionProjectDestinationMode = "PROJECT_PAGE" | "EXISTING_PAGE";

export type DashboardMeetingTranscriptMergeStrategy =
  | "PREFERRED_SELF_MIC_DUPLICATE"
  | "AMBIGUOUS_OVERLAP";

export interface DashboardMeetingSummary {
  id: string;
  title: string;
  status: MeetingStatus;
  ingestionSource: MeetingIngestionSource;
  artifactReviewStatus: MeetingArtifactReviewStatus;
  captureContext: CaptureContext | null;
  degradedWithoutSelfMic: boolean;
  activeSourceTypes: AudioSourceType[];
  externalMeetingId: string | null;
  projectId: string | null;
  projectTitle: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  totalDurationMs: number;
}

export interface DashboardMeetingSpeaker {
  id: string;
  aiLabel: string;
  realName: string | null;
  segmentCount: number;
  actionItemCount: number;
  voiceProfileId: string | null;
  voiceProfileName: string | null;
  isMapped: boolean;
  promotionEligible: boolean;
  recurringSpeakerProfileId: string | null;
  recurringMatchConfidence: number | null;
  recurringMatchSeenCount: number | null;
  recurringSuggestionLabel: string | null;
  speakerMapping: MeetingSpeakerMapping;
}

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
  deadline: IsoDateTimeString | null;
  status: ActionItemStatus;
  isSynced: boolean;
  notionPageId: string | null;
  assigneeId: string | null;
  assigneeAiLabel: string | null;
  assigneeRealName: string | null;
  createdAt: IsoDateTimeString;
}

export interface DashboardMeetingContextProposal {
  id: string;
  proposedContextMarkdown: string;
  changeSummary: string;
  status: "PENDING" | "APPLIED" | "DISMISSED";
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
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
    mode: NotionProjectDestinationMode | null;
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
  latestProcessedAt: IsoDateTimeString | null;
}

export interface DashboardMeetingArtifactProcessing {
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  pendingChunks: number;
  latestProcessedAt: IsoDateTimeString | null;
  finalizationStatus: string | null;
}

export interface DashboardMeetingDetail extends DashboardMeetingSummary {
  summary: string | null;
  artifactExtractionError: string | null;
  artifactApprovedAt: IsoDateTimeString | null;
  speakers: DashboardMeetingSpeaker[];
  transcriptSegments: DashboardMeetingTranscriptSegment[];
  actionItems: DashboardMeetingActionItem[];
  pendingContextProposal: DashboardMeetingContextProposal | null;
  syncReadiness: DashboardMeetingSyncReadiness;
  processing: DashboardMeetingProcessing;
  artifactProcessing: DashboardMeetingArtifactProcessing;
}

export interface MeetingHistoryResponse {
  meetings: DashboardMeetingSummary[];
}

export interface ActiveMeetingResponse {
  meeting: DashboardMeetingSummary | null;
}

export interface MeetingDetailResponse {
  meeting: DashboardMeetingDetail;
}

export interface CreateMeetingUploadRequest {
  title?: string;
  projectId?: string;
}

export interface MeetingUploadAcceptedResponse {
  status: "accepted";
  meeting: DashboardMeetingSummary;
}

export interface DeleteMeetingResponse {
  deletedMeetingId: string;
}

export interface MeetingNotionSyncResult {
  meetingId: string;
  projectId: string;
  notionProjectPageId: string;
  notionTaskDatabaseId: string;
  notionTaskDataSourceId: string | null;
  createdDestination: boolean;
  syncedCount: number;
  skippedCount: number;
}

export interface MeetingNotionSyncResponse extends MeetingDetailResponse {
  sync: MeetingNotionSyncResult;
}

export interface SaveMeetingReviewActionItemRequest {
  taskContent: string;
  deadline?: IsoDateTimeString | null;
  assigneeId?: string | null;
  status?: ActionItemStatus;
}

export interface SaveMeetingReviewRequest {
  summary: string;
  actionItems: SaveMeetingReviewActionItemRequest[];
}

export interface UpdateMeetingMetadataRequest {
  title?: string;
  description?: string;
  externalMeetingId?: string;
  projectId?: string;
}

export interface DashboardProjectSummary {
  id: string;
  title: string;
  description: string | null;
  isDraft: boolean;
  notionDestinationMode: NotionProjectDestinationMode | null;
  notionProjectPageId: string | null;
  notionTaskDatabaseId: string | null;
  meetingCount: number;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface DashboardProjectContextSnapshot {
  initialDescription: string | null;
  contextMarkdown: string | null;
}

export interface DashboardProjectMeetingSummary {
  id: string;
  title: string;
  status: MeetingStatus;
  externalMeetingId: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface DashboardProjectDetail extends DashboardProjectSummary {
  context: DashboardProjectContextSnapshot | null;
  recentMeetings: DashboardProjectMeetingSummary[];
}

export interface ProjectsResponse {
  projects: DashboardProjectSummary[];
}

export interface ProjectDetailResponse {
  project: DashboardProjectDetail;
}

export interface DeleteProjectResponse {
  deletedProjectId: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  initialDescription?: string;
  contextMarkdown?: string;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
  initialDescription?: string;
  contextMarkdown?: string;
  isDraft?: boolean;
}

export interface NotionWorkspaceSummary {
  id: string;
  name: string | null;
  icon: string | null;
}

export interface NotionConnectionStatus {
  provider: "notion";
  oauthConfigured: boolean;
  connected: boolean;
  workspace: NotionWorkspaceSummary | null;
  connectedAt: IsoDateTimeString | null;
}

export interface NotionConnectionResponse {
  notion: NotionConnectionStatus;
}

export interface CreateNotionAuthorizationResponse {
  authUrl: string;
}

export interface NotionPageSearchResult {
  id: string;
  title: string;
  url: string;
  lastEditedTime: IsoDateTimeString | null;
}

export interface NotionPagesSearchResponse {
  pages: NotionPageSearchResult[];
}

export interface ConfigureProjectNotionDestinationInput {
  parentPageId: string;
  mode: NotionProjectDestinationMode;
}

export type IsoDateTimeString = string;

export const MEETING_STATUS = {
  RECORDING: "RECORDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type MeetingStatus =
  (typeof MEETING_STATUS)[keyof typeof MEETING_STATUS];

export const MEETING_ARTIFACT_REVIEW_STATUS = {
  PENDING: "PENDING",
  READY: "READY",
  APPROVED: "APPROVED",
  FAILED: "FAILED",
} as const;

export type MeetingArtifactReviewStatus =
  (typeof MEETING_ARTIFACT_REVIEW_STATUS)[keyof typeof MEETING_ARTIFACT_REVIEW_STATUS];

export const ACTION_ITEM_STATUS = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
} as const;

export type ActionItemStatus =
  (typeof ACTION_ITEM_STATUS)[keyof typeof ACTION_ITEM_STATUS];

export const MEETING_AUDIO_BATCH_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type MeetingAudioBatchStatus =
  (typeof MEETING_AUDIO_BATCH_STATUS)[keyof typeof MEETING_AUDIO_BATCH_STATUS];

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  status: MeetingStatus;
  artifactReviewStatus: MeetingArtifactReviewStatus;
  artifactExtractionError: string | null;
  artifactApprovedAt: IsoDateTimeString | null;
  externalMeetingId: string | null;
  audioUrl: string | null;
  summary: string | null;
  userId: string;
  projectId: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  isDraft: boolean;
  notionProjectPageId: string | null;
  notionTaskDatabaseId: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ProjectContext {
  id: string;
  projectId: string;
  initialDescription: string | null;
  contextMarkdown: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface MeetingAudioBatch {
  id: string;
  meetingId: string;
  streamId: string;
  sequenceStart: number;
  sequenceEnd: number;
  streamOffsetMs: number;
  durationMs: number;
  mimeType: string;
  status: MeetingAudioBatchStatus;
  error: string | null;
  processedAt: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface SpeakerProfile {
  id: string;
  aiLabel: string;
  realName: string | null;
  meetingId: string;
  voiceProfileId: string | null;
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  content: string;
  speakerId: string;
  meetingId: string;
}

export interface TranscriptSegmentWithSpeaker extends TranscriptSegment {
  speaker: SpeakerProfile;
}

export interface ActionItem {
  id: string;
  taskContent: string;
  deadline: IsoDateTimeString | null;
  status: ActionItemStatus;
  isSynced: boolean;
  notionPageId: string | null;
  assigneeId: string | null;
  meetingId: string;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ActionItemWithAssignee extends ActionItem {
  assignee: SpeakerProfile | null;
}

export interface MeetingWithArtifacts extends Meeting {
  speakers: SpeakerProfile[];
  transcript: TranscriptSegmentWithSpeaker[];
  actionItems: ActionItemWithAssignee[];
}

import type { AudioSourceType, CaptureContext } from "./capture";

export interface WorkerAudioBatchRequest {
  streamId: string;
  backendMeetingId: string;
  sequenceStart: number;
  sequenceEnd: number;
  streamOffsetMs: number;
  durationMs: number;
  mimeType: string;
  audioBase64: string;
  isFinal?: boolean;
  captureContext?: CaptureContext;
  sourceType?: AudioSourceType;
  authoritativeSpeakerLabel?: string | null;
  knownVoiceProfileIds?: string[];
}

export interface WorkerTranscriptSegment {
  startTime: number;
  endTime: number;
  content: string;
  aiLabel: string;
  confidence: number | null;
  sourceType?: AudioSourceType;
  voiceProfileId?: string | null;
}

export interface WorkerSpeakerEvidence {
  aiLabel: string;
  voiceProfileId?: string | null;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  sourceType?: AudioSourceType;
  embedding: number[];
  rmsDb: number | null;
  speechRatio: number | null;
  qualityScore: number | null;
  sampleRate: number | null;
}

export interface WorkerVoiceProfileCacheUpsertRequest {
  voiceProfileId: string;
  displayName: string;
  isActive: boolean;
  embeddings: number[][];
}

export interface WorkerVoiceProfileCacheDeleteRequest {
  voiceProfileId: string;
}

export interface WorkerVoiceProfileEnrollmentRequest {
  mimeType: string;
  audioBase64: string;
}

export interface WorkerVoiceProfileEnrollmentResponse {
  embedding: number[];
  durationSeconds: number;
  rmsDb: number | null;
  speechRatio: number | null;
  qualityScore: number | null;
  sampleRate: number | null;
}

export interface WorkerTranscriptionResponse {
  streamId: string;
  backendMeetingId: string;
  sequenceStart: number;
  sequenceEnd: number;
  streamOffsetMs: number;
  segments: WorkerTranscriptSegment[];
  captureContext?: CaptureContext;
  sourceType?: AudioSourceType;
  speakerEvidence?: WorkerSpeakerEvidence[];
}

export interface WorkerFileTranscriptionBatch {
  sequenceStart: number;
  sequenceEnd: number;
  streamOffsetMs: number;
  durationMs: number;
  segments: WorkerTranscriptSegment[];
  speakerEvidence?: WorkerSpeakerEvidence[];
}

export interface WorkerFileTranscriptionResponse {
  streamId: string;
  backendMeetingId: string;
  sourceType?: AudioSourceType;
  batches: WorkerFileTranscriptionBatch[];
}

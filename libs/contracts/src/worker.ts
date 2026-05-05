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
}

export interface WorkerTranscriptSegment {
  startTime: number;
  endTime: number;
  content: string;
  aiLabel: string;
  confidence: number | null;
  sourceType?: AudioSourceType;
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
}

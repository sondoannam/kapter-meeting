import type { AudioSourceType, CaptureContext } from "@kapter/contracts";

export interface BufferedAudioChunk {
  sequence: number;
  buffer: Buffer;
  mimeType: string;
  durationMs: number;
}

export interface ActiveAudioSourceState {
  sourceType: AudioSourceType;
  mimeType: string | null;
  lastAcceptedSequence: number;
  bufferedDurationMs: number;
  streamOffsetMs: number;
  workerInFlight: boolean;
  flushPending: boolean;
  chunkQueue: BufferedAudioChunk[];
}

export const createActiveAudioSourceState = (
  sourceType: AudioSourceType,
): ActiveAudioSourceState => ({
  sourceType,
  mimeType: null,
  lastAcceptedSequence: 0,
  bufferedDurationMs: 0,
  streamOffsetMs: 0,
  workerInFlight: false,
  flushPending: false,
  chunkQueue: [],
});

export interface ActiveStreamSession {
  streamId: string;
  clientId: string;
  userId: string;
  clerkUserId: string;
  backendMeetingId: string;
  externalMeetingId: string | null;
  captureContext: CaptureContext | null;
  knownVoiceProfileIds: string[];
  stopRequested: boolean;
  audioSources: Partial<Record<AudioSourceType, ActiveAudioSourceState>>;
}

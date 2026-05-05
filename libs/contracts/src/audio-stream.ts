import type { AudioSourceType, CaptureContext } from "./capture";

export const AUDIO_STREAM_CLIENT_EVENTS = {
  START: "stream:start",
  READY: "stream:ready",
  CHUNK: "stream:chunk",
  STOP: "stream:stop",
} as const;

export const AUDIO_STREAM_SERVER_EVENTS = {
  START_ACK: "stream:ack",
  READY_ACK: "stream:ready:ack",
  CHUNK_ACK: "stream:chunk:ack",
  STOP_ACK: "stream:stop:ack",
} as const;

export type AudioStreamClientEventName =
  (typeof AUDIO_STREAM_CLIENT_EVENTS)[keyof typeof AUDIO_STREAM_CLIENT_EVENTS];

export type AudioStreamServerEventName =
  (typeof AUDIO_STREAM_SERVER_EVENTS)[keyof typeof AUDIO_STREAM_SERVER_EVENTS];

export interface StreamStartPayload {
  streamId: string;
  meetingId?: string;
  projectId?: string;
  captureContext?: CaptureContext;
}

export interface StreamReadyPayload {
  streamId: string;
  degradedWithoutSelfMic?: boolean;
}

export interface StreamChunkPayload {
  streamId: string;
  sequence: number;
  mimeType: string;
  payload: string;
  durationMs?: number;
  sourceType?: AudioSourceType;
}

export interface StreamStopPayload {
  streamId: string;
}

interface StreamAckBase {
  clientId: string;
  clerkUserId: string;
  userId: string;
  streamId: string;
}

export interface StreamStartAckPayload extends StreamAckBase {
  status: "accepted";
  backendMeetingId: string;
  captureContext?: CaptureContext;
}

export interface StreamChunkAckPayload extends StreamAckBase {
  status: "buffered";
  sequence: number;
}

export interface StreamReadyAckPayload extends StreamAckBase {
  status: "updated";
}

export interface StreamStopAckPayload extends StreamAckBase {
  status: "completed";
}

export type StreamAckPayload =
  | StreamStartAckPayload
  | StreamReadyAckPayload
  | StreamChunkAckPayload
  | StreamStopAckPayload;

export interface AudioStreamClientEventMap {
  "stream:start": StreamStartPayload;
  "stream:ready": StreamReadyPayload;
  "stream:chunk": StreamChunkPayload;
  "stream:stop": StreamStopPayload;
}

export interface AudioStreamServerEventMap {
  "stream:ack": StreamStartAckPayload;
  "stream:ready:ack": StreamReadyAckPayload;
  "stream:chunk:ack": StreamChunkAckPayload;
  "stream:stop:ack": StreamStopAckPayload;
}

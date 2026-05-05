import type { WorkerAudioBatchRequest } from "@kapter/contracts";

import type {
  ActiveAudioSourceState,
  ActiveStreamSession,
  BufferedAudioChunk,
} from "./active-stream-session.type";
import {
  DEFAULT_AUDIO_SOURCE_TYPE,
  resolveAudioSourceType,
} from "./audio-source.utils";

export interface BufferedAudioBatchWindow {
  durationMs: number;
  sequenceStart: number;
  sequenceEnd: number;
  request: WorkerAudioBatchRequest;
}

export const decodeAudioChunkPayload = (payload: string): Buffer => {
  const buffer = Buffer.from(payload, "base64");

  if (buffer.length === 0 && payload.length > 0) {
    throw new Error("Audio chunk payload is not valid base64.");
  }

  return buffer;
};

export const createBufferedAudioBatch = (
  session: ActiveStreamSession,
  sourceState: ActiveAudioSourceState,
  sourceType: WorkerAudioBatchRequest["sourceType"],
  chunks: BufferedAudioChunk[],
  isFinal = false,
): BufferedAudioBatchWindow => {
  if (chunks.length === 0) {
    throw new Error("Cannot build an audio batch from an empty chunk queue.");
  }

  const firstChunk = chunks[0]!;
  const lastChunk = chunks[chunks.length - 1]!;
  const durationMs = chunks.reduce(
    (totalDuration, chunk) => totalDuration + chunk.durationMs,
    0,
  );
  const resolvedSourceType = resolveAudioSourceType(
    sourceType ?? DEFAULT_AUDIO_SOURCE_TYPE,
  );

  return {
    durationMs,
    sequenceStart: firstChunk.sequence,
    sequenceEnd: lastChunk.sequence,
    request: {
      streamId: session.streamId,
      backendMeetingId: session.backendMeetingId,
      captureContext: session.captureContext ?? undefined,
      sourceType: resolvedSourceType,
      authoritativeSpeakerLabel:
        resolvedSourceType === "self_mic" ? "RECORDER" : undefined,
      sequenceStart: firstChunk.sequence,
      sequenceEnd: lastChunk.sequence,
      streamOffsetMs: sourceState.streamOffsetMs,
      durationMs,
      mimeType: sourceState.mimeType ?? firstChunk.mimeType,
      audioBase64: Buffer.concat(chunks.map((chunk) => chunk.buffer)).toString(
        "base64",
      ),
      isFinal,
    },
  };
};

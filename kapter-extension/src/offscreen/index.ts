import { io, type Socket } from "socket.io-client";
import type { AudioSourceType } from "@kapter/contracts";

import { isGoogleMeetDualLaneCaptureEnabled } from "@/shared/lib/feature-flags";
import { isMeetLocalMicExplicitlyUnmuted } from "@/shared/lib/google-meet-local-mic";

import type {
  MeetLocalMicState,
  OffscreenStartPayload,
  StreamAckPayload,
  StreamChunkPayload,
  StreamReadyPayload,
  StreamStartPayload,
  StreamStopPayload,
} from "@/shared/types/messages";

const RAW_SOCKET_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_WS_URL?.trim() ||
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL?.trim() ||
  "http://localhost:3001";
const AUDIO_STREAM_NAMESPACE = "/audio-stream";
const CHUNK_INTERVAL_MS = 2_000;
const SOCKET_CONNECT_TIMEOUT_MS = 10_000;
const SOCKET_ACK_TIMEOUT_MS = 60_000;
const PCM_BUFFER_SIZE = 4096;
const PCM_CHANNEL_COUNT = 1;
const PCM_ENCODING = "s16le";
const DEFAULT_AUDIO_SOURCE_TYPE: AudioSourceType = "tab_mix";
const SELF_MIC_AUDIO_SOURCE_TYPE: AudioSourceType = "self_mic";

interface ActiveRecordingSession {
  epoch: number;
  sessionId: string;
  streamId: string;
  meetingId: string;
  projectId?: string | null;
  captureContext?: OffscreenStartPayload["captureContext"];
  sessionToken: string;
}

interface QueuedChunk {
  bytes: Uint8Array;
  durationMs: number;
  epoch: number;
  mimeType: string;
  sequence: number;
  sourceType: AudioSourceType;
  streamId: string;
}

interface PcmCapturePipeline {
  sourceType: AudioSourceType;
  audioContext: AudioContext;
  outputNode: GainNode;
  processorNode: ScriptProcessorNode;
  sourceNode: MediaStreamAudioSourceNode;
  bufferedChunks: Uint8Array[];
  bufferedFrameCount: number;
  chunkFrameTarget: number;
  mimeType: string;
  sampleRate: number;
  playbackElement?: HTMLAudioElement;
}

interface ActiveCaptureSource {
  sourceType: AudioSourceType;
  stream: MediaStream | null;
  pipeline: PcmCapturePipeline | null;
  nextSequence: number;
}

let activeSession: ActiveRecordingSession | null = null;
let activeSources: Partial<Record<AudioSourceType, ActiveCaptureSource>> = {};
let transportSocket: Socket | null = null;
let detachDisconnectHandler: (() => void) | null = null;
let sessionEpoch = 0;
let queuedChunks: QueuedChunk[] = [];
let chunkProcessorEpoch: number | null = null;
let chunkProcessorPromise: Promise<void> | null = null;
let stopInProgress = false;
let lastKnownMeetLocalMicState: MeetLocalMicState = "unknown";

function sendDebug(message: string): void {
  console.log(`[offscreen] ${message}`);
  chrome.runtime
    .sendMessage({ type: "DEBUG_LOG", payload: { msg: message } })
    .catch(() => undefined);
}

function normalizeSocketBaseUrl(rawUrl: string): string {
  try {
    const candidate = new URL(rawUrl);

    if (candidate.protocol === "ws:") {
      candidate.protocol = "http:";
    } else if (candidate.protocol === "wss:") {
      candidate.protocol = "https:";
    }

    return candidate.origin;
  } catch {
    return "http://localhost:3001";
  }
}

function getSocketNamespaceUrl(): string {
  return `${normalizeSocketBaseUrl(RAW_SOCKET_URL)}${AUDIO_STREAM_NAMESPACE}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }

  return btoa(binary);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  return arrayBufferToBase64(Uint8Array.from(bytes).buffer);
}

function buildPcmMimeType(sampleRate: number): string {
  return `audio/pcm;rate=${sampleRate};channels=${PCM_CHANNEL_COUNT};encoding=${PCM_ENCODING}`;
}

function mergeByteChunks(chunks: Uint8Array[]): Uint8Array {
  const totalByteLength = chunks.reduce(
    (combinedLength, chunk) => combinedLength + chunk.byteLength,
    0,
  );
  const combinedChunk = new Uint8Array(totalByteLength);
  let offset = 0;

  for (const chunk of chunks) {
    combinedChunk.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combinedChunk;
}

function convertFloat32ToPcm16(samples: Float32Array): Uint8Array {
  const pcmBytes = new Uint8Array(samples.length * 2);
  const pcmView = new DataView(pcmBytes.buffer);

  for (let index = 0; index < samples.length; index += 1) {
    const clampedSample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    const scaledSample =
      clampedSample < 0
        ? Math.round(clampedSample * 0x8000)
        : Math.round(clampedSample * 0x7fff);

    pcmView.setInt16(index * 2, scaledSample, true);
  }

  return pcmBytes;
}

function mixInputBufferToMono(inputBuffer: AudioBuffer): Float32Array {
  const channelCount = inputBuffer.numberOfChannels;
  const monoSamples = new Float32Array(inputBuffer.length);

  if (channelCount === 0) {
    return monoSamples;
  }

  if (channelCount === 1) {
    monoSamples.set(inputBuffer.getChannelData(0));
    return monoSamples;
  }

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channelSamples = inputBuffer.getChannelData(channelIndex);

    for (
      let sampleIndex = 0;
      sampleIndex < inputBuffer.length;
      sampleIndex += 1
    ) {
      monoSamples[sampleIndex] +=
        (channelSamples[sampleIndex] ?? 0) / channelCount;
    }
  }

  return monoSamples;
}

function getActiveSessionForEpoch(
  epoch: number,
): ActiveRecordingSession | null {
  return activeSession?.epoch === epoch ? activeSession : null;
}

function getActiveSource(
  sourceType: AudioSourceType,
): ActiveCaptureSource | null {
  return activeSources[sourceType] ?? null;
}

function registerActiveSource(
  sourceType: AudioSourceType,
  source: Omit<ActiveCaptureSource, "sourceType">,
): ActiveCaptureSource {
  const activeSource: ActiveCaptureSource = {
    sourceType,
    ...source,
  };

  activeSources[sourceType] = activeSource;
  return activeSource;
}

function listActiveSourceTypes(): AudioSourceType[] {
  return Object.values(activeSources)
    .filter((source): source is ActiveCaptureSource => !!source)
    .map((source) => source.sourceType);
}

function shouldCaptureSelfMic(
  captureContext: OffscreenStartPayload["captureContext"],
  meetLocalMicState?: MeetLocalMicState,
): boolean {
  return (
    captureContext === "google_meet_room" &&
    isMeetLocalMicExplicitlyUnmuted(meetLocalMicState) &&
    isGoogleMeetDualLaneCaptureEnabled()
  );
}

async function createMicrophoneStream(): Promise<MediaStream> {
  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });

    if (stream.getAudioTracks().length === 0) {
      throw new Error("No microphone audio track is available.");
    }

    return stream;
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    throw error;
  }
}

function formatSelfMicUnavailableReason(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Microphone permission was denied. Continuing with shared tab audio only.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No microphone device is available. Continuing with shared tab audio only.";
      case "NotReadableError":
      case "TrackStartError":
        return "The microphone is busy or unavailable. Continuing with shared tab audio only.";
      default:
        break;
    }
  }

  if (error instanceof Error && error.message) {
    return `${error.message} Continuing with shared tab audio only.`;
  }

  return "Recorder microphone capture is unavailable. Continuing with shared tab audio only.";
}

async function maybeStartSelfMicCapture(
  captureContext: OffscreenStartPayload["captureContext"],
  meetLocalMicState?: MeetLocalMicState,
): Promise<{
  degradedWithoutSelfMic: boolean;
  degradedReason?: string;
}> {
  if (
    captureContext === "google_meet_room" &&
    !isGoogleMeetDualLaneCaptureEnabled()
  ) {
    sendDebug(
      "Google Meet self-mic capture is disabled by feature flag; continuing with shared tab audio only.",
    );

    return { degradedWithoutSelfMic: false };
  }

  if (
    captureContext === "google_meet_room" &&
    !isMeetLocalMicExplicitlyUnmuted(meetLocalMicState)
  ) {
    const degradedReason =
      meetLocalMicState === "muted"
        ? "Google Meet local microphone is muted. Continuing with shared tab audio only."
        : "Google Meet local microphone is not explicitly unmuted. Continuing with shared tab audio only.";

    sendDebug(degradedReason);

    return {
      degradedWithoutSelfMic: false,
      degradedReason,
    };
  }

  if (!shouldCaptureSelfMic(captureContext, meetLocalMicState)) {
    return { degradedWithoutSelfMic: false };
  }

  let microphoneStream: MediaStream | null = null;

  try {
    microphoneStream = await createMicrophoneStream();
    registerActiveSource(SELF_MIC_AUDIO_SOURCE_TYPE, {
      stream: microphoneStream,
      pipeline: null,
      nextSequence: 0,
    });

    const selfMicPipeline = await setupPcmCapturePipeline(
      SELF_MIC_AUDIO_SOURCE_TYPE,
      microphoneStream,
    );
    const selfMicSource = getActiveSource(SELF_MIC_AUDIO_SOURCE_TYPE);

    if (selfMicSource) {
      selfMicSource.pipeline = selfMicPipeline;
    }

    sendDebug("Recorder microphone capture enabled.");

    return { degradedWithoutSelfMic: false };
  } catch (error: unknown) {
    microphoneStream?.getTracks().forEach((track) => track.stop());
    delete activeSources[SELF_MIC_AUDIO_SOURCE_TYPE];

    const degradedReason = formatSelfMicUnavailableReason(error);
    sendDebug(degradedReason);

    return {
      degradedWithoutSelfMic: true,
      degradedReason,
    };
  }
}

function clearQueuedChunks(epoch?: number): void {
  if (typeof epoch === "number") {
    queuedChunks = queuedChunks.filter((chunk) => chunk.epoch !== epoch);
    return;
  }

  queuedChunks = [];
}

function clearQueuedChunksForSource(sourceType: AudioSourceType): void {
  queuedChunks = queuedChunks.filter(
    (chunk) => chunk.sourceType !== sourceType,
  );
}

async function connectTransportSocket(initialToken: string): Promise<Socket> {
  let currentToken = initialToken;

  const socket = io(getSocketNamespaceUrl(), {
    auth: (cb) => {
      cb({
        token: currentToken,
      });
    },
    autoConnect: false,
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: SOCKET_CONNECT_TIMEOUT_MS,
    transports: ["websocket"],
  });

  socket.on("connect_error", async (error) => {
    sendDebug(`Connection error: ${error.message}`);

    if (/unauthorized|token|session/i.test(error.message)) {
      sendDebug("Auth error detected during connect, requesting refresh...");
      const refreshResult = await chrome.runtime.sendMessage({
        type: "AUTH_REFRESH_TOKEN",
      });

      if (refreshResult?.success) {
        const freshAuth = await chrome.runtime.sendMessage({
          type: "AUTH_GET_STATE",
        });
        if (freshAuth?.success && freshAuth.data.sessionToken) {
          currentToken = freshAuth.data.sessionToken;
          sendDebug("Token refreshed successfully, retrying connection...");
          // Socket.io will automatically retry with the new token because auth is a function
        }
      } else {
        sendDebug(
          "Silent refresh failed. Recording might stop if connection cannot be recovered.",
        );
      }
    }
  });

  return await new Promise<Socket>((resolve, reject) => {
    const handleConnect = () => {
      cleanup();
      resolve(socket);
    };

    const handleConnectError = (error: Error) => {
      // Only reject initial connection if it's not a transient error
      // If reconnection is on, this might not be called the same way
      if (!socket.active) {
        cleanup();
        socket.disconnect();
        reject(
          new Error(
            `Audio gateway initial connection failed: ${error.message || "Unknown error"}`,
          ),
        );
      }
    };

    const cleanup = () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
    };

    socket.once("connect", handleConnect);
    socket.once("connect_error", handleConnectError);
    socket.connect();
  });
}

function attachDisconnectListener(socket: Socket): void {
  detachDisconnectHandler?.();
  detachDisconnectHandler = null;

  const handleDisconnect = (reason: string) => {
    if (socket !== transportSocket || stopInProgress || !activeSession) {
      return;
    }

    sendDebug(`Audio gateway disconnected: ${reason}`);

    if (reason === "io server disconnect") {
      // The server kicked us. This might be due to an expired session.
      // We'll try to refresh the token and reconnect manually once.
      sendDebug(
        "Server-side disconnect detected, attempting one-time manual reconnect with fresh auth...",
      );
      void (async () => {
        const refreshResult = await chrome.runtime.sendMessage({
          type: "AUTH_REFRESH_TOKEN",
        });

        if (refreshResult?.success) {
          const freshAuth = await chrome.runtime.sendMessage({
            type: "AUTH_GET_STATE",
          });
          if (freshAuth?.success && freshAuth.data.sessionToken) {
            // Socket.io won't auto-reconnect on "io server disconnect", so we call connect()
            socket.connect();
            return;
          }
        }

        void handleFatalError(
          `Audio gateway forcefully closed the connection: ${reason}`,
          activeSession?.streamId,
        );
      })();
    } else if (reason === "io client disconnect") {
      // Manual stop, not an error
    } else {
      // Recoverable: transport close, ping timeout, etc.
      // Socket.io will handle the reconnection logic automatically.
      sendDebug("Waiting for automatic socket reconnection...");
    }
  };

  detachDisconnectHandler = () => {
    socket.off("disconnect", handleDisconnect);
  };

  socket.on("disconnect", handleDisconnect);
}

async function emitWithAck(
  socket: Socket,
  eventName: "stream:start" | "stream:ready" | "stream:chunk" | "stream:stop",
  ackEventName:
    | "stream:ack"
    | "stream:ready:ack"
    | "stream:chunk:ack"
    | "stream:stop:ack",
  payload:
    | StreamStartPayload
    | StreamReadyPayload
    | StreamChunkPayload
    | StreamStopPayload,
  timeoutMessage: string,
): Promise<StreamAckPayload> {
  return await new Promise<StreamAckPayload>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, SOCKET_ACK_TIMEOUT_MS);

    const handleAck = (ackPayload: StreamAckPayload) => {
      cleanup();
      resolve(ackPayload);
    };

    const handleDisconnect = (reason: string) => {
      cleanup();
      reject(
        new Error(
          `Audio gateway disconnected before acknowledging ${eventName}: ${reason}`,
        ),
      );
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off(ackEventName, handleAck);
      socket.off("disconnect", handleDisconnect);
    };

    socket.once(ackEventName, handleAck);
    socket.once("disconnect", handleDisconnect);
    socket.emit(eventName, payload);
  });
}

async function createCapturedTabStream(
  tabStreamId: string,
): Promise<MediaStream> {
  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: tabStreamId,
        },
      } as unknown as MediaTrackConstraints,
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: tabStreamId,
        },
      } as unknown as MediaTrackConstraints,
    });

    stream.getVideoTracks().forEach((track) => track.stop());

    if (stream.getAudioTracks().length === 0) {
      throw new Error("No audio track is available from the captured tab.");
    }

    return stream;
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    throw error;
  }
}

function enqueueChunk(chunk: {
  bytes: Uint8Array;
  durationMs: number;
  epoch: number;
  mimeType: string;
  sourceType: AudioSourceType;
  streamId: string;
}): void {
  if (!activeSession) {
    return;
  }

  const source = getActiveSource(chunk.sourceType);

  if (!source) {
    return;
  }

  const sequence = ++source.nextSequence;

  queuedChunks.push({
    bytes: chunk.bytes,
    durationMs: chunk.durationMs,
    epoch: chunk.epoch,
    mimeType: chunk.mimeType,
    sequence,
    sourceType: chunk.sourceType,
    streamId: chunk.streamId,
  });

  if (chunkProcessorEpoch === chunk.epoch) {
    return;
  }

  chunkProcessorEpoch = chunk.epoch;
  chunkProcessorPromise = processQueuedChunks(chunk.epoch).finally(() => {
    if (chunkProcessorEpoch === chunk.epoch) {
      chunkProcessorEpoch = null;
      chunkProcessorPromise = null;
    }
  });
}

function flushBufferedPcmChunk(
  sourceType: AudioSourceType,
  force = false,
): void {
  const session = activeSession;
  const pipeline = getActiveSource(sourceType)?.pipeline;

  if (!session || !pipeline || pipeline.bufferedFrameCount === 0) {
    return;
  }

  if (!force && pipeline.bufferedFrameCount < pipeline.chunkFrameTarget) {
    return;
  }

  const bytes = mergeByteChunks(pipeline.bufferedChunks);
  const durationMs = Math.max(
    1,
    Math.round((pipeline.bufferedFrameCount / pipeline.sampleRate) * 1000),
  );

  pipeline.bufferedChunks = [];
  pipeline.bufferedFrameCount = 0;

  enqueueChunk({
    bytes,
    durationMs,
    epoch: session.epoch,
    mimeType: pipeline.mimeType,
    sourceType,
    streamId: session.streamId,
  });
}

function handlePcmAudioProcess(
  sourceType: AudioSourceType,
  event: AudioProcessingEvent,
): void {
  const pipeline = getActiveSource(sourceType)?.pipeline;

  if (!pipeline) {
    return;
  }

  if (
    sourceType === SELF_MIC_AUDIO_SOURCE_TYPE &&
    !isMeetLocalMicExplicitlyUnmuted(lastKnownMeetLocalMicState)
  ) {
    pipeline.bufferedChunks = [];
    pipeline.bufferedFrameCount = 0;
    return;
  }

  const monoSamples = mixInputBufferToMono(event.inputBuffer);

  if (monoSamples.length === 0) {
    return;
  }

  pipeline.bufferedChunks.push(convertFloat32ToPcm16(monoSamples));
  pipeline.bufferedFrameCount += monoSamples.length;
  flushBufferedPcmChunk(sourceType);
}

async function processQueuedChunks(epoch: number): Promise<void> {
  while (getActiveSessionForEpoch(epoch)) {
    const nextChunkIndex = queuedChunks.findIndex(
      (chunk) => chunk.epoch === epoch,
    );

    if (nextChunkIndex === -1) {
      return;
    }

    const nextChunk = queuedChunks[nextChunkIndex];

    if (
      nextChunk.sourceType === SELF_MIC_AUDIO_SOURCE_TYPE &&
      !isMeetLocalMicExplicitlyUnmuted(lastKnownMeetLocalMicState)
    ) {
      queuedChunks.splice(nextChunkIndex, 1);
      sendDebug(
        `Dropped queued self-mic chunk #${nextChunk.sequence} because the local Meet microphone state is ${lastKnownMeetLocalMicState}, not explicitly unmuted.`,
      );
      continue;
    }

    try {
      const socket = transportSocket;

      if (!socket) {
        throw new Error(
          "Audio transport is unavailable while processing queued chunks.",
        );
      }

      const currentSession = getActiveSessionForEpoch(epoch);

      if (!currentSession) {
        clearQueuedChunks(epoch);
        return;
      }

      // If disconnected, wait for reconnection with a timeout
      if (!socket.connected) {
        sendDebug("Socket disconnected, pausing chunk transmission...");
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            socket.off("connect", handleConnect);
            reject(new Error("Reconnection timed out after 45s."));
          }, 45_000);

          const handleConnect = () => {
            clearTimeout(timeoutId);
            socket.off("connect", handleConnect);
            resolve();
          };
          socket.on("connect", handleConnect);
        });
        sendDebug("Socket reconnected, resuming transmission.");
        continue; // Check session and chunk index again
      }

      const chunkPayload: StreamChunkPayload = {
        streamId: currentSession.streamId,
        sequence: nextChunk.sequence,
        mimeType: nextChunk.mimeType,
        payload: uint8ArrayToBase64(nextChunk.bytes),
        durationMs: nextChunk.durationMs,
        sourceType: nextChunk.sourceType,
      };

      await emitWithAck(
        socket,
        "stream:chunk",
        "stream:chunk:ack",
        chunkPayload,
        `Timed out while waiting for acknowledgement of audio chunk #${nextChunk.sequence}.`,
      );

      if (!getActiveSessionForEpoch(epoch)) {
        clearQueuedChunks(epoch);
        return;
      }

      const completedChunkIndex = queuedChunks.findIndex(
        (chunk) =>
          chunk.epoch === nextChunk.epoch &&
          chunk.sequence === nextChunk.sequence,
      );

      if (completedChunkIndex !== -1) {
        queuedChunks.splice(completedChunkIndex, 1);
      }

      await chrome.runtime.sendMessage({
        type: "CHUNK_SENT",
        payload: {
          sequence: nextChunk.sequence,
          byteLength: nextChunk.bytes.byteLength,
        },
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // If the error is due to a disconnect during emission, we don't treat it as fatal.
      // We loop back and the "!socket.connected" check above will handle waiting.
      if (
        /disconnected before acknowledging/i.test(errorMessage) ||
        /transport is unavailable/i.test(errorMessage)
      ) {
        sendDebug(
          `Chunk #${nextChunk.sequence} failed due to disconnect. Retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      clearQueuedChunks(epoch);
      await handleFatalError(errorMessage, nextChunk.streamId);
      return;
    }
  }

  clearQueuedChunks(epoch);
}

async function setupPcmCapturePipeline(
  sourceType: AudioSourceType,
  stream: MediaStream,
): Promise<PcmCapturePipeline> {
  const audioContext = new AudioContext();
  await audioContext.resume();

  const sourceNode = audioContext.createMediaStreamSource(stream);
  const processorNode = audioContext.createScriptProcessor(
    PCM_BUFFER_SIZE,
    sourceNode.channelCount || PCM_CHANNEL_COUNT,
    PCM_CHANNEL_COUNT,
  );
  const outputNode = audioContext.createGain();
  // Chỉ phát lại âm thanh của tab để người dùng có thể nghe thấy cuộc họp.
  // Không phát lại âm thanh từ mic của chính họ để tránh bị vọng âm (echo).
  outputNode.gain.value = sourceType === "tab_mix" ? 1 : 0;

  const sampleRate = audioContext.sampleRate;
  
  let playbackElement: HTMLAudioElement | undefined;
  if (sourceType === "tab_mix") {
    playbackElement = document.createElement("audio");
    playbackElement.srcObject = stream;
    playbackElement.autoplay = true;
    playbackElement.muted = false;
    document.body.appendChild(playbackElement);
    playbackElement.play().catch(() => {
      sendDebug("Failed to play tab_mix audio element automatically.");
    });
  }

  const pipeline: PcmCapturePipeline = {
    sourceType,
    audioContext,
    outputNode,
    processorNode,
    sourceNode,
    bufferedChunks: [],
    bufferedFrameCount: 0,
    chunkFrameTarget: Math.max(
      PCM_BUFFER_SIZE,
      Math.round((sampleRate * CHUNK_INTERVAL_MS) / 1000),
    ),
    mimeType: buildPcmMimeType(sampleRate),
    sampleRate,
    playbackElement,
  };

  processorNode.onaudioprocess = (event) => {
    handlePcmAudioProcess(sourceType, event);
  };
  sourceNode.connect(processorNode);
  // ScriptProcessorNode vẫn cần được connect tới destination để sự kiện onaudioprocess luôn chạy trên Chrome
  processorNode.connect(audioContext.destination);
  
  // Vẫn connect Web Audio API để tránh lỗi, nhưng âm lượng đã được mute trong outputNode
  sourceNode.connect(outputNode);
  outputNode.connect(audioContext.destination);

  sendDebug(`PCM capture started for ${sourceType} at ${sampleRate} Hz.`);

  return pipeline;
}

async function stopSourceCapture(
  sourceType: AudioSourceType,
  options?: {
    discardBufferedAudio?: boolean;
    clearQueuedAudio?: boolean;
  },
): Promise<void> {
  const source = getActiveSource(sourceType);

  if (!source) {
    return;
  }

  if (options?.clearQueuedAudio) {
    clearQueuedChunksForSource(sourceType);
  }

  if (source.pipeline) {
    const pipeline = source.pipeline;

    if (options?.discardBufferedAudio) {
      pipeline.bufferedChunks = [];
      pipeline.bufferedFrameCount = 0;
    } else {
      flushBufferedPcmChunk(sourceType, true);
    }

    source.pipeline = null;
    pipeline.processorNode.onaudioprocess = null;
    pipeline.sourceNode.disconnect();
    pipeline.processorNode.disconnect();
    pipeline.outputNode.disconnect();
    await pipeline.audioContext.close().catch(() => undefined);
    sendDebug(
      `PCM capture stopped for ${sourceType} after ${source.nextSequence} chunk(s).`,
    );
  }

  if (source.stream) {
    source.stream.getTracks().forEach((track) => track.stop());
    source.stream = null;
  }

  delete activeSources[sourceType];
}

async function handleMeetLocalMicStateChanged(
  state: MeetLocalMicState,
): Promise<void> {
  lastKnownMeetLocalMicState = state;

  const session = activeSession;

  if (!session || session.captureContext !== "google_meet_room") {
    return;
  }

  if (state !== "muted") {
    return;
  }

  if (!getActiveSource(SELF_MIC_AUDIO_SOURCE_TYPE)) {
    return;
  }

  await stopSourceCapture(SELF_MIC_AUDIO_SOURCE_TYPE, {
    discardBufferedAudio: true,
    clearQueuedAudio: true,
  });
  sendDebug(
    "Google Meet local microphone is muted; dropped recorder microphone capture for the active session.",
  );
}

async function stopCapturePipelineGracefully(): Promise<void> {
  const sources = Object.values(activeSources).filter(
    (source): source is ActiveCaptureSource => !!source,
  );

  for (const source of sources) {
    const pipeline = source.pipeline;

    if (!pipeline) {
      continue;
    }

    flushBufferedPcmChunk(source.sourceType, true);
    source.pipeline = null;
    pipeline.processorNode.onaudioprocess = null;
    pipeline.sourceNode.disconnect();
    pipeline.processorNode.disconnect();
    pipeline.outputNode.disconnect();
    
    if (pipeline.playbackElement) {
      pipeline.playbackElement.pause();
      pipeline.playbackElement.srcObject = null;
      pipeline.playbackElement.remove();
    }

    await pipeline.audioContext.close().catch(() => undefined);
    sendDebug(
      `PCM capture stopped for ${source.sourceType} after ${source.nextSequence} chunk(s).`,
    );
  }
}

function releaseCaptureResources(): void {
  for (const source of Object.values(activeSources).filter(
    (activeSource): activeSource is ActiveCaptureSource => !!activeSource,
  )) {
    if (source.pipeline) {
      source.pipeline.processorNode.onaudioprocess = null;
      if (source.pipeline.playbackElement) {
        source.pipeline.playbackElement.pause();
        source.pipeline.playbackElement.srcObject = null;
        source.pipeline.playbackElement.remove();
      }
      source.pipeline.sourceNode.disconnect();
      source.pipeline.processorNode.disconnect();
      source.pipeline.outputNode.disconnect();
      void source.pipeline.audioContext.close().catch(() => undefined);
      source.pipeline = null;
    }

    if (source.stream) {
      source.stream.getTracks().forEach((track) => track.stop());
      source.stream = null;
    }
  }

  activeSources = {};

  detachDisconnectHandler?.();
  detachDisconnectHandler = null;

  if (transportSocket) {
    transportSocket.removeAllListeners();
    transportSocket.disconnect();
    transportSocket = null;
  }

  clearQueuedChunks();
  chunkProcessorEpoch = null;
  chunkProcessorPromise = null;
  lastKnownMeetLocalMicState = "unknown";
}

async function handleFatalError(
  errorMessage: string,
  streamId = activeSession?.streamId,
): Promise<void> {
  if (!activeSession && !streamId) {
    return;
  }

  sendDebug(errorMessage);
  stopInProgress = false;
  releaseCaptureResources();
  activeSession = null;

  await chrome.runtime.sendMessage({
    type: "OFFSCREEN_ERROR",
    payload: { streamId, error: errorMessage },
  });
}

async function startCapture(payload: OffscreenStartPayload): Promise<void> {
  if (activeSession) {
    throw new Error("A recording session is already active.");
  }

  sendDebug(`Starting offscreen capture for ${payload.streamId}.`);

  const stream = await createCapturedTabStream(payload.tabStreamId);
  const socket = await connectTransportSocket(payload.sessionToken);
  const streamStartPayload: StreamStartPayload = {
    streamId: payload.streamId,
    meetingId: payload.meetingId,
    projectId: payload.projectId ?? undefined,
    captureContext: payload.captureContext,
  };

  activeSession = {
    ...payload,
    epoch: ++sessionEpoch,
  };
  lastKnownMeetLocalMicState = payload.meetLocalMicState ?? "unknown";
  activeSources = {};
  registerActiveSource(DEFAULT_AUDIO_SOURCE_TYPE, {
    stream,
    pipeline: null,
    nextSequence: 0,
  });
  transportSocket = socket;
  clearQueuedChunks();
  chunkProcessorEpoch = null;
  chunkProcessorPromise = null;

  attachDisconnectListener(socket);

  await emitWithAck(
    socket,
    "stream:start",
    "stream:ack",
    streamStartPayload,
    "Timed out while waiting for the audio gateway to accept the stream.",
  );

  const tabMixPipeline = await setupPcmCapturePipeline(
    DEFAULT_AUDIO_SOURCE_TYPE,
    stream,
  );
  const tabMixSource = getActiveSource(DEFAULT_AUDIO_SOURCE_TYPE);

  if (tabMixSource) {
    tabMixSource.pipeline = tabMixPipeline;
  }

  const selfMicStatus = await maybeStartSelfMicCapture(
    payload.captureContext,
    payload.meetLocalMicState,
  );

  const streamReadyPayload: StreamReadyPayload = {
    streamId: payload.streamId,
    degradedWithoutSelfMic: selfMicStatus.degradedWithoutSelfMic,
  };

  await emitWithAck(
    socket,
    "stream:ready",
    "stream:ready:ack",
    streamReadyPayload,
    "Timed out while waiting for the audio gateway to persist capture readiness state.",
  );

  await chrome.runtime.sendMessage({
    type: "OFFSCREEN_RECORDING_STARTED",
    payload: {
      sessionId: payload.sessionId,
      streamId: payload.streamId,
      meetingId: payload.meetingId,
      projectId: payload.projectId ?? undefined,
      captureContext: payload.captureContext,
      activeSourceTypes: listActiveSourceTypes(),
      degradedWithoutSelfMic: selfMicStatus.degradedWithoutSelfMic,
      degradedReason: selfMicStatus.degradedReason,
    },
  });
}

async function stopCapture(expectedStreamId?: string): Promise<void> {
  const session = activeSession;

  if (!session) {
    await chrome.runtime.sendMessage({
      type: "OFFSCREEN_STOPPED",
      payload: { streamId: expectedStreamId ?? "unknown" },
    });
    return;
  }

  if (expectedStreamId && session.streamId !== expectedStreamId) {
    throw new Error(
      `Refused to stop stream ${expectedStreamId} because ${session.streamId} is active.`,
    );
  }

  stopInProgress = true;
  sendDebug(`Stopping offscreen capture for ${session.streamId}.`);

  await stopCapturePipelineGracefully();
  await chunkProcessorPromise;

  if (transportSocket) {
    const stopPayload: StreamStopPayload = {
      streamId: session.streamId,
    };

    await emitWithAck(
      transportSocket,
      "stream:stop",
      "stream:stop:ack",
      stopPayload,
      "Timed out while waiting for the audio gateway to confirm stream shutdown.",
    );
  }

  releaseCaptureResources();
  activeSession = null;
  stopInProgress = false;

  await chrome.runtime.sendMessage({
    type: "OFFSCREEN_STOPPED",
    payload: { streamId: session.streamId },
  });
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: Record<string, string> },
    _sender,
    sendResponse,
  ) => {
    switch (message.type) {
      case "PING": {
        sendResponse("PONG");
        return;
      }

      case "OFFSCREEN_START": {
        const payload = message.payload as OffscreenStartPayload | undefined;

        if (
          !payload?.sessionId ||
          !payload.streamId ||
          !payload.meetingId ||
          !payload.sessionToken ||
          !payload.tabStreamId
        ) {
          void handleFatalError(
            "Received OFFSCREEN_START without the required stream context.",
          );
          break;
        }

        void startCapture(payload).catch((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          void handleFatalError(errorMessage, payload.streamId);
        });
        break;
      }

      case "OFFSCREEN_STOP": {
        const streamId = message.payload?.streamId;

        void stopCapture(streamId).catch((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          void handleFatalError(errorMessage, streamId);
        });
        break;
      }

      case "OFFSCREEN_MEET_LOCAL_MIC_STATE_CHANGED": {
        const state = message.payload?.state;

        if (state === "muted" || state === "unmuted" || state === "unknown") {
          void handleMeetLocalMicStateChanged(state).catch((error: unknown) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            void handleFatalError(errorMessage, activeSession?.streamId);
          });
        }

        break;
      }

      default:
        break;
    }
  },
);

sendDebug("Kapter offscreen document ready.");

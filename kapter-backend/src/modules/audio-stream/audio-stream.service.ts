import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { appConfig } from "../../config/app.config";
import { MeetingArtifactExtractionService } from "../meetings/meeting-artifact-extraction.service";
import { AiWorkerClient } from "../ai-worker/ai-worker.client";
import { MeetingsService } from "../meetings/meetings.service";
import { TranscriptPersistenceService } from "../meetings/transcript-persistence.service";
import {
  createBufferedAudioBatch,
  decodeAudioChunkPayload,
} from "./audio-buffer.utils";
import { STREAM_SESSION_STORE } from "./audio-stream.constants";
import {
  createActiveAudioSourceState,
  type ActiveAudioSourceState,
  type ActiveStreamSession,
} from "./active-stream-session.type";
import type { AudioChunkDto } from "./dto/audio-chunk.dto";
import type { StreamReadyDto } from "./dto/stream-ready.dto";
import type { StreamStartDto } from "./dto/stream-start.dto";
import type { StreamStopDto } from "./dto/stream-stop.dto";
import {
  DEFAULT_AUDIO_SOURCE_TYPE,
  resolveAudioSourceType,
} from "./audio-source.utils";
import type { StreamSessionStore } from "./stream-session-store.interface";

interface StreamActorContext {
  clerkUserId: string;
  localUserId: string;
}

const shouldIgnoreAudioSourceForCaptureContext = (
  captureContext: ActiveStreamSession["captureContext"],
  sourceType: ReturnType<typeof resolveAudioSourceType>,
): boolean => captureContext !== "google_meet_room" && sourceType === "self_mic";

@Injectable()
export class AudioStreamService {
  private readonly disconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly completionWaiters = new Map<string, Array<() => void>>();

  constructor(
    private readonly meetingsService: MeetingsService,
    @Inject(STREAM_SESSION_STORE)
    private readonly sessionStore: StreamSessionStore,
    private readonly aiWorkerClient: AiWorkerClient,
    private readonly transcriptPersistence: TranscriptPersistenceService,
    private readonly meetingArtifactExtraction: MeetingArtifactExtractionService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async beginStream(
    clientId: string,
    actor: StreamActorContext,
    payload: StreamStartDto,
  ) {
    const existingSession = this.sessionStore.get(payload.streamId);

    if (existingSession) {
      throw new ConflictException(
        `Stream ${payload.streamId} is already active.`,
      );
    }

    const meeting = await this.meetingsService.createRecordingMeeting({
      userId: actor.localUserId,
      externalMeetingId: payload.meetingId,
      projectId: payload.projectId,
      captureContext: payload.captureContext,
    });

    this.clearDisconnectTimeout(payload.streamId);

    this.sessionStore.create({
      streamId: payload.streamId,
      clientId,
      userId: actor.localUserId,
      clerkUserId: actor.clerkUserId,
      backendMeetingId: meeting.id,
      externalMeetingId: meeting.externalMeetingId,
      captureContext: payload.captureContext ?? null,
      stopRequested: false,
      audioSources: {
        [DEFAULT_AUDIO_SOURCE_TYPE]: createActiveAudioSourceState(
          DEFAULT_AUDIO_SOURCE_TYPE,
        ),
      },
    });

    return {
      status: "accepted",
      clientId,
      clerkUserId: actor.clerkUserId,
      userId: actor.localUserId,
      streamId: payload.streamId,
      backendMeetingId: meeting.id,
      captureContext: payload.captureContext,
    };
  }

  async markStreamReady(
    clientId: string,
    actor: StreamActorContext,
    payload: StreamReadyDto,
  ) {
    const session = this.getRequiredSession(payload.streamId);
    const degradedWithoutSelfMic = payload.degradedWithoutSelfMic === true;

    await this.meetingsService.updateRecordingMeetingCaptureState(
      session.backendMeetingId,
      {
        degradedWithoutSelfMic,
      },
    );

    this.logger.info("Dual-lane capture metric", {
      metric: "dual_lane_self_mic_availability",
      meetingId: session.backendMeetingId,
      streamId: payload.streamId,
      captureContext: session.captureContext,
      degradedWithoutSelfMic,
      missingMicAccessCount: degradedWithoutSelfMic ? 1 : 0,
      selfMicAvailableCount: degradedWithoutSelfMic ? 0 : 1,
    });

    return {
      status: "updated",
      clientId,
      clerkUserId: actor.clerkUserId,
      userId: actor.localUserId,
      streamId: payload.streamId,
    };
  }

  handleChunk(
    clientId: string,
    actor: StreamActorContext,
    payload: AudioChunkDto,
  ) {
    const session = this.getRequiredSession(payload.streamId);
    const sourceType = resolveAudioSourceType(payload.sourceType);
    const sourceState = this.getOrCreateSourceState(session, sourceType);
    const shouldIgnoreSource = shouldIgnoreAudioSourceForCaptureContext(
      session.captureContext,
      sourceType,
    );

    if (session.stopRequested) {
      throw new ConflictException(
        `Stream ${payload.streamId} is already stopping.`,
      );
    }

    if (payload.sequence !== sourceState.lastAcceptedSequence + 1) {
      throw new BadRequestException(
        `Received out-of-order chunk sequence ${payload.sequence} for stream ${payload.streamId} source ${sourceType}.`,
      );
    }

    if (sourceState.mimeType && sourceState.mimeType !== payload.mimeType) {
      throw new BadRequestException(
        `Audio chunk mime type changed mid-stream for ${payload.streamId} source ${sourceType}.`,
      );
    }

    if (shouldIgnoreSource) {
      sourceState.mimeType = sourceState.mimeType ?? payload.mimeType;
      sourceState.lastAcceptedSequence = payload.sequence;
      this.sessionStore.update(session);

      if (payload.sequence === 1) {
        this.logger.warn("Ignoring self_mic chunk outside Google Meet context", {
          streamId: payload.streamId,
          backendMeetingId: session.backendMeetingId,
          captureContext: session.captureContext,
          sourceType,
        });
      }

      return {
        status: "buffered",
        clientId,
        clerkUserId: actor.clerkUserId,
        userId: actor.localUserId,
        streamId: payload.streamId,
        sequence: payload.sequence,
      };
    }

    const buffer = decodeAudioChunkPayload(payload.payload);

    sourceState.mimeType = sourceState.mimeType ?? payload.mimeType;
    sourceState.lastAcceptedSequence = payload.sequence;
    sourceState.bufferedDurationMs += payload.durationMs ?? 0;
    sourceState.chunkQueue.push({
      sequence: payload.sequence,
      buffer,
      mimeType: payload.mimeType,
      durationMs: payload.durationMs ?? 0,
    });
    this.sessionStore.update(session);

    if (this.shouldFlushByThreshold(sourceState)) {
      this.scheduleFlush(session.streamId, sourceType);
    }

    return {
      status: "buffered",
      clientId,
      clerkUserId: actor.clerkUserId,
      userId: actor.localUserId,
      streamId: payload.streamId,
      sequence: payload.sequence,
    };
  }

  async stopStream(
    clientId: string,
    actor: StreamActorContext,
    payload: StreamStopDto,
  ) {
    const session = this.sessionStore.get(payload.streamId);

    if (session) {
      if (!session.stopRequested) {
        session.stopRequested = true;
        this.sessionStore.update(session);
        await this.meetingsService.markMeetingProcessing(
          session.backendMeetingId,
        );
      }

      await this.flushAllBufferedAudio(payload.streamId, true);
      await this.finalizeStoppedSession(payload.streamId);

      if (this.sessionStore.get(payload.streamId)) {
        await this.waitForSessionToClose(payload.streamId);
      }
    }

    return {
      status: "completed",
      clientId,
      clerkUserId: actor.clerkUserId,
      userId: actor.localUserId,
      streamId: payload.streamId,
    };
  }

  async handleClientDisconnect(clientId: string): Promise<void> {
    const activeSessions = this.sessionStore
      .listAll()
      .filter((session) => session.clientId === clientId);

    for (const session of activeSessions) {
      await this.beginDisconnectedFinalization(session.streamId);
    }
  }

  private getRequiredSession(streamId: string): ActiveStreamSession {
    const session = this.sessionStore.get(streamId);

    if (!session) {
      throw new BadRequestException(`Stream ${streamId} is not active.`);
    }

    return session;
  }

  private getOrCreateSourceState(
    session: ActiveStreamSession,
    sourceType: ReturnType<typeof resolveAudioSourceType>,
  ): ActiveAudioSourceState {
    const existing = session.audioSources[sourceType];

    if (existing) {
      return existing;
    }

    const created = createActiveAudioSourceState(sourceType);
    session.audioSources[sourceType] = created;
    return created;
  }

  private getSourceStates(
    session: ActiveStreamSession,
  ): ActiveAudioSourceState[] {
    return Object.values(session.audioSources).filter(
      (sourceState): sourceState is ActiveAudioSourceState => !!sourceState,
    );
  }

  private getBufferedSourceStates(
    session: ActiveStreamSession,
  ): ActiveAudioSourceState[] {
    return this.getSourceStates(session).filter(
      (sourceState) => sourceState.chunkQueue.length > 0,
    );
  }

  private hasWorkerInFlight(session: ActiveStreamSession): boolean {
    return this.getSourceStates(session).some(
      (sourceState) => sourceState.workerInFlight,
    );
  }

  private shouldFlushByThreshold(sourceState: ActiveAudioSourceState): boolean {
    return (
      sourceState.bufferedDurationMs >= this.config.audioBuffer.flushMs ||
      sourceState.chunkQueue.length >= this.config.audioBuffer.maxChunks
    );
  }

  private scheduleFlush(
    streamId: string,
    sourceType: ReturnType<typeof resolveAudioSourceType>,
    force = false,
  ): void {
    queueMicrotask(() => {
      void this.flushBufferedAudio(streamId, sourceType, force);
    });
  }

  private async flushAllBufferedAudio(
    streamId: string,
    force = false,
  ): Promise<void> {
    const session = this.sessionStore.get(streamId);

    if (!session) {
      return;
    }

    const sourceStates = this.getSourceStates(session);

    for (const sourceState of sourceStates) {
      await this.flushBufferedAudio(streamId, sourceState.sourceType, force);
    }
  }

  private async beginDisconnectedFinalization(streamId: string): Promise<void> {
    const session = this.sessionStore.get(streamId);

    if (!session) {
      return;
    }

    if (!session.stopRequested) {
      session.stopRequested = true;
      this.sessionStore.update(session);
      await this.meetingsService.markMeetingProcessing(
        session.backendMeetingId,
      );
    }

    this.logger.warn("Finalizing disconnected audio stream", {
      streamId: session.streamId,
      backendMeetingId: session.backendMeetingId,
      bufferedSources: this.getBufferedSourceStates(session).map(
        (sourceState) => sourceState.sourceType,
      ),
      workerInFlightSources: this.getSourceStates(session)
        .filter((sourceState) => sourceState.workerInFlight)
        .map((sourceState) => sourceState.sourceType),
    });

    this.scheduleDisconnectTimeout(streamId);

    const bufferedSourceStates = this.getBufferedSourceStates(session);

    if (bufferedSourceStates.length > 0) {
      for (const sourceState of bufferedSourceStates) {
        this.scheduleFlush(streamId, sourceState.sourceType, true);
      }
      return;
    }

    await this.finalizeStoppedSession(streamId);
  }

  private scheduleDisconnectTimeout(streamId: string): void {
    const session = this.sessionStore.get(streamId);

    if (!session) {
      return;
    }

    this.clearDisconnectTimeout(streamId);

    const timeout = setTimeout(() => {
      void this.failDisconnectedStream(streamId);
    }, this.config.audioBuffer.idleTimeoutMs);

    this.disconnectTimeouts.set(streamId, timeout);
  }

  private async waitForSessionToClose(streamId: string): Promise<void> {
    if (!this.sessionStore.get(streamId)) {
      return;
    }

    await new Promise<void>((resolve) => {
      const waiters = this.completionWaiters.get(streamId) ?? [];
      waiters.push(resolve);
      this.completionWaiters.set(streamId, waiters);
    });
  }

  private clearDisconnectTimeout(streamId: string): void {
    const timeout = this.disconnectTimeouts.get(streamId);

    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeouts.delete(streamId);
    }
  }

  private resolveSessionCompletion(streamId: string): void {
    const waiters = this.completionWaiters.get(streamId);

    if (!waiters) {
      return;
    }

    this.completionWaiters.delete(streamId);

    for (const resolve of waiters) {
      resolve();
    }
  }

  private async failDisconnectedStream(streamId: string): Promise<void> {
    const session = this.sessionStore.get(streamId);

    this.clearDisconnectTimeout(streamId);

    if (!session || !session.stopRequested) {
      return;
    }

    await this.meetingsService.markMeetingFailed(session.backendMeetingId);
    this.sessionStore.delete(streamId);
    this.resolveSessionCompletion(streamId);

    this.logger.error(
      "Marked disconnected stream as failed after idle timeout",
      {
        streamId: session.streamId,
        backendMeetingId: session.backendMeetingId,
        idleTimeoutMs: this.config.audioBuffer.idleTimeoutMs,
        workerInFlightSources: this.getSourceStates(session)
          .filter((sourceState) => sourceState.workerInFlight)
          .map((sourceState) => sourceState.sourceType),
        bufferedSources: this.getBufferedSourceStates(session).map(
          (sourceState) => sourceState.sourceType,
        ),
      },
    );
  }

  private async flushBufferedAudio(
    streamId: string,
    sourceType: ReturnType<typeof resolveAudioSourceType>,
    force = false,
  ): Promise<void> {
    const session = this.sessionStore.get(streamId);

    if (!session) {
      return;
    }

    const sourceState = session.audioSources[sourceType];

    if (!sourceState) {
      return;
    }

    if (sourceState.workerInFlight) {
      sourceState.flushPending = sourceState.flushPending || force;
      this.sessionStore.update(session);
      return;
    }

    if (sourceState.chunkQueue.length === 0) {
      return;
    }

    if (!force && !this.shouldFlushByThreshold(sourceState)) {
      return;
    }

    const bufferedChunks = [...sourceState.chunkQueue];
    const batchWindow = createBufferedAudioBatch(
      session,
      sourceState,
      sourceType,
      bufferedChunks,
      force,
    );

    sourceState.chunkQueue = [];
    sourceState.bufferedDurationMs = 0;
    sourceState.streamOffsetMs += batchWindow.durationMs;
    sourceState.workerInFlight = true;
    sourceState.flushPending = false;
    this.sessionStore.update(session);

    try {
      const workerStartedAt = Date.now();
      const processedBatch = await this.aiWorkerClient.processAudioBatch(
        batchWindow.request,
      );
      const workerLatencyMs = Date.now() - workerStartedAt;

      const persistenceStartedAt = Date.now();
      await this.transcriptPersistence.persistWorkerBatch(processedBatch);
      const persistenceLatencyMs = Date.now() - persistenceStartedAt;

      this.logger.info("Processed audio batch", {
        streamId: session.streamId,
        backendMeetingId: session.backendMeetingId,
        sourceType,
        sequenceStart: batchWindow.sequenceStart,
        sequenceEnd: batchWindow.sequenceEnd,
        durationMs: batchWindow.durationMs,
        workerLatencyMs,
        persistenceLatencyMs,
        segmentCount: processedBatch.response.segments.length,
      });
    } catch (error) {
      this.logger.error("Failed to process buffered audio batch", {
        streamId: session.streamId,
        backendMeetingId: session.backendMeetingId,
        sourceType,
        sequenceStart: batchWindow.sequenceStart,
        sequenceEnd: batchWindow.sequenceEnd,
        durationMs: batchWindow.durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      if (session.stopRequested) {
        await this.meetingsService.markMeetingFailed(session.backendMeetingId);
        this.clearDisconnectTimeout(streamId);
        this.sessionStore.delete(streamId);
        this.resolveSessionCompletion(streamId);
        return;
      }
    } finally {
      const updatedSession = this.sessionStore.get(streamId);
      const updatedSourceState = updatedSession?.audioSources[sourceType];

      if (updatedSession && updatedSourceState) {
        updatedSourceState.workerInFlight = false;
        this.sessionStore.update(updatedSession);

        if (updatedSourceState.flushPending) {
          await this.flushBufferedAudio(streamId, sourceType, true);
        }

        await this.finalizeStoppedSession(streamId);
      }
    }
  }

  private async finalizeStoppedSession(streamId: string): Promise<void> {
    const session = this.sessionStore.get(streamId);

    if (!session) {
      return;
    }

    if (
      !session.stopRequested ||
      this.hasWorkerInFlight(session) ||
      this.getBufferedSourceStates(session).length > 0
    ) {
      return;
    }

    await this.meetingsService.markMeetingCompleted(session.backendMeetingId);
    this.clearDisconnectTimeout(streamId);
    this.sessionStore.delete(streamId);
    this.resolveSessionCompletion(streamId);
    void Promise.resolve(
      this.meetingArtifactExtraction.notifyMeetingCaptureCompleted(
        session.backendMeetingId,
      ),
    ).catch((error: unknown) => {
      this.logger.error("Meeting artifact extraction failed after stop.", {
        meetingId: session.backendMeetingId,
        error,
      });
    });
  }
}

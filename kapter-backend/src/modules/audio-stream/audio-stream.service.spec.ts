import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { describe, it, mock } from "node:test";

import { InMemoryStreamSessionStore } from "./in-memory-stream-session.store";
import { AudioStreamService } from "./audio-stream.service";

const createService = () => {
  const createRecordingMeeting = mock.fn(
    async ({
      userId,
      externalMeetingId,
    }: {
      userId: string;
      externalMeetingId?: string | null;
    }) => ({
      id: "meeting_backend_1",
      externalMeetingId: externalMeetingId ?? null,
      status: "RECORDING",
      title: "Recording meeting",
      userId,
    }),
  );
  const updateRecordingMeetingCaptureState = mock.fn(
    async (_meetingId: string, _state: unknown) => undefined as unknown,
  );
  const markMeetingProcessing = mock.fn(
    async (_meetingId: string) => undefined as unknown,
  );
  const markMeetingCompleted = mock.fn(
    async (_meetingId: string) => undefined as unknown,
  );
  const markMeetingFailed = mock.fn(
    async (_meetingId: string, _errorMessage?: string) => undefined as unknown,
  );
  const processAudioBatch = mock.fn(async (request: any) => ({
    batchId: "batch_1",
    request,
    response: {
      streamId: request.streamId,
      backendMeetingId: request.backendMeetingId,
      sequenceStart: request.sequenceStart,
      sequenceEnd: request.sequenceEnd,
      streamOffsetMs: request.streamOffsetMs,
      segments: [],
    },
  }));
  const persistWorkerBatch = mock.fn(
    async (_batch: unknown) => undefined as unknown,
  );
  const notifyMeetingCaptureCompleted = mock.fn(
    async (_meetingId: string) => undefined as unknown,
  );
  const logger = {
    info: mock.fn(() => undefined),
    debug: mock.fn(() => undefined),
    warn: mock.fn(() => undefined),
    error: mock.fn(() => undefined),
  };
  const config = {
    audioBuffer: {
      flushMs: 10_000,
      maxChunks: 5,
      idleTimeoutMs: 25,
    },
  };
  const sessionStore = new InMemoryStreamSessionStore();

  const meetingsService = {
    createRecordingMeeting,
    updateRecordingMeetingCaptureState,
    markMeetingProcessing,
    markMeetingCompleted,
    markMeetingFailed,
  };
  const aiWorkerClient = { processAudioBatch };
  const transcriptPersistence = { persistWorkerBatch };
  const meetingArtifactExtraction = { notifyMeetingCaptureCompleted };

  const service = new AudioStreamService(
    meetingsService as unknown as ConstructorParameters<
      typeof AudioStreamService
    >[0],
    sessionStore as unknown as ConstructorParameters<
      typeof AudioStreamService
    >[1],
    aiWorkerClient as unknown as ConstructorParameters<
      typeof AudioStreamService
    >[2],
    transcriptPersistence as unknown as ConstructorParameters<
      typeof AudioStreamService
    >[3],
    meetingArtifactExtraction as unknown as ConstructorParameters<
      typeof AudioStreamService
    >[4],
    config as unknown as ConstructorParameters<typeof AudioStreamService>[5],
    logger as unknown as ConstructorParameters<typeof AudioStreamService>[6],
  );

  return {
    service,
    sessionStore,
    meetingsService,
    aiWorkerClient,
    transcriptPersistence,
    meetingArtifactExtraction,
    logger,
  };
};

const actor = {
  clerkUserId: "clerk_user_1",
  localUserId: "local_user_1",
};

const encodeChunk = (value: string) =>
  Buffer.from(value, "utf8").toString("base64");

const getSourceState = (
  session: NonNullable<ReturnType<InMemoryStreamSessionStore["get"]>>,
  sourceType: "tab_mix" | "self_mic" = "tab_mix",
) => session.audioSources[sourceType];

void describe("AudioStreamService", () => {
  void it("passes an explicit project id into recording meeting creation", async () => {
    const { service, meetingsService } = createService();

    const ack = await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
      projectId: "project_1",
      captureContext: "google_meet_room",
    } as never);

    assert.equal(meetingsService.createRecordingMeeting.mock.callCount(), 1);
    assert.deepEqual(
      meetingsService.createRecordingMeeting.mock.calls[0]?.arguments[0],
      {
        userId: "local_user_1",
        externalMeetingId: "abc-defg-hij",
        projectId: "project_1",
        captureContext: "google_meet_room",
      },
    );
    assert.equal(ack.status, "accepted");
  });

  void it("persists capture degradation after offscreen lane startup completes", async () => {
    const { service, meetingsService } = createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
      captureContext: "google_meet_room",
    } as never);

    const ack = await service.markStreamReady("client_1", actor, {
      streamId: "stream_1",
      degradedWithoutSelfMic: true,
    });

    assert.equal(
      meetingsService.updateRecordingMeetingCaptureState.mock.callCount(),
      1,
    );
    assert.deepEqual(
      meetingsService.updateRecordingMeetingCaptureState.mock.calls[0]
        ?.arguments,
      [
        "meeting_backend_1",
        {
          degradedWithoutSelfMic: true,
        },
      ],
    );
    assert.equal(ack.status, "updated");
  });

  void it("buffers ordered chunks and flushes asynchronously when the max chunk count is reached", async () => {
    const { service, sessionStore, aiWorkerClient, transcriptPersistence } =
      createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    for (let sequence = 1; sequence <= 5; sequence += 1) {
      const ack = service.handleChunk("client_1", actor, {
        streamId: "stream_1",
        sequence,
        mimeType: "audio/webm;codecs=opus",
        payload: encodeChunk(`chunk-${sequence}`),
        durationMs: 2_000,
      });

      assert.equal(ack.status, "buffered");
      assert.equal(ack.sequence, sequence);
    }

    assert.equal(aiWorkerClient.processAudioBatch.mock.callCount(), 0);

    await delay(0);

    assert.equal(aiWorkerClient.processAudioBatch.mock.callCount(), 1);
    assert.equal(transcriptPersistence.persistWorkerBatch.mock.callCount(), 1);

    const request =
      aiWorkerClient.processAudioBatch.mock.calls[0]?.arguments[0];
    assert.equal(request.streamId, "stream_1");
    assert.equal(request.backendMeetingId, "meeting_backend_1");
    assert.equal(request.sourceType, "tab_mix");
    assert.equal(request.sequenceStart, 1);
    assert.equal(request.sequenceEnd, 5);
    assert.equal(request.streamOffsetMs, 0);
    assert.equal(request.durationMs, 10_000);
    assert.equal(request.mimeType, "audio/webm;codecs=opus");
    assert.equal(
      Buffer.from(request.audioBase64, "base64").toString("utf8"),
      "chunk-1chunk-2chunk-3chunk-4chunk-5",
    );

    const session = sessionStore.get("stream_1");
    assert.ok(session);
    const tabMixState = getSourceState(session);
    assert.ok(tabMixState);
    assert.equal(tabMixState.chunkQueue.length, 0);
    assert.equal(tabMixState.streamOffsetMs, 10_000);
    assert.equal(tabMixState.bufferedDurationMs, 0);
  });

  void it("rejects out-of-order chunks without mutating stream state", async () => {
    const { service, sessionStore, aiWorkerClient } = createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("chunk-1"),
      durationMs: 2_000,
    });

    assert.throws(
      () =>
        service.handleChunk("client_1", actor, {
          streamId: "stream_1",
          sequence: 3,
          mimeType: "audio/webm;codecs=opus",
          payload: encodeChunk("chunk-3"),
          durationMs: 2_000,
        }),
      /out[- ]of[- ]order/i,
    );

    const session = sessionStore.get("stream_1");
    assert.ok(session);
    const tabMixState = getSourceState(session);
    assert.ok(tabMixState);
    assert.equal(tabMixState.lastAcceptedSequence, 1);
    assert.equal(aiWorkerClient.processAudioBatch.mock.callCount(), 0);
  });

  void it("tracks chunk ordering independently by source", async () => {
    const { service, sessionStore, aiWorkerClient } = createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("tab-chunk-1"),
      durationMs: 2_000,
      sourceType: "tab_mix",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("mic-chunk-1"),
      durationMs: 2_000,
      sourceType: "self_mic",
    });

    const session = sessionStore.get("stream_1");
    assert.ok(session);
    assert.equal(getSourceState(session, "tab_mix")?.lastAcceptedSequence, 1);
    assert.equal(getSourceState(session, "self_mic")?.lastAcceptedSequence, 1);
    assert.equal(aiWorkerClient.processAudioBatch.mock.callCount(), 0);
  });

  void it("ignores self_mic chunks for generic_tab sessions", async () => {
    const { service, sessionStore, aiWorkerClient, logger } = createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "generic-tab-1",
      captureContext: "generic_tab",
    });

    for (let sequence = 1; sequence <= 5; sequence += 1) {
      const ack = service.handleChunk("client_1", actor, {
        streamId: "stream_1",
        sequence,
        mimeType: "audio/webm;codecs=opus",
        payload: encodeChunk(`mic-chunk-${sequence}`),
        durationMs: 2_000,
        sourceType: "self_mic",
      });

      assert.equal(ack.status, "buffered");
      assert.equal(ack.sequence, sequence);
    }

    await delay(0);

    const session = sessionStore.get("stream_1");
    assert.ok(session);
    assert.equal(getSourceState(session, "self_mic")?.lastAcceptedSequence, 5);
    assert.equal(getSourceState(session, "self_mic")?.chunkQueue.length, 0);
    assert.equal(aiWorkerClient.processAudioBatch.mock.callCount(), 0);
    assert.equal(logger.warn.mock.callCount(), 1);
  });

  void it("marks self-mic worker batches with the recorder authoritative label", async () => {
    const { service, aiWorkerClient } = createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
      captureContext: "google_meet_room",
    });

    for (let sequence = 1; sequence <= 5; sequence += 1) {
      service.handleChunk("client_1", actor, {
        streamId: "stream_1",
        sequence,
        mimeType: "audio/webm;codecs=opus",
        payload: encodeChunk(`mic-chunk-${sequence}`),
        durationMs: 2_000,
        sourceType: "self_mic",
      });
    }

    await delay(0);

    assert.equal(aiWorkerClient.processAudioBatch.mock.callCount(), 1);

    const request =
      aiWorkerClient.processAudioBatch.mock.calls[0]?.arguments[0];
    assert.equal(request.sourceType, "self_mic");
    assert.equal(request.authoritativeSpeakerLabel, "RECORDER");
  });

  void it("flushes the remaining buffer on stop and schedules artifact extraction after completion", async () => {
    const {
      service,
      sessionStore,
      meetingsService,
      aiWorkerClient,
      transcriptPersistence,
      meetingArtifactExtraction,
    } = createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("chunk-1"),
      durationMs: 2_000,
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 2,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("chunk-2"),
      durationMs: 2_000,
    });

    const ack = await service.stopStream("client_1", actor, {
      streamId: "stream_1",
    });

    assert.equal(ack.status, "completed");
    assert.equal(aiWorkerClient.processAudioBatch.mock.callCount(), 1);
    assert.equal(transcriptPersistence.persistWorkerBatch.mock.callCount(), 1);
    assert.equal(meetingsService.markMeetingProcessing.mock.callCount(), 1);
    assert.equal(meetingsService.markMeetingCompleted.mock.callCount(), 1);
    assert.equal(sessionStore.get("stream_1"), undefined);
    assert.equal(
      meetingArtifactExtraction.notifyMeetingCaptureCompleted.mock.callCount(),
      1,
    );
  });

  void it("does not wait for slow artifact extraction before completing a stopped stream", async () => {
    const {
      service,
      sessionStore,
      meetingsService,
      meetingArtifactExtraction,
    } = createService();
    let resolveExtraction: () => void = () => undefined;

    meetingArtifactExtraction.notifyMeetingCaptureCompleted.mock.mockImplementation(
      async () =>
        await new Promise<void>((resolve) => {
          resolveExtraction = resolve;
        }),
    );

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("chunk-1"),
      durationMs: 2_000,
    });

    const ack = await service.stopStream("client_1", actor, {
      streamId: "stream_1",
    });

    assert.equal(ack.status, "completed");
    assert.equal(meetingsService.markMeetingCompleted.mock.callCount(), 1);
    assert.equal(sessionStore.get("stream_1"), undefined);
    assert.equal(
      meetingArtifactExtraction.notifyMeetingCaptureCompleted.mock.callCount(),
      1,
    );
    resolveExtraction();
  });

  void it("still completes a stopped stream when background artifact extraction fails", async () => {
    const {
      service,
      sessionStore,
      meetingsService,
      meetingArtifactExtraction,
      logger,
    } = createService();

    meetingArtifactExtraction.notifyMeetingCaptureCompleted.mock.mockImplementation(
      async () => {
        throw new Error("LLM unavailable");
      },
    );

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("chunk-1"),
      durationMs: 2_000,
    });

    await service.stopStream("client_1", actor, {
      streamId: "stream_1",
    });

    assert.equal(meetingsService.markMeetingCompleted.mock.callCount(), 1);
    assert.equal(meetingsService.markMeetingFailed.mock.callCount(), 0);
    assert.equal(sessionStore.get("stream_1"), undefined);
    assert.equal(
      meetingArtifactExtraction.notifyMeetingCaptureCompleted.mock.callCount(),
      1,
    );
    assert.equal(logger.error.mock.callCount(), 1);
  });

  void it("finalizes a disconnected stream by forcing a flush of buffered audio", async () => {
    const {
      service,
      sessionStore,
      meetingsService,
      aiWorkerClient,
      transcriptPersistence,
    } = createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("chunk-1"),
      durationMs: 2_000,
    });

    await service.handleClientDisconnect("client_1");
    await delay(0);

    assert.equal(aiWorkerClient.processAudioBatch.mock.callCount(), 1);
    assert.equal(transcriptPersistence.persistWorkerBatch.mock.callCount(), 1);
    assert.equal(meetingsService.markMeetingProcessing.mock.callCount(), 1);
    assert.equal(meetingsService.markMeetingCompleted.mock.callCount(), 1);
    assert.equal(sessionStore.get("stream_1"), undefined);
  });

  void it("marks a disconnected stream as failed after the idle timeout when the worker never returns", async () => {
    const { service, sessionStore, meetingsService, aiWorkerClient } =
      createService();

    aiWorkerClient.processAudioBatch.mock.mockImplementation(
      async () => await new Promise(() => undefined),
    );

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("chunk-1"),
      durationMs: 2_000,
    });

    await service.handleClientDisconnect("client_1");
    await delay(50);

    assert.equal(meetingsService.markMeetingFailed.mock.callCount(), 1);
    assert.equal(sessionStore.get("stream_1"), undefined);
  });

  void it("rejects a chunk when the mime type changes mid-stream", async () => {
    const { service } = createService();

    await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "abc-defg-hij",
    });

    service.handleChunk("client_1", actor, {
      streamId: "stream_1",
      sequence: 1,
      mimeType: "audio/webm;codecs=opus",
      payload: encodeChunk("chunk-1"),
      durationMs: 2_000,
    });

    assert.throws(
      () =>
        service.handleChunk("client_1", actor, {
          streamId: "stream_1",
          sequence: 2,
          mimeType: "audio/mp4",
          payload: encodeChunk("chunk-2"),
          durationMs: 2_000,
        }),
      /mime type/i,
    );
  });
});

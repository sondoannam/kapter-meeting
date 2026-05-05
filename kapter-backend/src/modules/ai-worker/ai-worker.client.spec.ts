import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { AiWorkerClient } from "./ai-worker.client";

const createClient = (sharedSecret?: string) => {
  const create = mock.fn(async ({ data }) => ({
    id: "batch_1",
    ...data,
  }));
  const update = mock.fn(async ({ where, data }) => ({
    id: where.id,
    ...data,
  }));
  const prisma = {
    meetingAudioBatch: {
      create,
      update,
    },
  };
  const logger = {
    info: mock.fn(() => undefined),
    debug: mock.fn(() => undefined),
    warn: mock.fn(() => undefined),
    error: mock.fn(() => undefined),
  };
  const config = {
    aiWorker: {
      baseUrl: "http://127.0.0.1:8000",
      timeoutMs: 5_000,
      sharedSecret,
    },
  };

  const client = new AiWorkerClient(
    config as unknown as ConstructorParameters<typeof AiWorkerClient>[0],
    prisma as unknown as ConstructorParameters<typeof AiWorkerClient>[1],
    logger as unknown as ConstructorParameters<typeof AiWorkerClient>[2],
  );

  return {
    client,
    prisma,
    logger,
  };
};

const request = {
  streamId: "stream_1",
  backendMeetingId: "meeting_backend_1",
  captureContext: "google_meet_room",
  sourceType: "tab_mix",
  sequenceStart: 1,
  sequenceEnd: 5,
  streamOffsetMs: 0,
  durationMs: 10_000,
  mimeType: "audio/webm;codecs=opus",
  audioBase64: Buffer.from(
    "chunk-1chunk-2chunk-3chunk-4chunk-5",
    "utf8",
  ).toString("base64"),
};

afterEach(() => {
  mock.restoreAll();
});

void describe("AiWorkerClient", () => {
  void it("posts JSON to the worker endpoint and moves the batch into processing", async () => {
    const { client, prisma } = createClient();

    const fetchMock = mock.method(globalThis, "fetch", async () => {
      return new Response(
        JSON.stringify({
          streamId: request.streamId,
          backendMeetingId: request.backendMeetingId,
          sequenceStart: request.sequenceStart,
          sequenceEnd: request.sequenceEnd,
          streamOffsetMs: request.streamOffsetMs,
          segments: [],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const result = await client.processAudioBatch(request);

    assert.equal(prisma.meetingAudioBatch.create.mock.callCount(), 1);
    assert.equal(
      prisma.meetingAudioBatch.create.mock.calls[0]?.arguments[0].data
        .sourceType,
      "TAB_MIX",
    );
    assert.equal(prisma.meetingAudioBatch.update.mock.callCount(), 1);
    assert.equal(
      prisma.meetingAudioBatch.update.mock.calls[0]?.arguments[0].data.status,
      "PROCESSING",
    );
    assert.equal(fetchMock.mock.callCount(), 1);

    const fetchOptions = fetchMock.mock.calls[0]?.arguments[1];
    assert.equal(fetchOptions?.method, "POST");
    assert.equal(fetchOptions?.headers?.["content-type"], "application/json");
    assert.deepEqual(JSON.parse(fetchOptions?.body as string), request);

    assert.equal(result.batchId, "batch_1");
    assert.equal(result.response.sequenceEnd, 5);
  });

  void it("adds bearer auth when the worker shared secret is configured", async () => {
    const { client } = createClient("super-secret-token");

    const fetchMock = mock.method(globalThis, "fetch", async () => {
      return new Response(
        JSON.stringify({
          streamId: request.streamId,
          backendMeetingId: request.backendMeetingId,
          sequenceStart: request.sequenceStart,
          sequenceEnd: request.sequenceEnd,
          streamOffsetMs: request.streamOffsetMs,
          segments: [],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    await client.processAudioBatch(request);

    const fetchOptions = fetchMock.mock.calls[0]?.arguments[1];
    assert.equal(
      fetchOptions?.headers?.authorization,
      "Bearer super-secret-token",
    );
  });

  void it("retries once on a transient network failure", async () => {
    const { client } = createClient();
    let attempts = 0;

    const fetchMock = mock.method(globalThis, "fetch", async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new TypeError("network failure");
      }

      return new Response(
        JSON.stringify({
          streamId: request.streamId,
          backendMeetingId: request.backendMeetingId,
          sequenceStart: request.sequenceStart,
          sequenceEnd: request.sequenceEnd,
          streamOffsetMs: request.streamOffsetMs,
          segments: [],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    await client.processAudioBatch(request);

    assert.equal(fetchMock.mock.callCount(), 2);
  });

  void it("marks the batch failed without retrying on a 400 response", async () => {
    const { client, prisma } = createClient();

    const fetchMock = mock.method(globalThis, "fetch", async () => {
      return new Response(JSON.stringify({ error: "bad request" }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      });
    });

    await assert.rejects(() => client.processAudioBatch(request), /400/);

    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(prisma.meetingAudioBatch.update.mock.callCount(), 2);
    assert.equal(
      prisma.meetingAudioBatch.update.mock.calls[1]?.arguments[0].data.status,
      "FAILED",
    );
  });
});

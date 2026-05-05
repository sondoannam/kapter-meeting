import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  mock,
} from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { PrismaClient } from "prisma/generated/prisma/client";

import { AiWorkerClient } from "../ai-worker/ai-worker.client";
import { MeetingsService } from "../meetings/meetings.service";
import { TranscriptPersistenceService } from "../meetings/transcript-persistence.service";
import { InMemoryStreamSessionStore } from "./in-memory-stream-session.store";
import { AudioStreamService } from "./audio-stream.service";

const backendRoot = path.resolve(__dirname, "../../..");
const workspaceRoot = path.resolve(backendRoot, "..");
const execFileAsync = promisify(execFile);

dotenv.config({ path: path.join(workspaceRoot, "infra", ".env") });

const databaseUrl =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

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
    idleTimeoutMs: 100,
  },
  aiWorker: {
    baseUrl: "http://127.0.0.1:8000",
    timeoutMs: 1_000,
  },
};

const encodeChunk = (value: string) =>
  Buffer.from(value, "utf8").toString("base64");

let prisma: PrismaClient;

const applyMigrations = async () => {
  const prismaExecutable = path.join(
    backendRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma",
  );

  const command = process.platform === "win32" ? "cmd.exe" : prismaExecutable;
  const commandArgs =
    process.platform === "win32"
      ? [
          "/c",
          prismaExecutable,
          "migrate",
          "deploy",
          "--schema",
          "prisma/schema.prisma",
        ]
      : ["migrate", "deploy", "--schema", "prisma/schema.prisma"];

  await execFileAsync(command, commandArgs, {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
};

const cleanDatabase = async () => {
  await prisma.transcriptSegment.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.speakerProfile.deleteMany();
  await prisma.meetingAudioBatch.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.projectContext.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
};

const createUser = async () => {
  return prisma.user.create({
    data: {
      clerkId: `clerk_${randomUUID()}`,
      email: `integration-${randomUUID()}@example.com`,
      name: "Integration User",
    },
  });
};

const createService = () => {
  const sessionStore = new InMemoryStreamSessionStore();
  const meetingArtifactExtraction = {
    notifyTranscriptPersisted: mock.fn(() => undefined),
    notifyMeetingCaptureCompleted: mock.fn(() => undefined),
  };
  const meetingsService = new MeetingsService(
    prisma as unknown as ConstructorParameters<typeof MeetingsService>[0],
  );
  const transcriptPersistence = new TranscriptPersistenceService(
    prisma as unknown as ConstructorParameters<
      typeof TranscriptPersistenceService
    >[0],
    meetingArtifactExtraction as unknown as ConstructorParameters<
      typeof TranscriptPersistenceService
    >[1],
    logger as unknown as ConstructorParameters<
      typeof TranscriptPersistenceService
    >[2],
  );
  const aiWorkerClient = new AiWorkerClient(
    config as unknown as ConstructorParameters<typeof AiWorkerClient>[0],
    prisma as unknown as ConstructorParameters<typeof AiWorkerClient>[1],
    logger as unknown as ConstructorParameters<typeof AiWorkerClient>[2],
  );
  const service = new AudioStreamService(
    meetingsService as ConstructorParameters<typeof AudioStreamService>[0],
    sessionStore as unknown as ConstructorParameters<
      typeof AudioStreamService
    >[1],
    aiWorkerClient as ConstructorParameters<typeof AudioStreamService>[2],
    transcriptPersistence as ConstructorParameters<
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
    meetingArtifactExtraction,
  };
};

before(async () => {
  await applyMigrations();

  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  await prisma.$connect();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterEach(async () => {
  mock.restoreAll();
  await cleanDatabase();
});

after(async () => {
  await prisma.$disconnect();
});

void describe("AudioStreamService integration", () => {
  void it("persists batches, speakers, and transcript segments after a threshold flush", async () => {
    const user = await createUser();
    const { service, meetingArtifactExtraction } = createService();

    mock.method(
      globalThis,
      "fetch",
      async (
        _input: Parameters<typeof fetch>[0],
        init: Parameters<typeof fetch>[1],
      ) => {
        const body = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({
            streamId: body.streamId,
            backendMeetingId: body.backendMeetingId,
            sequenceStart: body.sequenceStart,
            sequenceEnd: body.sequenceEnd,
            streamOffsetMs: body.streamOffsetMs,
            segments: [
              {
                aiLabel: "Speaker 0",
                startTime: 0,
                endTime: 1.5,
                content: "hello everyone",
              },
              {
                aiLabel: "Speaker 1",
                startTime: 1.5,
                endTime: 3,
                content: "thanks for joining",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      },
    );

    const actor = {
      clerkUserId: user.clerkId!,
      localUserId: user.id,
    };
    const startAck = await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "meet-abc",
    });

    for (let sequence = 1; sequence <= 5; sequence += 1) {
      service.handleChunk("client_1", actor, {
        streamId: "stream_1",
        sequence,
        mimeType: "audio/webm;codecs=opus",
        payload: encodeChunk(`chunk-${sequence}`),
        durationMs: 2_000,
      });
    }

    await delay(0);
    await service.stopStream("client_1", actor, {
      streamId: "stream_1",
    });
    const meeting = await prisma.meeting.findUniqueOrThrow({
      where: { id: startAck.backendMeetingId },
      include: {
        audioBatches: true,
        speakers: true,
        transcript: {
          orderBy: {
            startTime: "asc",
          },
        },
      },
    });

    assert.equal(meeting.status, "COMPLETED");
    assert.equal(
      meetingArtifactExtraction.notifyTranscriptPersisted.mock.callCount(),
      1,
    );
    assert.equal(
      meetingArtifactExtraction.notifyMeetingCaptureCompleted.mock.callCount(),
      1,
    );
    assert.equal(meeting.externalMeetingId, "meet-abc");
    assert.equal(meeting.audioBatches.length, 1);
    assert.equal(meeting.audioBatches[0]?.status, "COMPLETED");
    assert.equal(meeting.audioBatches[0]?.sequenceStart, 1);
    assert.equal(meeting.audioBatches[0]?.sequenceEnd, 5);
    assert.equal(meeting.speakers.length, 2);
    assert.equal(meeting.transcript.length, 2);
    assert.equal(meeting.transcript[0]?.startTime, 0);
    assert.equal(meeting.transcript[1]?.content, "thanks for joining");
  });

  void it("rejects out-of-order chunks without creating an audio batch", async () => {
    const user = await createUser();
    const { service } = createService();
    const actor = {
      clerkUserId: user.clerkId!,
      localUserId: user.id,
    };

    const startAck = await service.beginStream("client_1", actor, {
      streamId: "stream_1",
      meetingId: "meet-xyz",
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

    const meeting = await prisma.meeting.findUniqueOrThrow({
      where: { id: startAck.backendMeetingId },
      include: {
        audioBatches: true,
      },
    });

    assert.equal(meeting.status, "RECORDING");
    assert.equal(meeting.audioBatches.length, 0);
  });

  void it("flushes a partial buffer on stop and persists the final transcript batch", async () => {
    const user = await createUser();
    const { service, meetingArtifactExtraction } = createService();

    mock.method(
      globalThis,
      "fetch",
      async (
        _input: Parameters<typeof fetch>[0],
        init: Parameters<typeof fetch>[1],
      ) => {
        const body = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({
            streamId: body.streamId,
            backendMeetingId: body.backendMeetingId,
            sequenceStart: body.sequenceStart,
            sequenceEnd: body.sequenceEnd,
            streamOffsetMs: body.streamOffsetMs,
            segments: [
              {
                aiLabel: "Speaker 0",
                startTime: 0.25,
                endTime: 1.75,
                content: "partial flush works",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      },
    );

    const actor = {
      clerkUserId: user.clerkId!,
      localUserId: user.id,
    };
    const startAck = await service.beginStream("client_2", actor, {
      streamId: "stream_2",
      meetingId: "meet-stop",
    });

    for (let sequence = 1; sequence <= 2; sequence += 1) {
      service.handleChunk("client_2", actor, {
        streamId: "stream_2",
        sequence,
        mimeType: "audio/webm;codecs=opus",
        payload: encodeChunk(`chunk-${sequence}`),
        durationMs: 2_000,
      });
    }

    await service.stopStream("client_2", actor, {
      streamId: "stream_2",
    });
    const meeting = await prisma.meeting.findUniqueOrThrow({
      where: { id: startAck.backendMeetingId },
      include: {
        audioBatches: true,
        transcript: true,
      },
    });

    assert.equal(meeting.status, "COMPLETED");
    assert.equal(
      meetingArtifactExtraction.notifyTranscriptPersisted.mock.callCount(),
      1,
    );
    assert.equal(
      meetingArtifactExtraction.notifyMeetingCaptureCompleted.mock.callCount(),
      1,
    );
    assert.equal(meeting.audioBatches.length, 1);
    assert.equal(meeting.audioBatches[0]?.sequenceEnd, 2);
    assert.equal(meeting.audioBatches[0]?.durationMs, 4_000);
    assert.equal(meeting.transcript.length, 1);
    assert.equal(meeting.transcript[0]?.content, "partial flush works");
  });

  void it("persists parallel tab_mix and self_mic batches that share the same sequence window", async () => {
    const user = await createUser();
    const { service } = createService();

    mock.method(
      globalThis,
      "fetch",
      async (
        _input: Parameters<typeof fetch>[0],
        init: Parameters<typeof fetch>[1],
      ) => {
        const body = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({
            streamId: body.streamId,
            backendMeetingId: body.backendMeetingId,
            sequenceStart: body.sequenceStart,
            sequenceEnd: body.sequenceEnd,
            streamOffsetMs: body.streamOffsetMs,
            sourceType: body.sourceType,
            segments: [],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      },
    );

    const actor = {
      clerkUserId: user.clerkId!,
      localUserId: user.id,
    };
    const startAck = await service.beginStream("client_dual", actor, {
      streamId: "stream_dual",
      meetingId: "meet-dual",
      captureContext: "google_meet_room",
    });

    for (let sequence = 1; sequence <= 5; sequence += 1) {
      service.handleChunk("client_dual", actor, {
        streamId: "stream_dual",
        sequence,
        mimeType: "audio/webm;codecs=opus",
        payload: encodeChunk(`tab-${sequence}`),
        durationMs: 2_000,
        sourceType: "tab_mix",
      });

      service.handleChunk("client_dual", actor, {
        streamId: "stream_dual",
        sequence,
        mimeType: "audio/webm;codecs=opus",
        payload: encodeChunk(`mic-${sequence}`),
        durationMs: 2_000,
        sourceType: "self_mic",
      });
    }

    await delay(0);
    await service.stopStream("client_dual", actor, {
      streamId: "stream_dual",
    });

    const meeting = await prisma.meeting.findUniqueOrThrow({
      where: { id: startAck.backendMeetingId },
      include: {
        audioBatches: {
          orderBy: [{ sourceType: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    assert.equal(meeting.audioBatches.length, 2);
    assert.deepEqual(
      meeting.audioBatches.map((batch) => ({
        sourceType: batch.sourceType,
        sequenceStart: batch.sequenceStart,
        sequenceEnd: batch.sequenceEnd,
        status: batch.status,
      })),
      [
        {
          sourceType: "SELF_MIC",
          sequenceStart: 1,
          sequenceEnd: 5,
          status: "COMPLETED",
        },
        {
          sourceType: "TAB_MIX",
          sequenceStart: 1,
          sequenceEnd: 5,
          status: "COMPLETED",
        },
      ],
    );
  });
});

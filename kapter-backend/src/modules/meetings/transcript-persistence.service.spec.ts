import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { TranscriptPersistenceService } from "./transcript-persistence.service";

type SpeakerProfileUpsertArgs = {
  where: {
    meetingId_aiLabel: {
      aiLabel: string;
    };
  };
  create: {
    meetingId: string;
  };
};

const createService = () => {
  const findUnique = mock.fn(async (_args: unknown) => ({
    status: "PROCESSING",
  }));
  const findMany = mock.fn(async (_args: unknown) => [] as unknown[]);
  const findVoiceProfiles = mock.fn(async (_args: unknown) => [] as unknown[]);
  const upsert = mock.fn(
    async ({ where, create }: SpeakerProfileUpsertArgs) => ({
      id: `${where.meetingId_aiLabel.aiLabel}_id`,
      aiLabel: where.meetingId_aiLabel.aiLabel,
      meetingId: create.meetingId,
    }),
  );
  const createMany = mock.fn(async (_args: unknown) => ({ count: 2 }));
  const createSpeakerSamples = mock.fn(async (_args: unknown) => ({
    count: 1,
  }));
  const updateMany = mock.fn(async (_args: unknown) => ({ count: 0 }));
  const update = mock.fn(async (_args: unknown) => undefined as unknown);
  const notifyTranscriptPersisted = mock.fn(() => undefined);
  const logger = {
    info: mock.fn(() => undefined),
    warn: mock.fn(() => undefined),
  };

  const prisma = {
    $transaction: mock.fn(async (callback) =>
      callback({
        voiceProfile: { findMany: findVoiceProfiles },
        speakerProfile: { upsert },
        transcriptSegment: { createMany, findMany, updateMany },
        meetingSpeakerSample: { createMany: createSpeakerSamples },
        meetingAudioBatch: { findUnique, update },
      }),
    ),
  };

  const service = new TranscriptPersistenceService(
    prisma as never,
    { notifyTranscriptPersisted } as never,
    logger as never,
  );

  return {
    service,
    prisma,
    voiceProfile: { findMany: findVoiceProfiles },
    speakerProfile: { upsert },
    transcriptSegment: { createMany, findMany, updateMany },
    meetingSpeakerSample: { createMany: createSpeakerSamples },
    meetingAudioBatch: { findUnique, update },
    meetingArtifactExtraction: { notifyTranscriptPersisted },
    logger,
  };
};

void describe("TranscriptPersistenceService", () => {
  void it("upserts speakers, writes absolute transcript timestamps, and completes the owning batch", async () => {
    const {
      service,
      speakerProfile,
      transcriptSegment,
      meetingAudioBatch,
      meetingArtifactExtraction,
    } = createService();

    await service.persistWorkerBatch({
      batchId: "batch_1",
      request: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 5,
        streamOffsetMs: 10_000,
        durationMs: 10_000,
        mimeType: "audio/webm;codecs=opus",
        audioBase64: "Y2h1bms=",
      },
      response: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 5,
        streamOffsetMs: 10_000,
        segments: [
          {
            aiLabel: "SPEAKER_00",
            content: "Hello team.",
            startTime: 0.5,
            endTime: 1.25,
            confidence: 0.98,
          },
          {
            aiLabel: "SPEAKER_01",
            content: "Shipping today.",
            startTime: 2.0,
            endTime: 3.0,
            confidence: 0.94,
          },
        ],
      },
    });

    assert.equal(speakerProfile.upsert.mock.callCount(), 2);
    assert.equal(transcriptSegment.createMany.mock.callCount(), 1);

    const createManyCall = transcriptSegment.createMany.mock.calls[0];
    assert.ok(createManyCall);
    const transcriptRows = (createManyCall.arguments[0] as { data: unknown })
      .data;
    assert.deepEqual(transcriptRows, [
      {
        meetingId: "meeting_backend_1",
        speakerId: "SPEAKER_00_id",
        content: "Hello team.",
        sourceType: undefined,
        startTime: 10.5,
        endTime: 11.25,
        mergeStrategy: undefined,
        mergeSourceType: undefined,
        isSuppressed: false,
        suppressedAt: undefined,
      },
      {
        meetingId: "meeting_backend_1",
        speakerId: "SPEAKER_01_id",
        content: "Shipping today.",
        sourceType: undefined,
        startTime: 12,
        endTime: 13,
        mergeStrategy: undefined,
        mergeSourceType: undefined,
        isSuppressed: false,
        suppressedAt: undefined,
      },
    ]);
    assert.equal(transcriptSegment.findMany.mock.callCount(), 0);
    assert.equal(transcriptSegment.updateMany.mock.callCount(), 0);

    assert.equal(meetingAudioBatch.update.mock.callCount(), 1);
    const meetingAudioBatchUpdateCall = meetingAudioBatch.update.mock.calls[0];
    assert.ok(meetingAudioBatchUpdateCall);
    assert.equal(
      (meetingAudioBatchUpdateCall.arguments[0] as { data: { status: string } })
        .data.status,
      "COMPLETED",
    );
    assert.ok(
      (
        meetingAudioBatchUpdateCall.arguments[0] as {
          data: { processedAt: unknown };
        }
      ).data.processedAt instanceof Date,
    );
    assert.equal(
      meetingArtifactExtraction.notifyTranscriptPersisted.mock.callCount(),
      1,
    );
  });

  void it("returns early for an already completed batch without duplicating transcript state", async () => {
    const {
      service,
      speakerProfile,
      transcriptSegment,
      meetingAudioBatch,
      meetingArtifactExtraction,
    } = createService();

    meetingAudioBatch.findUnique.mock.mockImplementation(async () => ({
      status: "COMPLETED",
    }));

    await service.persistWorkerBatch({
      batchId: "batch_1",
      request: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 5,
        streamOffsetMs: 10_000,
        durationMs: 10_000,
        mimeType: "audio/webm;codecs=opus",
        audioBase64: "Y2h1bms=",
      },
      response: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 5,
        streamOffsetMs: 10_000,
        segments: [
          {
            aiLabel: "SPEAKER_00",
            content: "Hello team.",
            startTime: 0.5,
            endTime: 1.25,
            confidence: 0.98,
          },
        ],
      },
    });

    assert.equal(speakerProfile.upsert.mock.callCount(), 0);
    assert.equal(transcriptSegment.createMany.mock.callCount(), 0);
    assert.equal(transcriptSegment.updateMany.mock.callCount(), 0);
    assert.equal(meetingAudioBatch.update.mock.callCount(), 0);
    assert.equal(
      meetingArtifactExtraction.notifyTranscriptPersisted.mock.callCount(),
      1,
    );
  });

  void it("suppresses overlapping tab_mix duplicates when self_mic is authoritative", async () => {
    const { service, transcriptSegment, meetingAudioBatch } = createService();

    transcriptSegment.findMany.mock.mockImplementation(async () => [
      {
        id: "tab_seg_1",
        startTime: 10.45,
        endTime: 11.2,
        content: "hello team",
        sourceType: "TAB_MIX",
      },
    ]);

    await service.persistWorkerBatch({
      batchId: "batch_self_mic",
      request: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 1,
        streamOffsetMs: 10_000,
        durationMs: 1_000,
        mimeType: "audio/pcm;rate=16000;channels=1;encoding=s16le",
        audioBase64: "Y2h1bms=",
        sourceType: "self_mic",
        authoritativeSpeakerLabel: "RECORDER",
      },
      response: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 1,
        streamOffsetMs: 10_000,
        sourceType: "self_mic",
        segments: [
          {
            aiLabel: "RECORDER",
            content: "Hello team.",
            startTime: 0.5,
            endTime: 1.25,
            confidence: 0.98,
            sourceType: "self_mic",
          },
        ],
      },
    });

    assert.equal(transcriptSegment.findMany.mock.callCount(), 1);
    assert.equal(transcriptSegment.updateMany.mock.callCount(), 1);
    const updateManyCall = transcriptSegment.updateMany.mock.calls[0];
    assert.ok(updateManyCall);
    assert.deepEqual(updateManyCall.arguments[0], {
      where: {
        id: {
          in: ["tab_seg_1"],
        },
      },
      data: {
        isSuppressed: true,
        suppressedAt: (
          updateManyCall.arguments[0] as { data: { suppressedAt: unknown } }
        ).data.suppressedAt,
        mergeStrategy: "PREFERRED_SELF_MIC_DUPLICATE",
        mergeSourceType: "SELF_MIC",
      },
    });

    const selfMicCreateManyCall = transcriptSegment.createMany.mock.calls[0];
    assert.ok(selfMicCreateManyCall);
    const transcriptRows = (
      selfMicCreateManyCall.arguments[0] as { data: unknown }
    ).data;
    assert.deepEqual(transcriptRows, [
      {
        meetingId: "meeting_backend_1",
        speakerId: "RECORDER_id",
        content: "Hello team.",
        sourceType: "SELF_MIC",
        startTime: 10.5,
        endTime: 11.25,
        mergeStrategy: "PREFERRED_SELF_MIC_DUPLICATE",
        mergeSourceType: "TAB_MIX",
        isSuppressed: false,
        suppressedAt: undefined,
      },
    ]);
    assert.equal(meetingAudioBatch.update.mock.callCount(), 1);
  });

  void it("keeps ambiguous cross-source overlaps without suppressing either side", async () => {
    const { service, transcriptSegment } = createService();

    transcriptSegment.findMany.mock.mockImplementation(async () => [
      {
        id: "self_mic_seg_1",
        startTime: 12,
        endTime: 13,
        content: "We should ship today",
        sourceType: "SELF_MIC",
      },
    ]);

    await service.persistWorkerBatch({
      batchId: "batch_tab_mix",
      request: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 2,
        sequenceEnd: 2,
        streamOffsetMs: 12_000,
        durationMs: 1_000,
        mimeType: "audio/webm;codecs=opus",
        audioBase64: "Y2h1bms=",
        sourceType: "tab_mix",
      },
      response: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 2,
        sequenceEnd: 2,
        streamOffsetMs: 12_000,
        sourceType: "tab_mix",
        segments: [
          {
            aiLabel: "SPEAKER_01",
            content: "We should ship tomorrow",
            startTime: 0,
            endTime: 1,
            confidence: 0.94,
            sourceType: "tab_mix",
          },
        ],
      },
    });

    assert.equal(transcriptSegment.updateMany.mock.callCount(), 0);
    const ambiguousCreateManyCall = transcriptSegment.createMany.mock.calls[0];
    assert.ok(ambiguousCreateManyCall);
    const transcriptRows = (
      ambiguousCreateManyCall.arguments[0] as { data: unknown }
    ).data;
    assert.deepEqual(transcriptRows, [
      {
        meetingId: "meeting_backend_1",
        speakerId: "SPEAKER_01_id",
        content: "We should ship tomorrow",
        sourceType: "TAB_MIX",
        startTime: 12,
        endTime: 13,
        mergeStrategy: "AMBIGUOUS_OVERLAP",
        mergeSourceType: "SELF_MIC",
        isSuppressed: false,
        suppressedAt: undefined,
      },
    ]);
  });

  void it("drops unknown voice profile references from the worker response instead of failing transcript persistence", async () => {
    const {
      service,
      voiceProfile,
      speakerProfile,
      transcriptSegment,
      meetingSpeakerSample,
      logger,
    } = createService();

    voiceProfile.findMany.mock.mockImplementation(async () => []);

    await service.persistWorkerBatch({
      batchId: "batch_unknown_voice_profile",
      request: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 1,
        streamOffsetMs: 0,
        durationMs: 5_000,
        mimeType: "audio/mpeg",
        audioBase64: "Y2h1bms=",
        sourceType: "tab_mix",
      },
      response: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 1,
        streamOffsetMs: 0,
        sourceType: "tab_mix",
        segments: [
          {
            aiLabel: "Sơn",
            content: "Hello team.",
            startTime: 0,
            endTime: 1,
            confidence: 0.98,
            voiceProfileId: "missing_profile_id",
          },
        ],
        speakerEvidence: [
          {
            aiLabel: "Sơn",
            startTime: 0,
            endTime: 2.5,
            durationSeconds: 2.5,
            embedding: [0.1, 0.2, 0.3],
            voiceProfileId: "missing_profile_id",
            rmsDb: -22,
            speechRatio: 0.9,
            qualityScore: 0.88,
            sampleRate: 16000,
            sourceType: "tab_mix",
          },
        ],
      },
    });

    assert.equal(speakerProfile.upsert.mock.callCount(), 1);
    const upsertCall = speakerProfile.upsert.mock.calls[0];
    assert.ok(upsertCall);
    assert.equal(
      (
        upsertCall.arguments[0] as unknown as {
          create: { voiceProfileId: string | null };
        }
      ).create.voiceProfileId,
      null,
    );
    assert.equal(transcriptSegment.createMany.mock.callCount(), 1);
    assert.equal(meetingSpeakerSample.createMany.mock.callCount(), 1);
    assert.equal(logger.warn.mock.callCount(), 1);
  });

  void it("skips malformed speaker evidence samples with non-finite embedding values", async () => {
    const { service, meetingSpeakerSample, logger } = createService();

    await service.persistWorkerBatch({
      batchId: "batch_bad_evidence",
      request: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 1,
        streamOffsetMs: 0,
        durationMs: 5_000,
        mimeType: "audio/mpeg",
        audioBase64: "Y2h1bms=",
        sourceType: "tab_mix",
      },
      response: {
        streamId: "stream_1",
        backendMeetingId: "meeting_backend_1",
        sequenceStart: 1,
        sequenceEnd: 1,
        streamOffsetMs: 0,
        sourceType: "tab_mix",
        segments: [
          {
            aiLabel: "SPEAKER_00",
            content: "Hello team.",
            startTime: 0,
            endTime: 1,
            confidence: 0.98,
          },
        ],
        speakerEvidence: [
          {
            aiLabel: "SPEAKER_00",
            startTime: 0,
            endTime: 2.5,
            durationSeconds: 2.5,
            embedding: [Number.NaN, Number.POSITIVE_INFINITY],
            rmsDb: Number.NEGATIVE_INFINITY,
            speechRatio: Number.NaN,
            qualityScore: 0.88,
            sampleRate: Number.POSITIVE_INFINITY,
            sourceType: "tab_mix",
          },
          {
            aiLabel: "SPEAKER_00",
            startTime: 2.5,
            endTime: 5,
            durationSeconds: 2.5,
            embedding: [0.1, 0.2, 0.3],
            rmsDb: -22,
            speechRatio: 0.9,
            qualityScore: 0.88,
            sampleRate: 16000,
            sourceType: "tab_mix",
          },
        ],
      },
    });

    assert.equal(meetingSpeakerSample.createMany.mock.callCount(), 1);
    const createSpeakerSamplesCall =
      meetingSpeakerSample.createMany.mock.calls[0];
    assert.ok(createSpeakerSamplesCall);
    assert.deepEqual(createSpeakerSamplesCall.arguments[0], {
      data: [
        {
          speakerProfileId: "SPEAKER_00_id",
          embedding: [0.1, 0.2, 0.3],
          startTime: 2.5,
          endTime: 5,
          durationSeconds: 2.5,
          sourceType: "TAB_MIX",
          rmsDb: -22,
          speechRatio: 0.9,
          qualityScore: 0.88,
          sampleRate: 16000,
        },
      ],
    });
    assert.equal(logger.warn.mock.callCount(), 2);
  });
});

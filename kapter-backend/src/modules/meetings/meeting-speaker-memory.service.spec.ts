import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { MeetingSpeakerMemoryService } from "./meeting-speaker-memory.service";

const createEvidenceSample = (embedding: number[], createdAt: string) => ({
  embedding,
  durationSeconds: 3.6,
  rmsDb: -16,
  speechRatio: 0.94,
  qualityScore: 0.91,
  sampleRate: 16000,
  createdAt: new Date(createdAt),
});

afterEach(() => {
  mock.restoreAll();
});

void describe("MeetingSpeakerMemoryService", () => {
  void it("creates a recurring profile for a clean unknown speaker with enough evidence", async () => {
    const meetingFindUnique = mock.fn(async () => ({
      id: "meeting_1",
      userId: "user_1",
      status: "COMPLETED",
      artifactReviewStatus: "READY",
      speakers: [
        {
          id: "speaker_1",
          meetingId: "meeting_1",
          recurringSpeakerProfileId: null,
          meeting: {
            userId: "user_1",
          },
          evidenceSamples: [
            createEvidenceSample([1, 0], "2026-05-14T10:00:00.000Z"),
            createEvidenceSample([0.98, 0.02], "2026-05-14T10:00:05.000Z"),
          ],
        },
      ],
    }));
    const recurringFindMany = mock.fn(async () => []);
    const recurringCreate = mock.fn(async () => ({
      id: "recurring_1",
      meetingCount: 1,
    }));
    const speakerUpdate = mock.fn(async () => undefined);

    const service = new MeetingSpeakerMemoryService({
      meeting: {
        findUnique: meetingFindUnique,
      },
      recurringSpeakerProfile: {
        findMany: recurringFindMany,
        create: recurringCreate,
      },
      speakerProfile: {
        update: speakerUpdate,
      },
    } as never);

    const result = await service.linkRecurringSpeakersForMeeting("meeting_1");

    assert.deepEqual(result, {
      materialChanges: true,
      linkedSpeakers: 0,
      createdProfiles: 1,
    });
    assert.equal(recurringCreate.mock.callCount(), 1);
    assert.equal(speakerUpdate.mock.callCount(), 1);
    const firstCreateSpeakerUpdateCall = speakerUpdate.mock.calls.at(0);
    assert.ok(firstCreateSpeakerUpdateCall);
    const [firstCreateSpeakerUpdateArgs] =
      firstCreateSpeakerUpdateCall.arguments as unknown as [unknown];
    assert.deepEqual(firstCreateSpeakerUpdateArgs, {
      where: {
        id: "speaker_1",
      },
      data: {
        recurringSpeakerProfileId: "recurring_1",
        recurringMatchConfidence: 1,
        recurringMatchSeenCount: 1,
      },
    });
  });

  void it("relinks a later meeting speaker to an existing recurring profile when similarity is strong", async () => {
    const meetingFindUnique = mock.fn(async () => ({
      id: "meeting_2",
      userId: "user_1",
      status: "COMPLETED",
      artifactReviewStatus: "READY",
      speakers: [
        {
          id: "speaker_2",
          meetingId: "meeting_2",
          recurringSpeakerProfileId: null,
          meeting: {
            userId: "user_1",
          },
          evidenceSamples: [
            createEvidenceSample([1, 0], "2026-05-14T11:00:00.000Z"),
            createEvidenceSample([0.99, 0.01], "2026-05-14T11:00:05.000Z"),
          ],
        },
      ],
    }));
    const recurringFindMany = mock.fn(async () => [
      {
        id: "recurring_1",
        status: "CANDIDATE",
        meetingCount: 1,
        sampleCount: 2,
        lastSeenAt: new Date("2026-05-13T08:00:00.000Z"),
        samples: [
          {
            ...createEvidenceSample([1, 0], "2026-05-13T08:00:00.000Z"),
            sourceMeetingId: "meeting_1",
            sourceSpeakerProfileId: "speaker_1",
          },
          {
            ...createEvidenceSample([0.98, 0.02], "2026-05-13T08:00:05.000Z"),
            sourceMeetingId: "meeting_1",
            sourceSpeakerProfileId: "speaker_1",
          },
        ],
      },
    ]);
    const txSpeakerUpdate = mock.fn(async () => undefined);
    const txRecurringUpdate = mock.fn(async () => undefined);
    const txRecurringDeleteMany = mock.fn(async () => undefined);
    const txRecurringCreateMany = mock.fn(async () => undefined);
    const transaction = mock.fn(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        speakerProfile: {
          update: txSpeakerUpdate,
        },
        recurringSpeakerProfile: {
          update: txRecurringUpdate,
        },
        recurringSpeakerSample: {
          deleteMany: txRecurringDeleteMany,
          createMany: txRecurringCreateMany,
        },
      }),
    );

    const service = new MeetingSpeakerMemoryService({
      meeting: {
        findUnique: meetingFindUnique,
      },
      recurringSpeakerProfile: {
        findMany: recurringFindMany,
      },
      $transaction: transaction,
    } as never);

    const result = await service.linkRecurringSpeakersForMeeting("meeting_2");

    assert.deepEqual(result, {
      materialChanges: true,
      linkedSpeakers: 1,
      createdProfiles: 0,
    });
    assert.equal(transaction.mock.callCount(), 1);
    assert.equal(txSpeakerUpdate.mock.callCount(), 1);
    const firstLinkSpeakerUpdateCall = txSpeakerUpdate.mock.calls.at(0);
    assert.ok(firstLinkSpeakerUpdateCall);
    const [firstLinkSpeakerUpdateArgs] =
      firstLinkSpeakerUpdateCall.arguments as unknown as [unknown];
    assert.deepEqual(firstLinkSpeakerUpdateArgs, {
      where: {
        id: "speaker_2",
      },
      data: {
        recurringSpeakerProfileId: "recurring_1",
        recurringMatchConfidence: 1,
        recurringMatchSeenCount: 2,
      },
    });
    assert.equal(txRecurringDeleteMany.mock.callCount(), 1);
    assert.equal(txRecurringCreateMany.mock.callCount(), 1);
  });
});

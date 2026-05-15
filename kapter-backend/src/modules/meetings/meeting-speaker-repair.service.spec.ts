import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { MeetingSpeakerRepairService } from "./meeting-speaker-repair.service";

afterEach(() => {
  mock.restoreAll();
});

void describe("MeetingSpeakerRepairService", () => {
  void it("reassigns an obvious short backchannel to the adjacent stable speaker", async () => {
    const meetingFindUnique = mock.fn(async () => ({
      id: "meeting_1",
      status: "COMPLETED",
      artifactReviewStatus: "READY",
    }));
    const transcriptFindMany = mock.fn(async () => [
      {
        id: "segment_1",
        speakerId: "speaker_a",
        startTime: 0,
        endTime: 3,
        content: "We should review the launch checklist in detail.",
        sourceType: "TAB_MIX",
        mergeStrategy: null,
        speaker: {
          aiLabel: "P1",
          recurringSpeakerProfileId: "recurring_1",
        },
      },
      {
        id: "segment_2",
        speakerId: "speaker_b",
        startTime: 3.05,
        endTime: 3.4,
        content: "dạ",
        sourceType: "TAB_MIX",
        mergeStrategy: null,
        speaker: {
          aiLabel: "P2",
          recurringSpeakerProfileId: null,
        },
      },
      {
        id: "segment_3",
        speakerId: "speaker_a",
        startTime: 3.45,
        endTime: 6,
        content: "Then we can share the updated owner list.",
        sourceType: "TAB_MIX",
        mergeStrategy: null,
        speaker: {
          aiLabel: "P1",
          recurringSpeakerProfileId: "recurring_1",
        },
      },
    ]);
    const transcriptUpdate = mock.fn(async () => undefined);

    const service = new MeetingSpeakerRepairService({
      meeting: {
        findUnique: meetingFindUnique,
      },
      transcriptSegment: {
        findMany: transcriptFindMany,
        update: transcriptUpdate,
      },
    } as never);

    const result = await service.repairMeetingShortTurns("meeting_1");

    assert.deepEqual(result, {
      materialChanges: true,
      repairedSegments: 1,
    });
    assert.equal(transcriptUpdate.mock.callCount(), 1);
    const firstRepairUpdateCall = transcriptUpdate.mock.calls.at(0);
    assert.ok(firstRepairUpdateCall);
    const [firstRepairUpdateArgs] =
      firstRepairUpdateCall.arguments as unknown as [unknown];
    assert.deepEqual(firstRepairUpdateArgs, {
      where: {
        id: "segment_2",
      },
      data: {
        speakerId: "speaker_a",
      },
    });
  });

  void it("leaves ambiguous short turns untouched", async () => {
    const meetingFindUnique = mock.fn(async () => ({
      id: "meeting_2",
      status: "COMPLETED",
      artifactReviewStatus: "READY",
    }));
    const transcriptFindMany = mock.fn(async () => [
      {
        id: "segment_1",
        speakerId: "speaker_a",
        startTime: 0,
        endTime: 3,
        content: "We can merge this after final review.",
        sourceType: "TAB_MIX",
        mergeStrategy: null,
        speaker: {
          aiLabel: "P1",
          recurringSpeakerProfileId: null,
        },
      },
      {
        id: "segment_2",
        speakerId: "speaker_c",
        startTime: 3.05,
        endTime: 3.5,
        content: "ok",
        sourceType: "TAB_MIX",
        mergeStrategy: null,
        speaker: {
          aiLabel: "P3",
          recurringSpeakerProfileId: null,
        },
      },
      {
        id: "segment_3",
        speakerId: "speaker_b",
        startTime: 3.55,
        endTime: 6,
        content: "I still want one more pass on the transcript.",
        sourceType: "TAB_MIX",
        mergeStrategy: null,
        speaker: {
          aiLabel: "P2",
          recurringSpeakerProfileId: null,
        },
      },
    ]);
    const transcriptUpdate = mock.fn(async () => undefined);

    const service = new MeetingSpeakerRepairService({
      meeting: {
        findUnique: meetingFindUnique,
      },
      transcriptSegment: {
        findMany: transcriptFindMany,
        update: transcriptUpdate,
      },
    } as never);

    const result = await service.repairMeetingShortTurns("meeting_2");

    assert.deepEqual(result, {
      materialChanges: false,
      repairedSegments: 0,
    });
    assert.equal(transcriptUpdate.mock.callCount(), 0);
  });
});

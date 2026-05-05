import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyTaskMutationsToDraft,
  parseMeetingArtifactDraftTasks,
} from "./meeting-artifact-draft.utils";

void describe("parseMeetingArtifactDraftTasks", () => {
  void it("returns an empty list for non-array JSON", () => {
    assert.deepEqual(parseMeetingArtifactDraftTasks(null), []);
  });
});

void describe("applyTaskMutationsToDraft", () => {
  void it("creates, updates, and cancels rolling tasks with stable keys", () => {
    const createdTasks = applyTaskMutationsToDraft(
      [],
      [
        {
          type: "CREATE",
          taskContent: "Ship the review page",
          assigneeAiLabel: "Speaker 0",
          deadline: "2026-05-01",
        },
      ],
      0,
    );

    assert.deepEqual(createdTasks, [
      {
        taskKey: "task_1",
        taskContent: "Ship the review page",
        assigneeAiLabel: "Speaker 0",
        deadline: "2026-05-01T00:00:00.000Z",
        active: true,
        lastMutationChunkIndex: 0,
      },
    ]);

    const updatedTasks = applyTaskMutationsToDraft(
      createdTasks,
      [
        {
          type: "UPDATE",
          taskKey: "task_1",
          taskContent: "Ship the review panel",
          deadline: null,
        },
      ],
      1,
    );

    assert.deepEqual(updatedTasks, [
      {
        taskKey: "task_1",
        taskContent: "Ship the review panel",
        assigneeAiLabel: "Speaker 0",
        deadline: null,
        active: true,
        lastMutationChunkIndex: 1,
      },
    ]);

    const cancelledTasks = applyTaskMutationsToDraft(
      updatedTasks,
      [
        {
          type: "CANCEL",
          taskKey: "task_1",
        },
      ],
      2,
    );

    assert.deepEqual(cancelledTasks, [
      {
        taskKey: "task_1",
        taskContent: "Ship the review panel",
        assigneeAiLabel: "Speaker 0",
        deadline: null,
        active: false,
        lastMutationChunkIndex: 2,
      },
    ]);
  });

  void it("rejects updates for unknown task keys", () => {
    assert.throws(
      () =>
        applyTaskMutationsToDraft(
          [],
          [
            {
              type: "UPDATE",
              taskKey: "task_9",
              taskContent: "Unknown task",
            },
          ],
          0,
        ),
      /unknown rolling draft task key/i,
    );
  });
});

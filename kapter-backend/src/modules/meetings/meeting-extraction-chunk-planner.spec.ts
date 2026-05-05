import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planMeetingExtractionChunks } from "./meeting-extraction-chunk-planner";

void describe("planMeetingExtractionChunks", () => {
  void it("creates full 3-minute chunks with a 30-second overlap while recording", () => {
    const plannedChunks = planMeetingExtractionChunks({
      existingChunkCount: 0,
      maxTranscriptEndMs: 360_000,
      captureCompleted: false,
      targetWindowMs: 180_000,
      overlapWindowMs: 30_000,
    });

    assert.deepEqual(plannedChunks, [
      {
        chunkIndex: 0,
        newContentStartMs: 0,
        promptStartMs: 0,
        promptEndMs: 180_000,
      },
      {
        chunkIndex: 1,
        newContentStartMs: 180_000,
        promptStartMs: 150_000,
        promptEndMs: 360_000,
      },
    ]);
  });

  void it("emits a final tail chunk after capture completes", () => {
    const plannedChunks = planMeetingExtractionChunks({
      existingChunkCount: 1,
      maxTranscriptEndMs: 245_000,
      captureCompleted: true,
      targetWindowMs: 180_000,
      overlapWindowMs: 30_000,
    });

    assert.deepEqual(plannedChunks, [
      {
        chunkIndex: 1,
        newContentStartMs: 180_000,
        promptStartMs: 150_000,
        promptEndMs: 245_000,
      },
    ]);
  });

  void it("is idempotent when all eligible chunks already exist", () => {
    const plannedChunks = planMeetingExtractionChunks({
      existingChunkCount: 2,
      maxTranscriptEndMs: 245_000,
      captureCompleted: true,
      targetWindowMs: 180_000,
      overlapWindowMs: 30_000,
    });

    assert.deepEqual(plannedChunks, []);
  });
});

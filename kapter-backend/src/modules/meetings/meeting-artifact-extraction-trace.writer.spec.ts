import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, mock } from "node:test";

import { MeetingArtifactExtractionTraceWriter } from "./meeting-artifact-extraction-trace.writer";

const createLogger = () =>
  ({
    warn: mock.fn(() => undefined),
  }) as never;

void describe("MeetingArtifactExtractionTraceWriter", () => {
  void it("does not create trace files when dumping is disabled", () => {
    const traceRoot = mkdtempSync(
      path.join(os.tmpdir(), "meeting-extraction-trace-disabled-"),
    );

    try {
      const writer = new MeetingArtifactExtractionTraceWriter(
        {
          enabled: false,
          traceDir: traceRoot,
        },
        createLogger(),
      );

      writer.append("meeting/1", "chunk_completed", {
        chunkIndex: 0,
      });

      assert.equal(existsSync(path.join(traceRoot, "meeting_1.trace.log")), false);
    } finally {
      rmSync(traceRoot, { recursive: true, force: true });
    }
  });

  void it("appends human-readable trace entries into a per-meeting file", () => {
    const traceRoot = mkdtempSync(
      path.join(os.tmpdir(), "meeting-extraction-trace-enabled-"),
    );

    try {
      const writer = new MeetingArtifactExtractionTraceWriter(
        {
          enabled: true,
          traceDir: traceRoot,
        },
        createLogger(),
      );

      writer.append("meeting/1", "chunk_completed", {
        chunkIndex: 2,
        taskMutationCount: 1,
      });

      const filePath = path.join(traceRoot, "meeting_1.trace.log");
      const content = readFileSync(filePath, "utf8");

      assert.match(content, /=== chunk_completed ===/);
      assert.match(content, /meetingId: meeting\/1/);
      assert.match(content, /"chunkIndex": 2/);
      assert.match(content, /"taskMutationCount": 1/);
    } finally {
      rmSync(traceRoot, { recursive: true, force: true });
    }
  });
});

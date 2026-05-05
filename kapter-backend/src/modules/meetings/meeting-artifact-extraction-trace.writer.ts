import { appendFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";

import type { Logger } from "winston";

export interface MeetingArtifactExtractionTraceWriterOptions {
  enabled: boolean;
  traceDir: string;
}

const sanitizeMeetingId = (meetingId: string): string =>
  meetingId.replace(/[^a-zA-Z0-9_-]/g, "_");

export class MeetingArtifactExtractionTraceWriter {
  private readonly resolvedTraceDir: string | null;

  constructor(
    private readonly options: MeetingArtifactExtractionTraceWriterOptions,
    private readonly logger: Logger,
  ) {
    this.resolvedTraceDir = options.enabled
      ? path.resolve(process.cwd(), options.traceDir)
      : null;
  }

  append(
    meetingId: string,
    event: string,
    payload?: Record<string, unknown>,
  ): void {
    if (!this.resolvedTraceDir) {
      return;
    }

    try {
      mkdirSync(this.resolvedTraceDir, { recursive: true });

      const filePath = path.join(
        this.resolvedTraceDir,
        `${sanitizeMeetingId(meetingId)}.trace.log`,
      );
      const entry = [
        `=== ${event} ===`,
        `timestamp: ${new Date().toISOString()}`,
        `meetingId: ${meetingId}`,
        payload
          ? `payload: ${JSON.stringify(payload, null, 2)}`
          : "payload: {}",
        "",
      ].join("\n");

      // Keep trace entries ordered for one meeting file. This path is optional
      // and only intended for explicit extraction observability.
      appendFileSync(filePath, entry, "utf8");
    } catch (error) {
      this.logger.warn("Failed to append meeting extraction trace dump", {
        meetingId,
        event,
        traceDir: this.resolvedTraceDir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

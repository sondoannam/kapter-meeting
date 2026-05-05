import type {
  WorkerAudioBatchRequest,
  WorkerTranscriptionResponse,
} from "@kapter/contracts";
import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { appConfig } from "../../config/app.config";
import { PrismaService } from "../../database/prisma.service";
import { toPrismaAudioSourceType } from "../audio-stream/audio-source.utils";

export interface ProcessedAudioBatch {
  batchId: string;
  request: WorkerAudioBatchRequest;
  response: WorkerTranscriptionResponse;
}

@Injectable()
export class AiWorkerClient {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  getBaseUrl(): string {
    return this.config.aiWorker.baseUrl;
  }

  getTimeoutMs(): number {
    return this.config.aiWorker.timeoutMs;
  }

  getProcessAudioUrl(): string {
    return new URL(
      "/api/v1/process-audio",
      this.config.aiWorker.baseUrl,
    ).toString();
  }

  async processAudioBatch(
    request: WorkerAudioBatchRequest,
  ): Promise<ProcessedAudioBatch> {
    const batchRecord = await this.prisma.meetingAudioBatch.create({
      data: {
        meetingId: request.backendMeetingId,
        streamId: request.streamId,
        sourceType: toPrismaAudioSourceType(request.sourceType),
        sequenceStart: request.sequenceStart,
        sequenceEnd: request.sequenceEnd,
        streamOffsetMs: request.streamOffsetMs,
        durationMs: request.durationMs,
        mimeType: request.mimeType,
        status: "PENDING",
      },
    });

    await this.prisma.meetingAudioBatch.update({
      where: { id: batchRecord.id },
      data: {
        status: "PROCESSING",
        error: null,
      },
    });

    try {
      const response = await this.postWithRetry(request);

      return {
        batchId: batchRecord.id,
        request,
        response,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.meetingAudioBatch.update({
        where: { id: batchRecord.id },
        data: {
          status: "FAILED",
          error: errorMessage,
        },
      });

      throw error;
    }
  }

  private async postWithRetry(
    request: WorkerAudioBatchRequest,
  ): Promise<WorkerTranscriptionResponse> {
    try {
      return await this.post(request);
    } catch (error) {
      if (!this.isTransientFailure(error)) {
        throw error;
      }

      this.logger.warn("Retrying transient AI worker batch request", {
        streamId: request.streamId,
        backendMeetingId: request.backendMeetingId,
        sequenceStart: request.sequenceStart,
        sequenceEnd: request.sequenceEnd,
      });

      return this.post(request);
    }
  }

  private async post(
    request: WorkerAudioBatchRequest,
  ): Promise<WorkerTranscriptionResponse> {
    const abortController = new AbortController();
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const sharedSecret = this.config.aiWorker.sharedSecret;
    const timeoutHandle = setTimeout(
      () => abortController.abort(),
      this.getTimeoutMs(),
    );

    try {
      if (sharedSecret) {
        headers.authorization = `Bearer ${sharedSecret}`;
      }

      const response = await fetch(this.getProcessAudioUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();

        throw new Error(
          `AI worker request failed with ${response.status}: ${errorBody}`,
        );
      }

      return (await response.json()) as WorkerTranscriptionResponse;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private isTransientFailure(error: unknown): boolean {
    return (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "AbortError")
    );
  }
}

import type {
  AudioSourceType,
  WorkerAudioBatchRequest,
  WorkerFileTranscriptionResponse,
  WorkerTranscriptionResponse,
  WorkerVoiceProfileCacheUpsertRequest,
  WorkerVoiceProfileEnrollmentResponse,
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

export interface ProcessAudioFileRequest {
  backendMeetingId: string;
  streamId: string;
  sourceType: AudioSourceType;
  knownVoiceProfileIds: string[];
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
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

  getFileTimeoutMs(): number {
    return this.config.aiWorker.fileTimeoutMs;
  }

  getProcessAudioUrl(): string {
    return new URL(
      "/api/v1/process-audio",
      this.config.aiWorker.baseUrl,
    ).toString();
  }

  getProcessAudioFileUrl(): string {
    return new URL(
      "/api/v1/process-audio-file",
      this.config.aiWorker.baseUrl,
    ).toString();
  }

  getVoiceProfileEnrollmentUrl(): string {
    return new URL(
      "/api/v1/voice-profiles/enrollment-extract",
      this.config.aiWorker.baseUrl,
    ).toString();
  }

  getVoiceProfileCacheUrl(voiceProfileId: string): string {
    return new URL(
      `/api/v1/voice-profiles/cache/${voiceProfileId}`,
      this.config.aiWorker.baseUrl,
    ).toString();
  }

  getVoiceProfileCacheCollectionUrl(): string {
    return new URL(
      "/api/v1/voice-profiles/cache",
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

  async processAudioFile(
    request: ProcessAudioFileRequest,
  ): Promise<WorkerFileTranscriptionResponse> {
    const formData = new FormData();

    formData.set("backendMeetingId", request.backendMeetingId);
    formData.set("streamId", request.streamId);
    formData.set("sourceType", request.sourceType);

    for (const voiceProfileId of request.knownVoiceProfileIds) {
      formData.append("knownVoiceProfileIds", voiceProfileId);
    }

    formData.set(
      "file",
      new Blob([Uint8Array.from(request.fileBuffer)], {
        type: request.mimeType,
      }),
      request.fileName,
    );

    return this.requestMultipart<WorkerFileTranscriptionResponse>(
      this.getProcessAudioFileUrl(),
      {
        method: "POST",
        body: formData,
        timeoutMs: this.getFileTimeoutMs(),
      },
    );
  }

  async extractVoiceProfileEnrollment(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<WorkerVoiceProfileEnrollmentResponse> {
    return this.requestJson<WorkerVoiceProfileEnrollmentResponse>(
      this.getVoiceProfileEnrollmentUrl(),
      {
        method: "POST",
        body: JSON.stringify({
          mimeType,
          audioBase64: audioBuffer.toString("base64"),
        }),
      },
    );
  }

  async upsertVoiceProfileCache(
    payload: WorkerVoiceProfileCacheUpsertRequest,
  ): Promise<void> {
    await this.requestJson(
      this.getVoiceProfileCacheUrl(payload.voiceProfileId),
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
  }

  async deleteVoiceProfileCache(voiceProfileId: string): Promise<void> {
    await this.requestJson(this.getVoiceProfileCacheUrl(voiceProfileId), {
      method: "DELETE",
    });
  }

  async clearVoiceProfileCache(): Promise<void> {
    await this.requestJson(this.getVoiceProfileCacheCollectionUrl(), {
      method: "DELETE",
    });
  }

  private async postWithRetry(
    request: WorkerAudioBatchRequest,
  ): Promise<WorkerTranscriptionResponse> {
    try {
      return await this.requestJson<WorkerTranscriptionResponse>(
        this.getProcessAudioUrl(),
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      );
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

      return this.requestJson<WorkerTranscriptionResponse>(
        this.getProcessAudioUrl(),
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      );
    }
  }

  private async requestJson<T>(
    url: string,
    init: {
      method: "POST" | "PUT" | "DELETE";
      body?: string;
    },
  ): Promise<T> {
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

      const response = await fetch(url, {
        method: init.method,
        headers,
        body: init.body,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();

        throw new Error(
          `AI worker request failed with ${response.status}: ${errorBody}`,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async requestMultipart<T>(
    url: string,
    init: {
      method: "POST";
      body: FormData;
      timeoutMs?: number;
    },
  ): Promise<T> {
    const abortController = new AbortController();
    const headers: Record<string, string> = {};
    const sharedSecret = this.config.aiWorker.sharedSecret;
    const timeoutHandle = setTimeout(
      () => abortController.abort(),
      init.timeoutMs ?? this.getTimeoutMs(),
    );

    try {
      if (sharedSecret) {
        headers.authorization = `Bearer ${sharedSecret}`;
      }

      const response = await fetch(url, {
        method: init.method,
        headers,
        body: init.body,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();

        throw new Error(
          `AI worker request failed with ${response.status}: ${errorBody}`,
        );
      }

      return (await response.json()) as T;
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

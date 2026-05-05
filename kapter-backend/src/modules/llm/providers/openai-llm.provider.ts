import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import OpenAI, { APIConnectionTimeoutError, APIError } from "openai";

import { appConfig } from "src/config/app.config";
import { parseJsonObject } from "../schemas/meeting-artifacts.schema";
import type {
  GenerateJsonProviderRequest,
  LlmProviderHealthStatus,
  LlmProvider,
  LlmProviderName,
} from "./llm-provider.interface";
import {
  dumpLlmPromptToFile,
  toErrorMessage,
} from "./llm-provider-observability";

@Injectable()
export class OpenAiLlmProvider implements LlmProvider {
  readonly name: LlmProviderName = "openai";
  private readonly logger = new Logger(OpenAiLlmProvider.name);

  private readonly client: OpenAI | null;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly enablePromptDump: boolean;
  private readonly logDir: string;

  constructor(
    @Inject(appConfig.KEY)
    config: ConfigType<typeof appConfig>,
  ) {
    this.model = config.llm.openAiModel;
    this.timeoutMs = config.llm.openAiTimeoutMs;
    this.maxRetries = config.llm.openAiMaxRetries;
    this.enablePromptDump = config.llm.openAiEnablePromptDump;
    this.logDir = config.logDir;
    this.client = config.llm.openAiApiKey
      ? new OpenAI({
          apiKey: config.llm.openAiApiKey,
          timeout: this.timeoutMs,
          maxRetries: this.maxRetries,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async checkHealth(): Promise<LlmProviderHealthStatus> {
    if (!this.client) {
      return {
        provider: this.name,
        status: "not_configured",
        configured: false,
        authStatus: "not_configured",
        model: this.model,
        endpoint: "/v1/models/:model",
        message: "OpenAI API key is not configured.",
      };
    }

    const startTime = Date.now();

    try {
      const response = await this.client.models.retrieve(this.model);

      return {
        provider: this.name,
        status: "ok",
        configured: true,
        authStatus: "valid",
        model: response.id ?? this.model,
        endpoint: "/v1/models/:model",
        latencyMs: Date.now() - startTime,
        requestId: response._request_id ?? undefined,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof APIError) {
        return {
          provider: this.name,
          status: "error",
          configured: true,
          authStatus: error.status === 401 ? "invalid" : "unknown",
          model: this.model,
          endpoint: "/v1/models/:model",
          latencyMs,
          requestId: error.requestID ?? undefined,
          code: error.code ?? undefined,
          message: error.message,
        };
      }

      return {
        provider: this.name,
        status: "error",
        configured: true,
        authStatus: "unknown",
        model: this.model,
        endpoint: "/v1/models/:model",
        latencyMs,
        message: toErrorMessage(error),
      };
    }
  }

  async generateJson(request: GenerateJsonProviderRequest): Promise<unknown> {
    if (!this.client) {
      throw new Error("OpenAI provider is not configured.");
    }

    dumpLlmPromptToFile({
      enabled: this.enablePromptDump,
      logDir: this.logDir,
      logger: this.logger,
      providerName: this.name,
      model: this.model,
      request,
      systemPrompt: request.systemPrompt,
      settings: {
        endpoint: "/v1/responses",
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
        temperature: 0.1,
        schemaStrict: true,
      },
    });

    this.logger.debug(
      `Sending request to OpenAI: Model=${this.model}, Timeout=${this.timeoutMs}ms, MaxRetries=${this.maxRetries}, SystemPromptChars=${request.systemPrompt.length}, UserPromptChars=${request.userPrompt.length}`,
    );

    const startTime = Date.now();

    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions: request.systemPrompt,
        input: request.userPrompt,
        store: false,
        temperature: 0.1,
        text: {
          format: {
            type: "json_schema",
            name: request.schemaName,
            strict: true,
            schema: request.jsonSchema,
          },
        },
      });

      if (!response.output_text) {
        throw new Error("OpenAI provider returned an empty response.");
      }

      const latency = Date.now() - startTime;
      this.logger.debug(
        `OpenAI request successful: RequestId=${response._request_id ?? "n/a"}, Latency=${latency}ms, InputTokens=${response.usage?.input_tokens ?? "n/a"}, OutputTokens=${response.usage?.output_tokens ?? "n/a"}, TotalTokens=${response.usage?.total_tokens ?? "n/a"}, CachedInputTokens=${response.usage?.input_tokens_details.cached_tokens ?? "n/a"}, ReasoningTokens=${response.usage?.output_tokens_details.reasoning_tokens ?? "n/a"}, ContentLength=${response.output_text.length}`,
      );

      return parseJsonObject(response.output_text);
    } catch (error) {
      const elapsedMs = Date.now() - startTime;

      if (
        error instanceof APIConnectionTimeoutError ||
        (error instanceof Error && error.name === "APIConnectionTimeoutError")
      ) {
        this.logger.error(
          `OpenAI provider timed out after ${elapsedMs}ms. Configured timeout: ${this.timeoutMs}ms. Cause: ${error.message}`,
        );
        throw new Error(
          `OpenAI provider timed out after ${elapsedMs}ms. Configured timeout: ${this.timeoutMs}ms. Cause: ${error.message}`,
        );
      }

      if (error instanceof APIError) {
        this.logger.error(
          `OpenAI request failed after ${elapsedMs}ms: Status=${error.status ?? "n/a"}, RequestId=${error.requestID ?? "n/a"}, Code=${error.code ?? "n/a"}, Message=${error.message}`,
        );
        throw error;
      }

      this.logger.error(
        `OpenAI request failed after ${elapsedMs}ms: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }
}

import { ApiError, GoogleGenAI } from "@google/genai";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

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

const THINKING_BUDGET_MODEL_PATTERN = /^gemini-2\.5-/i;

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  readonly name: LlmProviderName = "gemini";
  private readonly logger = new Logger(GeminiLlmProvider.name);

  private readonly client: GoogleGenAI | null;
  private readonly apiVersion: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly enablePromptDump: boolean;
  private readonly thinkingBudget: number;
  private readonly logDir: string;

  constructor(
    @Inject(appConfig.KEY)
    config: ConfigType<typeof appConfig>,
  ) {
    this.apiVersion = config.llm.geminiApiVersion;
    this.model = config.llm.geminiModel;
    this.timeoutMs = config.llm.geminiTimeoutMs;
    this.maxRetries = config.llm.geminiMaxRetries;
    this.enablePromptDump = config.llm.geminiEnablePromptDump;
    this.thinkingBudget = config.llm.geminiThinkingBudget;
    this.logDir = config.logDir;
    this.client = config.llm.googleApiKey
      ? new GoogleGenAI({
          apiKey: config.llm.googleApiKey,
          apiVersion: this.apiVersion,
          httpOptions: {
            timeout: this.timeoutMs,
            retryOptions: {
              attempts: Math.max(this.maxRetries + 1, 1),
            },
          },
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
        endpoint: "models.get",
        message: "Gemini API key is not configured.",
      };
    }

    const startTime = Date.now();

    try {
      const response = await this.client.models.get({
        model: this.model,
      });

      return {
        provider: this.name,
        status: "ok",
        configured: true,
        authStatus: "valid",
        model: response.name ?? this.model,
        endpoint: "models.get",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof ApiError) {
        return {
          provider: this.name,
          status: "error",
          configured: true,
          authStatus: this.resolveAuthStatus(error),
          model: this.model,
          endpoint: "models.get",
          latencyMs,
          code: String(error.status),
          message: error.message,
        };
      }

      return {
        provider: this.name,
        status: "error",
        configured: true,
        authStatus: "unknown",
        model: this.model,
        endpoint: "models.get",
        latencyMs,
        message: toErrorMessage(error),
      };
    }
  }

  async generateJson(request: GenerateJsonProviderRequest): Promise<unknown> {
    if (!this.client) {
      throw new Error("Gemini provider is not configured.");
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
        apiVersion: this.apiVersion,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
        temperature: 0.1,
        candidateCount: 1,
        responseMimeType: "application/json",
        thinkingBudget: this.supportsThinkingBudget()
          ? this.thinkingBudget
          : undefined,
      },
    });

    this.logger.debug(
      `Sending request to Gemini: Model=${this.model}, ApiVersion=${this.apiVersion}, Timeout=${this.timeoutMs}ms, MaxRetries=${this.maxRetries}, ThinkingBudget=${this.supportsThinkingBudget() ? this.thinkingBudget : "unsupported"}, SystemPromptChars=${request.systemPrompt.length}, UserPromptChars=${request.userPrompt.length}`,
    );

    const startTime = Date.now();

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: request.userPrompt,
        config: {
          systemInstruction: request.systemPrompt,
          temperature: 0.1,
          candidateCount: 1,
          responseMimeType: "application/json",
          responseJsonSchema: request.jsonSchema,
          ...(this.supportsThinkingBudget()
            ? {
                thinkingConfig: {
                  thinkingBudget: this.thinkingBudget,
                },
              }
            : {}),
        },
      });

      const outputText = response.text;

      if (!outputText) {
        const blockReason = response.promptFeedback?.blockReasonMessage;
        throw new Error(
          blockReason
            ? `Gemini provider returned an empty response. Block reason: ${blockReason}`
            : "Gemini provider returned an empty response.",
        );
      }

      const latency = Date.now() - startTime;
      this.logger.debug(
        `Gemini request successful: ResponseId=${response.responseId ?? "n/a"}, ModelVersion=${response.modelVersion ?? "n/a"}, Status=${response.sdkHttpResponse?.responseInternal?.status ?? "n/a"}, Latency=${latency}ms, PromptTokens=${response.usageMetadata?.promptTokenCount ?? "n/a"}, CandidateTokens=${response.usageMetadata?.candidatesTokenCount ?? "n/a"}, ThoughtsTokens=${response.usageMetadata?.thoughtsTokenCount ?? "n/a"}, TotalTokens=${response.usageMetadata?.totalTokenCount ?? "n/a"}, ContentLength=${outputText.length}`,
      );

      return parseJsonObject(outputText);
    } catch (error) {
      const elapsedMs = Date.now() - startTime;

      if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
        this.logger.error(
          `Gemini provider timed out after ${elapsedMs}ms. Configured timeout: ${this.timeoutMs}ms. Cause: ${error.message}`,
        );
        throw new Error(
          `Gemini provider timed out after ${elapsedMs}ms. Configured timeout: ${this.timeoutMs}ms. Cause: ${error.message}`,
        );
      }

      if (error instanceof ApiError) {
        this.logger.error(
          `Gemini request failed after ${elapsedMs}ms: Status=${error.status}, Message=${error.message}`,
        );
        throw error;
      }

      this.logger.error(
        `Gemini request failed after ${elapsedMs}ms: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  private supportsThinkingBudget(): boolean {
    return THINKING_BUDGET_MODEL_PATTERN.test(this.model);
  }

  private resolveAuthStatus(error: ApiError): "invalid" | "unknown" {
    const message = error.message.toLowerCase();

    if (
      error.status === 401 ||
      error.status === 403 ||
      message.includes("api key") ||
      message.includes("credential") ||
      message.includes("authentication") ||
      message.includes("permission denied")
    ) {
      return "invalid";
    }

    return "unknown";
  }
}

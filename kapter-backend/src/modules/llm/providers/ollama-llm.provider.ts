import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { appConfig } from "../../../config/app.config";
import {
  extractStructuredJsonText,
  parseJsonObject,
} from "../schemas/meeting-artifacts.schema";
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

interface OllamaChatMessage {
  content?: string;
  thinking?: string;
}

interface OllamaChatResponse {
  message?: OllamaChatMessage;
}

interface OllamaChatAccumulator {
  body: string;
  bufferedText: string;
  content: string;
  thinking: string;
}

type OllamaStructuredOutputStrategy = "reasoning" | "schema";

const REASONING_MODEL_PATTERNS = [
  /qwen3(?:\.5)?/i,
  /deepseek-r1/i,
  /(?:^|[/:._-])qwq(?:$|[/:._-])/i,
];

@Injectable()
export class OllamaLlmProvider implements LlmProvider {
  readonly name: LlmProviderName = "ollama";
  private readonly logger = new Logger(OllamaLlmProvider.name);

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly structuredOutputMode: "auto" | "reasoning" | "schema";
  private readonly timeoutMs: number;
  private readonly enablePromptDump: boolean;
  private readonly logDir: string;

  constructor(
    @Inject(appConfig.KEY)
    config: ConfigType<typeof appConfig>,
  ) {
    this.baseUrl = config.llm.ollamaBaseUrl;
    this.model = config.llm.ollamaModel;
    this.structuredOutputMode = config.llm.ollamaStructuredOutputMode;
    this.timeoutMs = config.llm.ollamaTimeoutMs;
    this.enablePromptDump = config.llm.ollamaEnablePromptDump;
    this.logDir = config.logDir;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.model);
  }

  async checkHealth(): Promise<LlmProviderHealthStatus> {
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        status: "not_configured",
        configured: false,
        authStatus: "not_configured",
        model: this.model,
        endpoint: "/api/tags",
        message: "Ollama base URL or model is not configured.",
      };
    }

    const startTime = Date.now();
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(
      () => abortController.abort(),
      this.timeoutMs,
    );

    try {
      const response = await fetch(new URL("/api/tags", this.baseUrl), {
        signal: abortController.signal,
      });

      if (!response.ok) {
        return {
          provider: this.name,
          status: "error",
          configured: true,
          authStatus: "not_applicable",
          model: this.model,
          endpoint: "/api/tags",
          latencyMs: Date.now() - startTime,
          code: String(response.status),
          message: `Ollama health probe failed with ${response.status}.`,
        };
      }

      return {
        provider: this.name,
        status: "ok",
        configured: true,
        authStatus: "not_applicable",
        model: this.model,
        endpoint: "/api/tags",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        provider: this.name,
        status: "error",
        configured: true,
        authStatus: "not_applicable",
        model: this.model,
        endpoint: "/api/tags",
        latencyMs: Date.now() - startTime,
        message: toErrorMessage(error),
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async generateJson(request: GenerateJsonProviderRequest): Promise<unknown> {
    if (!this.isConfigured()) {
      throw new Error("Ollama provider is not configured.");
    }

    const structuredOutputStrategy = this.resolveStructuredOutputStrategy();
    const systemPrompt = this.buildSystemPrompt(
      request,
      structuredOutputStrategy,
    );

    if (this.enablePromptDump) {
      dumpLlmPromptToFile({
        enabled: true,
        logDir: this.logDir,
        logger: this.logger,
        providerName: this.name,
        model: this.model,
        request,
        systemPrompt,
        settings: {
          endpoint: "/api/chat",
          stream: true,
          structuredOutput: structuredOutputStrategy,
          temperature: 0.1,
          timeoutMs: this.timeoutMs,
        },
      });
    }

    this.logger.debug(
      `Sending request to Ollama: URL=${this.baseUrl}/api/chat, Model=${this.model}, Timeout=${this.timeoutMs}ms, StructuredOutput=${structuredOutputStrategy}, Streaming=true, SystemPromptChars=${systemPrompt.length}, UserPromptChars=${request.userPrompt.length}`,
    );

    const startTime = Date.now();

    try {
      const response = await this.postChatRequest({
        model: this.model,
        stream: true,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: request.userPrompt,
          },
        ],
        ...(structuredOutputStrategy === "schema"
          ? { format: request.jsonSchema }
          : {}),
        options: {
          temperature: 0.1,
        },
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        this.logger.error(
          `Ollama provider returned HTTP ${response.statusCode}: ${response.body}`,
        );
        throw new Error(
          `Ollama provider returned HTTP ${response.statusCode}: ${response.body}`,
        );
      }

      const content = response.content.trim();

      if (!content) {
        throw new Error("Ollama provider returned an empty response.");
      }

      const latency = Date.now() - startTime;
      this.logger.debug(
        `Ollama request successful: Latency=${latency}ms, ContentLength=${content.length}, ThinkingLength=${response.thinking.length}, StructuredOutput=${structuredOutputStrategy}`,
      );

      return parseJsonObject(
        structuredOutputStrategy === "reasoning"
          ? extractStructuredJsonText(content)
          : content,
      );
    } catch (error) {
      const elapsedMs = Date.now() - startTime;

      if (error instanceof Error && error.name === "AbortError") {
        this.logger.error(
          `Ollama provider timed out after ${elapsedMs}ms. Cause: ${error.message}. Configured timeout: ${this.timeoutMs}ms.`,
        );
        throw new Error(
          `Ollama provider timed out after ${elapsedMs}ms. Cause: ${error.message}. Configured timeout: ${this.timeoutMs}ms.`,
        );
      }

      this.logger.error(
        `Ollama request failed after ${elapsedMs}ms: ${
          toErrorMessage(error)
        }`,
      );
      throw error;
    }
  }

  private async postChatRequest(payload: Record<string, unknown>): Promise<{
    statusCode: number;
    body: string;
    content: string;
    thinking: string;
  }> {
    const url = new URL("/api/chat", this.baseUrl);
    const requestBody = JSON.stringify(payload);
    const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;

    return await new Promise((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const req = requestFn(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestBody),
          },
        },
        (response) => {
          const statusCode = response.statusCode ?? 0;
          const accumulator: OllamaChatAccumulator = {
            body: "",
            bufferedText: "",
            content: "",
            thinking: "",
          };

          response.setEncoding("utf8");

          response.on("data", (chunk) => {
            accumulator.body += chunk;

            if (statusCode < 200 || statusCode >= 300) {
              return;
            }

            accumulator.bufferedText += chunk;

            try {
              this.consumeResponseBuffer(accumulator);
            } catch (error) {
              clearTimeout(timeoutId);
              req.destroy();
              reject(error);
            }
          });

          response.on("end", () => {
            clearTimeout(timeoutId);

            if (statusCode >= 200 && statusCode < 300) {
              try {
                this.flushResponseBuffer(accumulator);
              } catch (error) {
                reject(error);
                return;
              }
            }

            resolve({
              statusCode,
              body: accumulator.body.trim(),
              content: accumulator.content,
              thinking: accumulator.thinking,
            });
          });

          response.on("error", (error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
        },
      );

      req.setTimeout(this.timeoutMs, () => {
        const timeoutError = new Error(
          `Ollama response socket was idle for ${this.timeoutMs}ms.`,
        );
        timeoutError.name = "AbortError";
        req.destroy(timeoutError);
      });

      timeoutId = setTimeout(() => {
        const timeoutError = new Error(
          `Ollama provider timed out after ${this.timeoutMs}ms.`,
        );
        timeoutError.name = "AbortError";
        req.destroy(timeoutError);
      }, this.timeoutMs);

      req.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      req.write(requestBody);
      req.end();
    });
  }

  private resolveStructuredOutputStrategy(): OllamaStructuredOutputStrategy {
    if (this.structuredOutputMode === "reasoning") {
      return "reasoning";
    }

    if (this.structuredOutputMode === "schema") {
      return "schema";
    }

    return REASONING_MODEL_PATTERNS.some((pattern) => pattern.test(this.model))
      ? "reasoning"
      : "schema";
  }

  private buildSystemPrompt(
    request: GenerateJsonProviderRequest,
    structuredOutputStrategy: OllamaStructuredOutputStrategy,
  ): string {
    if (structuredOutputStrategy === "schema") {
      return request.systemPrompt;
    }

    return [
      request.systemPrompt,
      ``,
      `Ollama reasoning-mode response contract:`,
      `You may reason before answering.`,
      `Do not put reasoning inside the final JSON payload.`,
      `After reasoning, output exactly one final result inside a \`\`\`json fenced code block.`,
      `Do not add prose after the final code block.`,
      `The JSON inside that code block must match this schema exactly:`,
      `\`\`\`json`,
      JSON.stringify(request.jsonSchema, null, 2),
      `\`\`\``,
    ].join("\n");
  }

  private consumeResponseBuffer(accumulator: OllamaChatAccumulator): void {
    let newlineIndex = accumulator.bufferedText.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = accumulator.bufferedText.slice(0, newlineIndex).trim();
      accumulator.bufferedText = accumulator.bufferedText.slice(
        newlineIndex + 1,
      );

      if (line) {
        this.consumeResponseLine(accumulator, line);
      }

      newlineIndex = accumulator.bufferedText.indexOf("\n");
    }
  }

  private flushResponseBuffer(accumulator: OllamaChatAccumulator): void {
    const line = accumulator.bufferedText.trim();

    if (!line) {
      return;
    }

    accumulator.bufferedText = "";
    this.consumeResponseLine(accumulator, line);
  }

  private consumeResponseLine(
    accumulator: OllamaChatAccumulator,
    line: string,
  ): void {
    const payload = parseJsonObject(line) as OllamaChatResponse;

    accumulator.content += payload.message?.content ?? "";
    accumulator.thinking += payload.message?.thinking ?? "";
  }
}

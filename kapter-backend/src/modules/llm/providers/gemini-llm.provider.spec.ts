import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { GeminiLlmProvider } from "./gemini-llm.provider";

const createProvider = (
  overrides: Partial<{
    apiKey: string;
    apiVersion: string;
    model: string;
    timeoutMs: number;
    maxRetries: number;
    enablePromptDump: boolean;
    thinkingBudget: number;
  }> = {},
) =>
  new GeminiLlmProvider({
    logDir: "logs",
    llm: {
      googleApiKey: overrides.apiKey ?? "test-google-key",
      geminiApiVersion: overrides.apiVersion ?? "v1",
      geminiModel: overrides.model ?? "gemini-2.5-flash-lite",
      geminiTimeoutMs: overrides.timeoutMs ?? 120_000,
      geminiMaxRetries: overrides.maxRetries ?? 1,
      geminiEnablePromptDump: overrides.enablePromptDump ?? false,
      geminiThinkingBudget: overrides.thinkingBudget ?? 0,
    },
  } as never);

afterEach(() => {
  mock.restoreAll();
});

void describe("GeminiLlmProvider", () => {
  void it("sends structured JSON requests with an explicit thinking budget for Gemini 2.5 models", async () => {
    const provider = createProvider({
      model: "gemini-2.5-flash-lite",
      thinkingBudget: 0,
    });
    const generateContentMock = mock.fn(async (payload: unknown) => {
      const request = payload as {
        model: string;
        contents: string;
        config: {
          systemInstruction: string;
          temperature: number;
          candidateCount: number;
          responseMimeType: string;
          responseJsonSchema: unknown;
          thinkingConfig?: {
            thinkingBudget: number;
          };
        };
      };

      assert.equal(request.model, "gemini-2.5-flash-lite");
      assert.equal(request.contents, "user");
      assert.equal(request.config.systemInstruction, "system");
      assert.equal(request.config.temperature, 0.1);
      assert.equal(request.config.candidateCount, 1);
      assert.equal(request.config.responseMimeType, "application/json");
      assert.deepEqual(request.config.responseJsonSchema, { type: "object" });
      assert.deepEqual(request.config.thinkingConfig, {
        thinkingBudget: 0,
      });

      return {
        text: JSON.stringify({
          summary: "Gemini summary.",
          tasks: [],
        }),
        responseId: "gem_resp_123",
        modelVersion: "gemini-2.5-flash-lite",
        sdkHttpResponse: {
          statusCode: 200,
        },
        usageMetadata: {
          promptTokenCount: 9,
          candidatesTokenCount: 5,
          thoughtsTokenCount: 0,
          totalTokenCount: 14,
        },
      };
    });

    (provider as unknown as { client: unknown }).client = {
      models: {
        generateContent: generateContentMock,
      },
    };

    const output = await provider.generateJson({
      schemaName: "meeting_artifacts",
      jsonSchema: { type: "object" },
      systemPrompt: "system",
      userPrompt: "user",
    });

    assert.deepEqual(output, {
      summary: "Gemini summary.",
      tasks: [],
    });
    assert.equal(generateContentMock.mock.callCount(), 1);
  });

  void it("omits thinking config for models outside the Gemini 2.5 family", async () => {
    const provider = createProvider({
      model: "gemini-1.5-flash",
      thinkingBudget: 1024,
    });
    const generateContentMock = mock.fn(async (payload: unknown) => {
      const request = payload as {
        config: {
          thinkingConfig?: unknown;
        };
      };

      assert.equal("thinkingConfig" in request.config, false);

      return {
        text: JSON.stringify({
          summary: "Gemini summary.",
          tasks: [],
        }),
      };
    });

    (provider as unknown as { client: unknown }).client = {
      models: {
        generateContent: generateContentMock,
      },
    };

    await provider.generateJson({
      schemaName: "meeting_artifacts",
      jsonSchema: { type: "object" },
      systemPrompt: "system",
      userPrompt: "user",
    });

    assert.equal(generateContentMock.mock.callCount(), 1);
  });
});

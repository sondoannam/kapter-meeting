import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { OpenAiLlmProvider } from "./openai-llm.provider";

const createProvider = (
  overrides: Partial<{
    apiKey: string;
    model: string;
    timeoutMs: number;
    maxRetries: number;
    enablePromptDump: boolean;
  }> = {},
) =>
  new OpenAiLlmProvider({
    logDir: "logs",
    llm: {
      openAiApiKey: overrides.apiKey ?? "test-openai-key",
      openAiModel: overrides.model ?? "gpt-4.1-mini",
      openAiTimeoutMs: overrides.timeoutMs ?? 120_000,
      openAiMaxRetries: overrides.maxRetries ?? 1,
      openAiEnablePromptDump: overrides.enablePromptDump ?? false,
    },
  } as never);

afterEach(() => {
  mock.restoreAll();
});

void describe("OpenAiLlmProvider", () => {
  void it("sends a strict JSON schema request through the Responses API", async () => {
    const provider = createProvider();
    const createMock = mock.fn(async (payload: unknown) => {
      const request = payload as {
        model: string;
        instructions: string;
        input: string;
        store: boolean;
        temperature: number;
        text: {
          format: {
            type: string;
            name: string;
            strict: boolean;
            schema: unknown;
          };
        };
      };

      assert.equal(request.model, "gpt-4.1-mini");
      assert.equal(request.instructions, "system");
      assert.equal(request.input, "user");
      assert.equal(request.store, false);
      assert.equal(request.temperature, 0.1);
      assert.deepEqual(request.text.format, {
        type: "json_schema",
        name: "meeting_artifacts",
        strict: true,
        schema: { type: "object" },
      });

      return {
        output_text: JSON.stringify({
          summary: "Cloud summary.",
          tasks: [],
        }),
        _request_id: "req_openai_123",
        usage: {
          input_tokens: 10,
          input_tokens_details: {
            cached_tokens: 2,
          },
          output_tokens: 4,
          output_tokens_details: {
            reasoning_tokens: 0,
          },
          total_tokens: 14,
        },
      };
    });

    (provider as unknown as { client: unknown }).client = {
      responses: {
        create: createMock,
      },
    };

    const output = await provider.generateJson({
      schemaName: "meeting_artifacts",
      jsonSchema: { type: "object" },
      systemPrompt: "system",
      userPrompt: "user",
    });

    assert.deepEqual(output, {
      summary: "Cloud summary.",
      tasks: [],
    });
    assert.equal(createMock.mock.callCount(), 1);
  });

  void it("reports the configured timeout on connection timeout errors", async () => {
    const provider = createProvider({
      timeoutMs: 250,
    });

    (provider as unknown as { client: unknown }).client = {
      responses: {
        create: mock.fn(async () => {
          const error = new Error("request timed out");
          error.name = "APIConnectionTimeoutError";
          throw error;
        }),
      },
    };

    await assert.rejects(
      () =>
        provider.generateJson({
          schemaName: "meeting_artifacts",
          jsonSchema: { type: "object" },
          systemPrompt: "system",
          userPrompt: "user",
        }),
      /Configured timeout: 250ms/i,
    );
  });
});

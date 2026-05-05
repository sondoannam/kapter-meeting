import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { LlmService } from "./llm.service";
import type { LlmProvider } from "./providers/llm-provider.interface";
import { validateMeetingArtifacts } from "./schemas/meeting-artifacts.schema";

const createConfig = (overrides = {}) => ({
  llm: {
    defaultProvider: "openai",
    openAiApiKey: "openai-key",
    openAiModel: "gpt-4.1-mini",
    openAiTimeoutMs: 120000,
    openAiMaxRetries: 1,
    openAiEnablePromptDump: false,
    googleApiKey: "google-key",
    geminiApiVersion: "v1",
    geminiModel: "gemini-2.5-flash-lite",
    geminiTimeoutMs: 120000,
    geminiMaxRetries: 1,
    geminiEnablePromptDump: false,
    geminiThinkingBudget: 0,
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "qwen3.5:9b",
    ollamaStructuredOutputMode: "auto",
    ollamaTimeoutMs: 60000,
    ollamaEnablePromptDump: false,
    ...overrides,
  },
});

const extractionInput = {
  meetingTitle: "Sprint planning",
  meetingCreatedAt: "2026-04-24T09:00:00.000Z",
  projectTitle: "Kapter",
  projectDescription: "AI meeting assistant",
  projectContextMarkdown: "# Context",
  tacticalTasks: [],
  speakers: [
    {
      aiLabel: "Speaker 0",
      realName: "Nam",
    },
  ],
  transcriptSegments: [
    {
      aiLabel: "Speaker 0",
      realName: "Nam",
      startTime: 0,
      endTime: 4,
      content: "Nam will ship the review page by 2026-04-25.",
    },
  ],
};

const createProvider = (
  name: LlmProvider["name"],
  generateJson: LlmProvider["generateJson"],
): {
  provider: LlmProvider;
  generateJsonMock: ReturnType<typeof mock.fn>;
} => {
  const generateJsonMock = mock.fn(generateJson);

  return {
    provider: {
      name,
      isConfigured: mock.fn(() => true),
      generateJson: generateJsonMock,
    },
    generateJsonMock,
  };
};

const createService = (
  openAiProvider: LlmProvider,
  geminiProvider: LlmProvider,
  ollamaProvider: LlmProvider = createProvider("ollama", async () => ({
    summary: "Ollama summary.",
    tasks: [],
  })).provider,
  configOverrides = {},
) =>
  new LlmService(
    createConfig(configOverrides) as never,
    openAiProvider as never,
    geminiProvider as never,
    ollamaProvider as never,
  );

afterEach(() => {
  mock.restoreAll();
});

void describe("LlmService", () => {
  void it("uses OpenAI first and validates structured artifacts", async () => {
    const { provider: openAiProvider, generateJsonMock: openAiExtract } =
      createProvider("openai", async () => ({
        summary: "Team planned the review page.",
        tasks: [
          {
            taskContent: "Ship the review page.",
            assigneeAiLabel: "Speaker 0",
            deadline: "2026-04-25",
          },
        ],
      }));
    const { provider: geminiProvider, generateJsonMock: geminiExtract } =
      createProvider("gemini", async () => ({
        summary: "Should not be used.",
        tasks: [],
      }));

    const service = createService(openAiProvider, geminiProvider);
    const artifacts = await service.extractMeetingArtifacts(extractionInput);

    assert.equal(openAiExtract.mock.callCount(), 1);
    assert.equal(geminiExtract.mock.callCount(), 0);
    assert.equal(artifacts.summary, "Team planned the review page.");
    assert.equal(artifacts.tasks[0]?.assigneeAiLabel, "Speaker 0");
    assert.equal(artifacts.tasks[0]?.deadline, "2026-04-25T00:00:00.000Z");
  });

  void it("falls back to Gemini when OpenAI extraction fails", async () => {
    const { provider: openAiProvider, generateJsonMock: openAiExtract } =
      createProvider("openai", async () => {
        throw new Error("OpenAI failed");
      });
    const { provider: geminiProvider, generateJsonMock: geminiExtract } =
      createProvider("gemini", async () => ({
        summary: "Gemini fallback summary.",
        tasks: [],
      }));

    const service = createService(openAiProvider, geminiProvider);
    const artifacts = await service.extractMeetingArtifacts(extractionInput);

    assert.equal(openAiExtract.mock.callCount(), 1);
    assert.equal(geminiExtract.mock.callCount(), 1);
    assert.equal(artifacts.summary, "Gemini fallback summary.");
    assert.deepEqual(artifacts.tasks, []);
  });

  void it("uses only Ollama when Ollama is the default provider", async () => {
    const { provider: openAiProvider, generateJsonMock: openAiExtract } =
      createProvider("openai", async () => ({
        summary: "Should not be used.",
        tasks: [],
      }));
    const { provider: geminiProvider, generateJsonMock: geminiExtract } =
      createProvider("gemini", async () => ({
        summary: "Should not be used.",
        tasks: [],
      }));
    const { provider: ollamaProvider, generateJsonMock: ollamaExtract } =
      createProvider("ollama", async () => ({
        summary: "Local Ollama summary.",
        tasks: [],
      }));

    const service = createService(
      openAiProvider,
      geminiProvider,
      ollamaProvider,
      {
        defaultProvider: "ollama",
      },
    );
    const artifacts = await service.extractMeetingArtifacts(extractionInput);

    assert.equal(ollamaExtract.mock.callCount(), 1);
    assert.equal(openAiExtract.mock.callCount(), 0);
    assert.equal(geminiExtract.mock.callCount(), 0);
    assert.equal(artifacts.summary, "Local Ollama summary.");
  });
});

void describe("validateMeetingArtifacts", () => {
  void it("accepts valid output with empty tasks", () => {
    const artifacts = validateMeetingArtifacts(
      {
        summary: "No follow-up was assigned.",
        tasks: [],
      },
      ["Speaker 0"],
    );

    assert.deepEqual(artifacts, {
      summary: "No follow-up was assigned.",
      tasks: [],
    });
  });

  void it("rejects an assignee label outside the speaker roster", () => {
    assert.throws(
      () =>
        validateMeetingArtifacts(
          {
            summary: "Invalid assignee.",
            tasks: [
              {
                taskContent: "Ship it.",
                assigneeAiLabel: "Speaker 9",
                deadline: null,
              },
            ],
          },
          ["Speaker 0"],
        ),
      /speaker roster/i,
    );
  });

  void it("rejects invalid deadlines", () => {
    assert.throws(
      () =>
        validateMeetingArtifacts(
          {
            summary: "Invalid date.",
            tasks: [
              {
                taskContent: "Ship it.",
                assigneeAiLabel: null,
                deadline: "soon-ish",
              },
            ],
          },
          ["Speaker 0"],
        ),
      /deadline/i,
    );
  });
});

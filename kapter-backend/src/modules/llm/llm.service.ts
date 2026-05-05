import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { appConfig } from "../../config/app.config";
import {
  buildMeetingArtifactsUserPrompt,
  MEETING_ARTIFACTS_SYSTEM_PROMPT,
} from "./prompts/meeting-artifacts.prompt";
import type { MeetingArtifactPromptInput } from "./prompts/meeting-artifacts.prompt";
import {
  buildMeetingExtractionChunkUserPrompt,
  MEETING_EXTRACTION_CHUNK_SYSTEM_PROMPT,
} from "./prompts/meeting-extraction-chunk.prompt";
import type { MeetingExtractionChunkPromptInput } from "./prompts/meeting-extraction-chunk.prompt";
import {
  buildMeetingSummaryReductionUserPrompt,
  MEETING_SUMMARY_REDUCTION_SYSTEM_PROMPT,
} from "./prompts/meeting-summary-reduction.prompt";
import type { MeetingSummaryReductionPromptInput } from "./prompts/meeting-summary-reduction.prompt";
import {
  buildProjectContextUpdateUserPrompt,
  PROJECT_CONTEXT_UPDATE_SYSTEM_PROMPT,
} from "./prompts/project-context-update.prompt";
import type { ProjectContextUpdatePromptInput } from "./prompts/project-context-update.prompt";
import { GeminiLlmProvider } from "./providers/gemini-llm.provider";
import type {
  LlmProvider,
  LlmProviderHealthCheckStatus,
  LlmProviderHealthStatus,
} from "./providers/llm-provider.interface";
import { OllamaLlmProvider } from "./providers/ollama-llm.provider";
import { OpenAiLlmProvider } from "./providers/openai-llm.provider";
import {
  MEETING_EXTRACTION_CHUNK_JSON_SCHEMA,
  type MeetingExtractionChunkArtifacts,
  validateMeetingExtractionChunkArtifacts,
} from "./schemas/meeting-extraction-chunk.schema";
import {
  MEETING_ARTIFACTS_OPENAI_JSON_SCHEMA,
  type MeetingArtifacts,
  validateMeetingArtifacts,
} from "./schemas/meeting-artifacts.schema";
import {
  MEETING_SUMMARY_REDUCTION_JSON_SCHEMA,
  validateMeetingSummaryReduction,
} from "./schemas/meeting-summary-reduction.schema";
import {
  PROJECT_CONTEXT_UPDATE_JSON_SCHEMA,
  type ProjectContextUpdate,
  validateProjectContextUpdate,
} from "./schemas/project-context-update.schema";

export type ExtractMeetingArtifactsInput = MeetingArtifactPromptInput;
export type ExtractMeetingChunkArtifactsInput = MeetingExtractionChunkPromptInput;
export type ReduceMeetingSummaryInput = MeetingSummaryReductionPromptInput;
export type ProposeProjectContextUpdateInput = ProjectContextUpdatePromptInput;
export type LlmHealthStatus = {
  status: "ok" | "degraded";
  defaultProvider: "openai" | "gemini" | "ollama";
  providers: Record<
    "openai" | "gemini" | "ollama",
    LlmProviderHealthStatus
  >;
};

@Injectable()
export class LlmService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly openAiProvider: OpenAiLlmProvider,
    private readonly geminiProvider: GeminiLlmProvider,
    private readonly ollamaProvider: OllamaLlmProvider,
  ) {}

  getIntegrationStatus() {
    return {
      defaultProvider: this.config.llm.defaultProvider ?? null,
      openAiConfigured: Boolean(this.config.llm.openAiApiKey),
      openAiModel: this.config.llm.openAiModel,
      openAiTimeoutMs: this.config.llm.openAiTimeoutMs,
      openAiMaxRetries: this.config.llm.openAiMaxRetries,
      googleAiConfigured: Boolean(this.config.llm.googleApiKey),
      geminiApiVersion: this.config.llm.geminiApiVersion,
      geminiModel: this.config.llm.geminiModel,
      geminiTimeoutMs: this.config.llm.geminiTimeoutMs,
      geminiMaxRetries: this.config.llm.geminiMaxRetries,
      geminiThinkingBudget: this.config.llm.geminiThinkingBudget,
      ollamaConfigured: this.ollamaProvider.isConfigured(),
      ollamaBaseUrl: this.config.llm.ollamaBaseUrl,
      ollamaModel: this.config.llm.ollamaModel,
    };
  }

  async getHealthStatus(): Promise<LlmHealthStatus> {
    const [openai, gemini, ollama] = await Promise.all([
      this.openAiProvider.checkHealth(),
      this.geminiProvider.checkHealth(),
      this.ollamaProvider.checkHealth(),
    ]);
    const providers = {
      openai,
      gemini,
      ollama,
    };

    return {
      status: this.resolveHealthStatus(providers),
      defaultProvider: this.config.llm.defaultProvider,
      providers,
    };
  }

  async extractMeetingArtifacts(
    input: ExtractMeetingArtifactsInput,
  ): Promise<MeetingArtifacts> {
    const providers = this.buildProviderOrder();
    const configuredProviders = providers.filter((provider) =>
      provider.isConfigured(),
    );

    if (configuredProviders.length === 0) {
      throw new Error("No LLM provider is configured.");
    }

    const request = {
      schemaName: "meeting_artifacts",
      jsonSchema: MEETING_ARTIFACTS_OPENAI_JSON_SCHEMA,
      systemPrompt: MEETING_ARTIFACTS_SYSTEM_PROMPT,
      userPrompt: buildMeetingArtifactsUserPrompt(input),
    };
    const allowedAiLabels = input.speakers.map((speaker) => speaker.aiLabel);
    const failures: string[] = [];

    for (const provider of configuredProviders) {
      try {
        const rawArtifacts = await provider.generateJson(request);

        return validateMeetingArtifacts(rawArtifacts, allowedAiLabels);
      } catch (error) {
        failures.push(
          `${provider.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw new Error(
      `All configured LLM providers failed. ${failures.join(" | ")}`,
    );
  }

  async extractMeetingChunkArtifacts(
    input: ExtractMeetingChunkArtifactsInput,
  ): Promise<MeetingExtractionChunkArtifacts> {
    const providers = this.buildProviderOrder();
    const configuredProviders = providers.filter((provider) =>
      provider.isConfigured(),
    );

    if (configuredProviders.length === 0) {
      throw new Error("No LLM provider is configured.");
    }

    const request = {
      schemaName: "meeting_extraction_chunk",
      jsonSchema: MEETING_EXTRACTION_CHUNK_JSON_SCHEMA,
      systemPrompt: MEETING_EXTRACTION_CHUNK_SYSTEM_PROMPT,
      userPrompt: buildMeetingExtractionChunkUserPrompt(input),
    };
    const allowedAiLabels = input.speakers.map((speaker) => speaker.aiLabel);
    const allowedTaskKeys = input.currentRollingTasks.map((task) => task.taskKey);
    const failures: string[] = [];

    for (const provider of configuredProviders) {
      try {
        const rawArtifacts = await provider.generateJson(request);

        return validateMeetingExtractionChunkArtifacts(
          rawArtifacts,
          allowedAiLabels,
          allowedTaskKeys,
        );
      } catch (error) {
        failures.push(
          `${provider.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw new Error(
      `All configured LLM providers failed. ${failures.join(" | ")}`,
    );
  }

  async reduceMeetingSummary(
    input: ReduceMeetingSummaryInput,
  ): Promise<string> {
    const providers = this.buildProviderOrder();
    const configuredProviders = providers.filter((provider) =>
      provider.isConfigured(),
    );

    if (configuredProviders.length === 0) {
      throw new Error("No LLM provider is configured.");
    }

    const request = {
      schemaName: "meeting_summary_reduction",
      jsonSchema: MEETING_SUMMARY_REDUCTION_JSON_SCHEMA,
      systemPrompt: MEETING_SUMMARY_REDUCTION_SYSTEM_PROMPT,
      userPrompt: buildMeetingSummaryReductionUserPrompt(input),
    };
    const failures: string[] = [];

    for (const provider of configuredProviders) {
      try {
        const rawSummary = await provider.generateJson(request);
        const reducedSummary = validateMeetingSummaryReduction(rawSummary);

        return reducedSummary.summary;
      } catch (error) {
        failures.push(
          `${provider.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw new Error(
      `All configured LLM providers failed. ${failures.join(" | ")}`,
    );
  }

  async proposeProjectContextUpdate(
    input: ProposeProjectContextUpdateInput,
  ): Promise<ProjectContextUpdate> {
    const providers = this.buildProviderOrder();
    const configuredProviders = providers.filter((provider) =>
      provider.isConfigured(),
    );

    if (configuredProviders.length === 0) {
      throw new Error("No LLM provider is configured.");
    }

    const request = {
      schemaName: "project_context_update",
      jsonSchema: PROJECT_CONTEXT_UPDATE_JSON_SCHEMA,
      systemPrompt: PROJECT_CONTEXT_UPDATE_SYSTEM_PROMPT,
      userPrompt: buildProjectContextUpdateUserPrompt(input),
    };
    const failures: string[] = [];

    for (const provider of configuredProviders) {
      try {
        const rawProposal = await provider.generateJson(request);

        return validateProjectContextUpdate(rawProposal);
      } catch (error) {
        failures.push(
          `${provider.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw new Error(
      `All configured LLM providers failed. ${failures.join(" | ")}`,
    );
  }

  private buildProviderOrder(): LlmProvider[] {
    if (this.config.llm.defaultProvider === "ollama") {
      return [this.ollamaProvider];
    }

    if (this.config.llm.defaultProvider === "gemini") {
      return [this.geminiProvider, this.openAiProvider];
    }

    return [this.openAiProvider, this.geminiProvider];
  }

  private resolveHealthStatus(providers: {
    openai: LlmProviderHealthStatus;
    gemini: LlmProviderHealthStatus;
    ollama: LlmProviderHealthStatus;
  }): "ok" | "degraded" {
    const configuredProviders = Object.values(providers).filter(
      (provider) => provider.status !== "not_configured",
    );

    if (configuredProviders.length === 0) {
      return "degraded";
    }

    if (configuredProviders.some((provider) => provider.status === "error")) {
      return "degraded";
    }

    const defaultProviderStatus =
      providers[this.config.llm.defaultProvider].status;

    return this.isHealthyStatus(defaultProviderStatus) ? "ok" : "degraded";
  }

  private isHealthyStatus(
    status: LlmProviderHealthCheckStatus,
  ): status is "ok" {
    return status === "ok";
  }
}

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as dotenv from "dotenv";
import type { ConfigType } from "@nestjs/config";
import { registerAs } from "@nestjs/config";

import {
  DEFAULT_AUDIO_BUFFER_FLUSH_MS,
  DEFAULT_AUDIO_BUFFER_IDLE_TIMEOUT_MS,
  DEFAULT_AUDIO_BUFFER_MAX_CHUNKS,
} from "../modules/audio-stream/audio-stream.constants";

export interface LlmProviderConfig {
  defaultProvider: "openai" | "gemini" | "ollama";
  googleApiKey?: string;
  geminiApiVersion: string;
  geminiModel: string;
  geminiTimeoutMs: number;
  geminiMaxRetries: number;
  geminiEnablePromptDump: boolean;
  geminiThinkingBudget: number;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaStructuredOutputMode: "auto" | "reasoning" | "schema";
  ollamaTimeoutMs: number;
  ollamaEnablePromptDump: boolean;
  openAiApiKey?: string;
  openAiModel: string;
  openAiTimeoutMs: number;
  openAiMaxRetries: number;
  openAiEnablePromptDump: boolean;
}

export interface ClerkConfig {
  secretKey: string;
  webhookSigningSecret: string;
  jwtKey?: string;
  authorizedParties: string[];
}

export interface AiWorkerConfig {
  baseUrl: string;
  timeoutMs: number;
  sharedSecret?: string;
}

export interface AudioBufferConfig {
  flushMs: number;
  maxChunks: number;
  idleTimeoutMs: number;
}

export interface NotionConfig {
  apiBaseUrl: string;
  authBaseUrl: string;
  version: string;
  clientId?: string;
  clientSecret?: string;
  oauthRedirectUri?: string;
  webappBaseUrl: string;
}

export interface MeetingExtractionConfig {
  enableTraceDump: boolean;
  traceDir: string;
}

export type NodeEnvironment = "development" | "test" | "production";

export interface ApplicationConfig {
  port: number;
  nodeEnv: NodeEnvironment;
  corsOrigin: "*" | string[];
  notion: NotionConfig;
  logDir: string;
  logLevel: string;
  wsAudioNamespace: string;
  clerk: ClerkConfig;
  llm: LlmProviderConfig;
  meetingExtraction: MeetingExtractionConfig;
  databaseUrl: string;
  aiWorker: AiWorkerConfig;
  audioBuffer: AudioBufferConfig;
}

const DEFAULT_AI_WORKER_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_AI_WORKER_TIMEOUT_MS = 30_000;
const DEFAULT_LLM_PROVIDER = "ollama";
const DEFAULT_OPENAI_LLM_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENAI_TIMEOUT_MS = 120_000;
const DEFAULT_OPENAI_MAX_RETRIES = 1;
const DEFAULT_GEMINI_API_VERSION = "v1";
const DEFAULT_GEMINI_LLM_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_GEMINI_TIMEOUT_MS = 120_000;
const DEFAULT_GEMINI_MAX_RETRIES = 1;
const DEFAULT_GEMINI_THINKING_BUDGET = 0;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_LLM_MODEL = "qwen3.5:9b";
const DEFAULT_OLLAMA_STRUCTURED_OUTPUT_MODE = "auto";
const DEFAULT_OLLAMA_TIMEOUT_MS = 300_000;
const DEFAULT_NOTION_API_BASE_URL = "https://api.notion.com";
const DEFAULT_NOTION_AUTH_BASE_URL =
  "https://api.notion.com/v1/oauth/authorize";
const DEFAULT_NOTION_VERSION = "2026-03-11";
const DEFAULT_WEBAPP_BASE_URL = "http://localhost:5173";

const resolveBackendRootDir = (): string => {
  const searchRoots = [process.cwd(), __dirname];

  for (const searchRoot of searchRoots) {
    let currentDir = path.resolve(searchRoot);

    for (let depth = 0; depth < 6; depth += 1) {
      const packageJsonPath = path.join(currentDir, "package.json");

      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            readFileSync(packageJsonPath, "utf8"),
          ) as { name?: string };

          if (packageJson.name === "kapter-backend") {
            return currentDir;
          }
        } catch {
          // Ignore unreadable package.json candidates and keep walking upward.
        }
      }

      const parentDir = path.dirname(currentDir);

      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
    }
  }

  return process.cwd();
};

export const BACKEND_ROOT_DIR = resolveBackendRootDir();

const LOG_LEVELS = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
] as const;

type ApplicationLogLevel = (typeof LOG_LEVELS)[number];

export const stripWrappingQuotes = (value: string): string => {
  const trimmedValue = value.trim();

  if (trimmedValue.length < 2) {
    return trimmedValue;
  }

  const startsWithDoubleQuote = trimmedValue.startsWith('"');
  const endsWithDoubleQuote = trimmedValue.endsWith('"');
  const startsWithSingleQuote = trimmedValue.startsWith("'");
  const endsWithSingleQuote = trimmedValue.endsWith("'");

  if (
    (startsWithDoubleQuote && endsWithDoubleQuote) ||
    (startsWithSingleQuote && endsWithSingleQuote)
  ) {
    return trimmedValue.slice(1, -1).trim();
  }

  return trimmedValue;
};

export const normalizeConfiguredUrl = (value: string): string => {
  const normalizedValue = stripWrappingQuotes(value);

  return normalizedValue.endsWith("/")
    ? normalizedValue.slice(0, -1)
    : normalizedValue;
};

export const parseStringList = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return stripWrappingQuotes(value)
    .split(",")
    .map((entry) => normalizeConfiguredUrl(entry))
    .filter(Boolean);
};

export const parseCorsOriginValue = (
  configuredOrigin?: string,
): "*" | string[] => {
  const normalizedOrigin = configuredOrigin
    ? stripWrappingQuotes(configuredOrigin)
    : undefined;

  if (!normalizedOrigin || normalizedOrigin === "*") {
    return "*";
  }

  return parseStringList(normalizedOrigin);
};

const parseCorsOrigin = (): "*" | string[] =>
  parseCorsOriginValue(process.env.CORS_ORIGIN);

const parseWebappBaseUrl = (corsOrigin: "*" | string[]): string => {
  const configuredBaseUrl = process.env.WEBAPP_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return normalizeConfiguredUrl(configuredBaseUrl);
  }

  if (Array.isArray(corsOrigin) && corsOrigin.length > 0) {
    const firstOrigin = corsOrigin[0];

    if (firstOrigin) {
      return normalizeConfiguredUrl(firstOrigin);
    }
  }

  return DEFAULT_WEBAPP_BASE_URL;
};

const parseLogLevel = (value?: string): ApplicationLogLevel => {
  const normalizedValue = value?.trim().toLowerCase();

  if (
    normalizedValue &&
    LOG_LEVELS.includes(normalizedValue as ApplicationLogLevel)
  ) {
    return normalizedValue as ApplicationLogLevel;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
};

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsedValue = Number.parseInt(value ?? "", 10);

  if (Number.isInteger(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return fallback;
};

const parseNonNegativeInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsedValue = Number.parseInt(value ?? "", 10);

  if (Number.isInteger(parsedValue) && parsedValue >= 0) {
    return parsedValue;
  }

  return fallback;
};

const parseGeminiThinkingBudget = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsedValue = Number.parseInt(value ?? "", 10);

  if (Number.isInteger(parsedValue) && parsedValue >= -1) {
    return parsedValue;
  }

  return fallback;
};

const parseLlmProvider = (value?: string): "openai" | "gemini" | "ollama" => {
  const normalizedValue = value?.trim().toLowerCase();

  if (
    normalizedValue === "openai" ||
    normalizedValue === "gemini" ||
    normalizedValue === "ollama"
  ) {
    return normalizedValue;
  }

  return DEFAULT_LLM_PROVIDER;
};

const parseOllamaStructuredOutputMode = (
  value?: string,
): "auto" | "reasoning" | "schema" => {
  const normalizedValue = value?.trim().toLowerCase();

  if (
    normalizedValue === "auto" ||
    normalizedValue === "reasoning" ||
    normalizedValue === "schema"
  ) {
    return normalizedValue;
  }

  return DEFAULT_OLLAMA_STRUCTURED_OUTPUT_MODE;
};

const loadEnvFiles = (): void => {
  const envFiles = [
    { fileName: ".env", override: true },
    { fileName: ".env.local", override: true },
  ];

  for (const { fileName, override } of envFiles) {
    const envPath = path.join(BACKEND_ROOT_DIR, fileName);

    if (!existsSync(envPath)) {
      continue;
    }

    dotenv.config({ path: envPath, override });
  }
};

export const buildAppConfig = (): ApplicationConfig => {
  loadEnvFiles();

  const corsOrigin = parseCorsOrigin();
  const authorizedParties = parseStringList(
    process.env.CLERK_AUTHORIZED_PARTIES,
  );
  const webappBaseUrl = parseWebappBaseUrl(corsOrigin);

  return {
    port: Number(process.env.PORT ?? 3001),
    nodeEnv: (process.env.NODE_ENV as NodeEnvironment) ?? "development",
    corsOrigin,
    notion: {
      apiBaseUrl:
        process.env.NOTION_API_BASE_URL?.trim() || DEFAULT_NOTION_API_BASE_URL,
      authBaseUrl:
        process.env.NOTION_AUTH_BASE_URL?.trim() ||
        DEFAULT_NOTION_AUTH_BASE_URL,
      version: DEFAULT_NOTION_VERSION,
      clientId: process.env.NOTION_CLIENT_ID?.trim() || undefined,
      clientSecret: process.env.NOTION_CLIENT_SECRET?.trim() || undefined,
      oauthRedirectUri:
        process.env.NOTION_OAUTH_REDIRECT_URI?.trim() || undefined,
      webappBaseUrl,
    },
    logDir: process.env.LOG_DIR ?? "logs",
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    wsAudioNamespace: process.env.WS_AUDIO_NAMESPACE ?? "/audio-stream",
    clerk: {
      secretKey: process.env.CLERK_SECRET_KEY ?? "",
      webhookSigningSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET ?? "",
      jwtKey: process.env.CLERK_JWT_KEY?.trim() || undefined,
      authorizedParties:
        authorizedParties.length > 0
          ? authorizedParties
          : Array.isArray(corsOrigin)
            ? corsOrigin
            : [],
    },
    llm: {
      defaultProvider: parseLlmProvider(process.env.DEFAULT_LLM_PROVIDER),
      openAiApiKey: process.env.OPENAI_API_KEY ?? "",
      openAiModel:
        process.env.OPENAI_LLM_MODEL?.trim() || DEFAULT_OPENAI_LLM_MODEL,
      openAiTimeoutMs: parsePositiveInteger(
        process.env.OPENAI_TIMEOUT_MS,
        DEFAULT_OPENAI_TIMEOUT_MS,
      ),
      openAiMaxRetries: parseNonNegativeInteger(
        process.env.OPENAI_MAX_RETRIES,
        DEFAULT_OPENAI_MAX_RETRIES,
      ),
      openAiEnablePromptDump: process.env.OPENAI_ENABLE_PROMPT_DUMP === "true",
      googleApiKey: process.env.GOOGLE_API_KEY ?? "",
      geminiApiVersion:
        process.env.GEMINI_API_VERSION?.trim() || DEFAULT_GEMINI_API_VERSION,
      geminiModel:
        process.env.GEMINI_LLM_MODEL?.trim() || DEFAULT_GEMINI_LLM_MODEL,
      geminiTimeoutMs: parsePositiveInteger(
        process.env.GEMINI_TIMEOUT_MS,
        DEFAULT_GEMINI_TIMEOUT_MS,
      ),
      geminiMaxRetries: parseNonNegativeInteger(
        process.env.GEMINI_MAX_RETRIES,
        DEFAULT_GEMINI_MAX_RETRIES,
      ),
      geminiEnablePromptDump: process.env.GEMINI_ENABLE_PROMPT_DUMP === "true",
      geminiThinkingBudget: parseGeminiThinkingBudget(
        process.env.GEMINI_THINKING_BUDGET,
        DEFAULT_GEMINI_THINKING_BUDGET,
      ),
      ollamaBaseUrl: normalizeConfiguredUrl(
        process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL,
      ),
      ollamaModel:
        process.env.OLLAMA_LLM_MODEL?.trim() || DEFAULT_OLLAMA_LLM_MODEL,
      ollamaStructuredOutputMode: parseOllamaStructuredOutputMode(
        process.env.OLLAMA_STRUCTURED_OUTPUT_MODE,
      ),
      ollamaTimeoutMs: parsePositiveInteger(
        process.env.OLLAMA_TIMEOUT_MS,
        DEFAULT_OLLAMA_TIMEOUT_MS,
      ),
      ollamaEnablePromptDump: process.env.OLLAMA_ENABLE_PROMPT_DUMP === "true",
    },
    meetingExtraction: {
      enableTraceDump:
        process.env.MEETING_EXTRACTION_ENABLE_TRACE_DUMP === "true",
      traceDir:
        process.env.MEETING_EXTRACTION_TRACE_DIR?.trim() ||
        path.join(process.env.LOG_DIR ?? "logs", "meeting-extraction"),
    },
    databaseUrl: process.env.DATABASE_URL ?? "",
    aiWorker: {
      baseUrl:
        process.env.AI_WORKER_BASE_URL?.trim() || DEFAULT_AI_WORKER_BASE_URL,
      timeoutMs: parsePositiveInteger(
        process.env.AI_WORKER_TIMEOUT_MS,
        DEFAULT_AI_WORKER_TIMEOUT_MS,
      ),
      sharedSecret: process.env.AI_WORKER_SHARED_SECRET?.trim() || undefined,
    },
    audioBuffer: {
      flushMs: parsePositiveInteger(
        process.env.AUDIO_BUFFER_FLUSH_MS,
        DEFAULT_AUDIO_BUFFER_FLUSH_MS,
      ),
      maxChunks: parsePositiveInteger(
        process.env.AUDIO_BUFFER_MAX_CHUNKS,
        DEFAULT_AUDIO_BUFFER_MAX_CHUNKS,
      ),
      idleTimeoutMs: parsePositiveInteger(
        process.env.AUDIO_BUFFER_IDLE_TIMEOUT_MS,
        DEFAULT_AUDIO_BUFFER_IDLE_TIMEOUT_MS,
      ),
    },
  };
};

export const appConfig = registerAs("app", buildAppConfig);

export type AppConfig = ConfigType<typeof appConfig>;

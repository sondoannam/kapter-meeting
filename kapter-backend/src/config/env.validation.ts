import * as Joi from "joi";

import {
  DEFAULT_AUDIO_BUFFER_FLUSH_MS,
  DEFAULT_AUDIO_BUFFER_IDLE_TIMEOUT_MS,
  DEFAULT_AUDIO_BUFFER_MAX_CHUNKS,
} from "../modules/audio-stream/audio-stream.constants";

export const envValidationSchema = Joi.object({
  PORT: Joi.number().port().default(3001),
  NODE_ENV: Joi.string().valid("development", "production", "test").required(),
  CORS_ORIGIN: Joi.string().trim().min(1).required(),
  CLERK_SECRET_KEY: Joi.string().trim().min(1).required(),
  CLERK_WEBHOOK_SIGNING_SECRET: Joi.string().trim().min(1).required(),
  CLERK_JWT_KEY: Joi.string().allow("").optional(),
  CLERK_AUTHORIZED_PARTIES: Joi.string().allow("").optional(),
  NOTION_API_KEY: Joi.string().allow("").optional(),
  NOTION_CLIENT_ID: Joi.string().allow("").optional(),
  NOTION_CLIENT_SECRET: Joi.string().allow("").optional(),
  NOTION_OAUTH_REDIRECT_URI: Joi.string().uri().allow("").optional(),
  NOTION_AUTH_BASE_URL: Joi.string().uri().allow("").optional(),
  NOTION_API_BASE_URL: Joi.string().uri().allow("").optional(),
  WEBAPP_BASE_URL: Joi.string().uri().allow("").optional(),
  LOG_DIR: Joi.string().trim().default("logs"),
  LOG_LEVEL: Joi.string()
    .trim()
    .lowercase()
    .valid("error", "warn", "info", "http", "verbose", "debug", "silly")
    .default("debug"),
  WS_AUDIO_NAMESPACE: Joi.string().trim().default("/audio-stream"),
  DEFAULT_LLM_PROVIDER: Joi.string()
    .trim()
    .lowercase()
    .valid("openai", "gemini", "ollama")
    .default("ollama"),
  OPENAI_API_KEY: Joi.string().allow("").optional(),
  OPENAI_LLM_MODEL: Joi.string().trim().default("gpt-4.1-mini"),
  OPENAI_TIMEOUT_MS: Joi.number().integer().positive().default(120000),
  OPENAI_MAX_RETRIES: Joi.number().integer().min(0).default(1),
  OPENAI_ENABLE_PROMPT_DUMP: Joi.boolean().default(false),
  GOOGLE_API_KEY: Joi.string().allow("").optional(),
  GEMINI_API_VERSION: Joi.string().trim().default("v1"),
  GEMINI_LLM_MODEL: Joi.string().trim().default("gemini-2.5-flash-lite"),
  GEMINI_TIMEOUT_MS: Joi.number().integer().positive().default(120000),
  GEMINI_MAX_RETRIES: Joi.number().integer().min(0).default(1),
  GEMINI_ENABLE_PROMPT_DUMP: Joi.boolean().default(false),
  GEMINI_THINKING_BUDGET: Joi.number().integer().min(-1).default(0),
  OLLAMA_BASE_URL: Joi.string().uri().default("http://127.0.0.1:11434"),
  OLLAMA_LLM_MODEL: Joi.string().trim().default("qwen3.5:9b"),
  OLLAMA_STRUCTURED_OUTPUT_MODE: Joi.string()
    .trim()
    .lowercase()
    .valid("auto", "reasoning", "schema")
    .default("auto"),
  OLLAMA_TIMEOUT_MS: Joi.number().integer().positive().default(300000),
  OLLAMA_ENABLE_PROMPT_DUMP: Joi.boolean().default(false),
  MEETING_EXTRACTION_ENABLE_TRACE_DUMP: Joi.boolean().default(false),
  MEETING_EXTRACTION_TRACE_DIR: Joi.string().trim().allow("").optional(),
  DATABASE_URL: Joi.string().uri().required(),
  DIRECT_URL: Joi.string().uri().allow("").optional(),
  AI_WORKER_BASE_URL: Joi.string().uri().default("http://127.0.0.1:8000"),
  AI_WORKER_TIMEOUT_MS: Joi.number().integer().positive().default(30000),
  AI_WORKER_SHARED_SECRET: Joi.string().trim().allow("").optional(),
  AUDIO_BUFFER_FLUSH_MS: Joi.number()
    .integer()
    .positive()
    .default(DEFAULT_AUDIO_BUFFER_FLUSH_MS),
  AUDIO_BUFFER_MAX_CHUNKS: Joi.number()
    .integer()
    .positive()
    .default(DEFAULT_AUDIO_BUFFER_MAX_CHUNKS),
  AUDIO_BUFFER_IDLE_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .default(DEFAULT_AUDIO_BUFFER_IDLE_TIMEOUT_MS),
});

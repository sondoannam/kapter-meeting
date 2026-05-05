import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Logger } from "@nestjs/common";

import type { GenerateJsonProviderRequest } from "./llm-provider.interface";

interface DumpLlmPromptOptions {
  enabled: boolean;
  logDir: string;
  logger: Pick<Logger, "debug" | "warn">;
  providerName: string;
  model: string;
  request: GenerateJsonProviderRequest;
  systemPrompt: string;
  settings: Record<string, boolean | number | string | null | undefined>;
}

const buildSettingsLines = (
  settings: Record<string, boolean | number | string | null | undefined>,
): string[] =>
  Object.entries(settings)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${key.padEnd(14, " ")}: ${
          value === null ? "null" : String(value)
        }`,
    );

export const dumpLlmPromptToFile = ({
  enabled,
  logDir,
  logger,
  providerName,
  model,
  request,
  systemPrompt,
  settings,
}: DumpLlmPromptOptions): void => {
  if (!enabled) {
    return;
  }

  try {
    const dir = join(process.cwd(), logDir, "llm-prompts");
    mkdirSync(dir, { recursive: true });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const fileName = `${timestamp}-${providerName}-${request.schemaName}.txt`;
    const filePath = join(dir, fileName);

    const content = [
      `=== ${providerName.toUpperCase()} PROMPT DUMP ===`,
      `Timestamp     : ${new Date().toISOString()}`,
      `Provider      : ${providerName}`,
      `Model         : ${model}`,
      `Schema        : ${request.schemaName}`,
      `System chars  : ${systemPrompt.length}`,
      `User chars    : ${request.userPrompt.length}`,
      ...buildSettingsLines(settings),
      ``,
      `--- SYSTEM PROMPT ---`,
      systemPrompt,
      ``,
      `--- USER PROMPT ---`,
      request.userPrompt,
    ].join("\n");

    writeFileSync(filePath, content, "utf-8");
    logger.debug(`Prompt dumped to: ${filePath}`);
  } catch (error) {
    logger.warn(
      `Failed to dump prompt to file: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

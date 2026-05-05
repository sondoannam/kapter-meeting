import { parseJsonObject } from "./meeting-artifacts.schema";

export interface ProjectContextUpdate {
  contextMarkdown: string;
  changeSummary: string;
}

export const PROJECT_CONTEXT_UPDATE_JSON_SCHEMA = {
  type: "object",
  properties: {
    contextMarkdown: {
      type: "string",
      description:
        "Full replacement Markdown for the project's strategic context.",
    },
    changeSummary: {
      type: "string",
      description:
        "Concise explanation of what changed and why this update was proposed.",
    },
  },
  required: ["contextMarkdown", "changeSummary"],
  additionalProperties: false,
} satisfies Record<string, unknown>;

export const parseProjectContextUpdateJson = parseJsonObject;

export const validateProjectContextUpdate = (
  value: unknown,
): ProjectContextUpdate => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Project context update response must be an object.");
  }

  const record = value as Record<string, unknown>;

  if (typeof record.contextMarkdown !== "string") {
    throw new Error("Project context update field contextMarkdown must be a string.");
  }

  if (typeof record.changeSummary !== "string") {
    throw new Error("Project context update field changeSummary must be a string.");
  }

  const contextMarkdown = record.contextMarkdown.trim();
  const changeSummary = record.changeSummary.trim();

  if (!contextMarkdown) {
    throw new Error("Project context update field contextMarkdown is empty.");
  }

  if (!changeSummary) {
    throw new Error("Project context update field changeSummary is empty.");
  }

  return {
    contextMarkdown,
    changeSummary,
  };
};

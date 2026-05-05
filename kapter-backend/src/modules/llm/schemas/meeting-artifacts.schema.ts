export interface MeetingArtifactTask {
  taskContent: string;
  assigneeAiLabel: string | null;
  deadline: string | null;
}

export interface MeetingArtifacts {
  summary: string;
  tasks: MeetingArtifactTask[];
}

export const MEETING_ARTIFACTS_OPENAI_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Concise meeting summary in the meeting's primary language.",
    },
    tasks: {
      type: "array",
      description: "Concrete action items explicitly supported by the transcript.",
      items: {
        type: "object",
        properties: {
          taskContent: {
            type: "string",
            description: "The specific task that needs follow-up.",
          },
          assigneeAiLabel: {
            type: ["string", "null"],
            description:
              "The exact speaker aiLabel responsible for the task, or null.",
          },
          deadline: {
            type: ["string", "null"],
            description: "An ISO 8601 date or datetime only when explicitly stated.",
          },
        },
        required: ["taskContent", "assigneeAiLabel", "deadline"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "tasks"],
  additionalProperties: false,
} satisfies Record<string, unknown>;

export const MEETING_ARTIFACTS_GEMINI_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Concise meeting summary in the meeting's primary language.",
    },
    tasks: {
      type: "array",
      description: "Concrete action items explicitly supported by the transcript.",
      items: {
        type: "object",
        properties: {
          taskContent: {
            type: "string",
            description: "The specific task that needs follow-up.",
          },
          assigneeAiLabel: {
            type: ["string", "null"],
            description:
              "The exact speaker aiLabel responsible for the task, or null.",
          },
          deadline: {
            type: ["string", "null"],
            description: "An ISO 8601 date or datetime only when explicitly stated.",
          },
        },
        required: ["taskContent", "assigneeAiLabel", "deadline"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "tasks"],
  additionalProperties: false,
} satisfies Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeNullableString = (
  value: unknown,
  fieldName: string,
): string | null => {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`LLM artifact field ${fieldName} must be a string or null.`);
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const normalizeDeadline = (value: unknown): string | null => {
  const normalizedValue = normalizeNullableString(value, "deadline");

  if (!normalizedValue) {
    return null;
  }

  const parsedDeadline = new Date(normalizedValue);

  if (Number.isNaN(parsedDeadline.getTime())) {
    throw new Error("LLM artifact field deadline must be an ISO date or datetime.");
  }

  return parsedDeadline.toISOString();
};

const isValidJsonText = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

const stripThinkBlocks = (text: string): string =>
  text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();

const extractCodeFenceCandidates = (text: string): string[] =>
  [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);

const extractBalancedJsonCandidate = (text: string): string | null => {
  for (let start = 0; start < text.length; start += 1) {
    const openingToken = text[start];

    if (openingToken !== "{" && openingToken !== "[") {
      continue;
    }

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }

        if (character === "\\") {
          isEscaped = true;
          continue;
        }

        if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === "{" || character === "[") {
        depth += 1;
        continue;
      }

      if (character === "}" || character === "]") {
        depth -= 1;

        if (depth === 0) {
          const candidate = text.slice(start, index + 1).trim();

          if (isValidJsonText(candidate)) {
            return candidate;
          }

          break;
        }
      }
    }
  }

  return null;
};

export const extractStructuredJsonText = (text: string): string => {
  const sanitizedText = stripThinkBlocks(text);
  const candidates = [
    text.trim(),
    sanitizedText,
    ...extractCodeFenceCandidates(sanitizedText),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (isValidJsonText(candidate)) {
      return candidate;
    }

    const balancedCandidate = extractBalancedJsonCandidate(candidate);

    if (balancedCandidate) {
      return balancedCandidate;
    }
  }

  throw new Error("LLM provider returned text without a valid JSON payload.");
};

export const parseJsonObject = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `LLM provider returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export const validateMeetingArtifacts = (
  value: unknown,
  allowedAiLabels: readonly string[],
): MeetingArtifacts => {
  if (!isRecord(value)) {
    throw new Error("LLM artifact response must be an object.");
  }

  if (typeof value.summary !== "string") {
    throw new Error("LLM artifact field summary must be a string.");
  }

  const summary = value.summary.trim();

  if (!Array.isArray(value.tasks)) {
    throw new Error("LLM artifact field tasks must be an array.");
  }

  const allowedAiLabelSet = new Set(allowedAiLabels);
  const tasks = value.tasks.map((task, index): MeetingArtifactTask => {
    if (!isRecord(task)) {
      throw new Error(`LLM artifact task at index ${index} must be an object.`);
    }

    if (typeof task.taskContent !== "string") {
      throw new Error(
        `LLM artifact taskContent at index ${index} must be a string.`,
      );
    }

    const taskContent = task.taskContent.trim();

    if (!taskContent) {
      throw new Error(`LLM artifact taskContent at index ${index} is empty.`);
    }

    const assigneeAiLabel = normalizeNullableString(
      task.assigneeAiLabel,
      "assigneeAiLabel",
    );

    if (assigneeAiLabel && !allowedAiLabelSet.has(assigneeAiLabel)) {
      throw new Error(
        `LLM artifact assigneeAiLabel ${assigneeAiLabel} is not in the meeting speaker roster.`,
      );
    }

    return {
      taskContent,
      assigneeAiLabel,
      deadline: normalizeDeadline(task.deadline),
    };
  });

  return {
    summary,
    tasks,
  };
};

import {
  type MeetingArtifactTaskMutation,
  type MeetingArtifactTaskMutationType,
} from "../../meetings/meeting-artifact-draft.utils";

export interface MeetingExtractionChunkArtifacts {
  partialSummary: string;
  taskMutations: MeetingArtifactTaskMutation[];
}

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
    throw new Error(`${fieldName} must be a string or null.`);
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
};

const normalizeDeadline = (value: unknown): string | null => {
  const normalizedValue = normalizeNullableString(value, "deadline");

  if (!normalizedValue) {
    return null;
  }

  const parsedDeadline = new Date(normalizedValue);

  if (Number.isNaN(parsedDeadline.getTime())) {
    throw new Error("deadline must be an ISO date or datetime.");
  }

  return parsedDeadline.toISOString();
};

const normalizeTaskMutationType = (value: unknown): MeetingArtifactTaskMutationType => {
  if (value === "CREATE" || value === "UPDATE" || value === "CANCEL") {
    return value;
  }

  throw new Error("taskMutations.type must be CREATE, UPDATE, or CANCEL.");
};

const normalizeTaskKey = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new Error("taskMutations.taskKey must be a string.");
  }

  const taskKey = value.trim();

  if (!taskKey) {
    throw new Error("taskMutations.taskKey cannot be empty.");
  }

  return taskKey;
};

const normalizeTaskContent = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new Error("taskMutations.taskContent must be a string.");
  }

  const taskContent = value.trim();

  if (!taskContent) {
    throw new Error("taskMutations.taskContent cannot be empty.");
  }

  return taskContent;
};

export const MEETING_EXTRACTION_CHUNK_JSON_SCHEMA = {
  type: "object",
  properties: {
    partialSummary: {
      type: "string",
      description:
        "One or two sentences summarizing only the new-content portion of this chunk.",
    },
    taskMutations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["CREATE", "UPDATE", "CANCEL"],
          },
          taskKey: {
            type: ["string", "null"],
            description:
              "Required for UPDATE and CANCEL. Must match an existing rolling draft task key.",
          },
          taskContent: {
            type: ["string", "null"],
            description:
              "Required for CREATE. Optional for UPDATE when the text itself changes.",
          },
          assigneeAiLabel: {
            type: ["string", "null"],
            description:
              "Optional assignee update using the exact aiLabel from the speaker roster.",
          },
          deadline: {
            type: ["string", "null"],
            description:
              "Optional ISO 8601 date or datetime when the deadline is explicit.",
          },
        },
        required: ["type", "taskKey", "taskContent", "assigneeAiLabel", "deadline"],
        additionalProperties: false,
      },
    },
  },
  required: ["partialSummary", "taskMutations"],
  additionalProperties: false,
} satisfies Record<string, unknown>;

export const validateMeetingExtractionChunkArtifacts = (
  value: unknown,
  allowedAiLabels: readonly string[],
  allowedTaskKeys: readonly string[],
): MeetingExtractionChunkArtifacts => {
  if (!isRecord(value)) {
    throw new Error("Chunk extraction response must be an object.");
  }

  if (typeof value.partialSummary !== "string") {
    throw new Error("partialSummary must be a string.");
  }

  if (!Array.isArray(value.taskMutations)) {
    throw new Error("taskMutations must be an array.");
  }

  const allowedAiLabelSet = new Set(allowedAiLabels);
  const allowedTaskKeySet = new Set(allowedTaskKeys);
  const taskMutations = value.taskMutations.map((mutation, index) => {
    if (!isRecord(mutation)) {
      throw new Error(`taskMutations[${index}] must be an object.`);
    }

    const type = normalizeTaskMutationType(mutation.type);
    const assigneeAiLabel =
      mutation.assigneeAiLabel === undefined
        ? undefined
        : normalizeNullableString(mutation.assigneeAiLabel, "assigneeAiLabel");

    if (
      assigneeAiLabel &&
      !allowedAiLabelSet.has(assigneeAiLabel)
    ) {
      throw new Error(
        `taskMutations[${index}] uses assignee ${assigneeAiLabel} outside the meeting speaker roster.`,
      );
    }

    if (type === "CREATE") {
      return {
        type,
        taskContent: normalizeTaskContent(mutation.taskContent),
        assigneeAiLabel: assigneeAiLabel ?? null,
        deadline:
          mutation.deadline === undefined
            ? null
            : normalizeDeadline(mutation.deadline),
      } satisfies MeetingArtifactTaskMutation;
    }

    const taskKey = normalizeTaskKey(mutation.taskKey);

    if (!allowedTaskKeySet.has(taskKey)) {
      throw new Error(
        `taskMutations[${index}] references unknown rolling task key ${taskKey}.`,
      );
    }

    if (type === "CANCEL") {
      return {
        type,
        taskKey,
      } satisfies MeetingArtifactTaskMutation;
    }

    const normalizedMutation: MeetingArtifactTaskMutation = {
      type,
      taskKey,
    };

    if (mutation.taskContent !== null && mutation.taskContent !== undefined) {
      normalizedMutation.taskContent = normalizeTaskContent(mutation.taskContent);
    }

    if (Object.prototype.hasOwnProperty.call(mutation, "assigneeAiLabel")) {
      normalizedMutation.assigneeAiLabel = assigneeAiLabel ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(mutation, "deadline")) {
      normalizedMutation.deadline = normalizeDeadline(mutation.deadline);
    }

    if (
      normalizedMutation.taskContent === undefined &&
      normalizedMutation.assigneeAiLabel === undefined &&
      normalizedMutation.deadline === undefined
    ) {
      throw new Error(
        `taskMutations[${index}] UPDATE must change at least one task field.`,
      );
    }

    return normalizedMutation;
  });

  return {
    partialSummary: value.partialSummary.trim(),
    taskMutations,
  };
};

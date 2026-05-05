export type MeetingArtifactTaskMutationType = "CREATE" | "UPDATE" | "CANCEL";

export interface MeetingArtifactDraftTask {
  taskKey: string;
  taskContent: string;
  assigneeAiLabel: string | null;
  deadline: string | null;
  active: boolean;
  lastMutationChunkIndex: number;
}

export interface MeetingArtifactTaskMutation {
  type: MeetingArtifactTaskMutationType;
  taskKey?: string;
  taskContent?: string;
  assigneeAiLabel?: string | null;
  deadline?: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const normalizeTaskKey = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new Error("Draft task keys must be strings.");
  }

  const taskKey = value.trim();

  if (!taskKey) {
    throw new Error("Draft task keys cannot be empty.");
  }

  return taskKey;
};

const normalizeTaskContent = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }

  const taskContent = value.trim();

  if (!taskContent) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  return taskContent;
};

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

const normalizeChunkIndex = (value: unknown): number => {
  if (!Number.isInteger(value)) {
    throw new Error("Draft task lastMutationChunkIndex must be an integer.");
  }

  return Number(value);
};

const buildNextTaskKey = (
  tasks: readonly MeetingArtifactDraftTask[],
): string => {
  const maxTaskIndex = tasks.reduce((currentMax, task) => {
    const match = /^task_(\d+)$/.exec(task.taskKey);
    const taskIndex = match ? Number.parseInt(match[1] ?? "", 10) : 0;

    return Number.isInteger(taskIndex) && taskIndex > currentMax
      ? taskIndex
      : currentMax;
  }, 0);

  return `task_${maxTaskIndex + 1}`;
};

const findTaskIndex = (
  tasks: readonly MeetingArtifactDraftTask[],
  taskKey: string,
): number => tasks.findIndex((task) => task.taskKey === taskKey);

export const parseMeetingArtifactDraftTasks = (
  value: unknown,
): MeetingArtifactDraftTask[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsedTasks = value.map((task): MeetingArtifactDraftTask => {
    if (!isRecord(task)) {
      throw new Error("Draft task entries must be objects.");
    }

    return {
      taskKey: normalizeTaskKey(task.taskKey),
      taskContent: normalizeTaskContent(task.taskContent, "taskContent"),
      assigneeAiLabel: normalizeNullableString(
        task.assigneeAiLabel,
        "assigneeAiLabel",
      ),
      deadline: normalizeDeadline(task.deadline),
      active: Boolean(task.active),
      lastMutationChunkIndex: normalizeChunkIndex(task.lastMutationChunkIndex),
    };
  });

  const uniqueTaskKeys = new Set(parsedTasks.map((task) => task.taskKey));

  if (uniqueTaskKeys.size !== parsedTasks.length) {
    throw new Error("Draft task keys must be unique.");
  }

  return parsedTasks;
};

export const applyTaskMutationsToDraft = (
  currentTasks: readonly MeetingArtifactDraftTask[],
  mutations: readonly MeetingArtifactTaskMutation[],
  chunkIndex: number,
): MeetingArtifactDraftTask[] => {
  const nextTasks = currentTasks.map((task) => ({ ...task }));

  for (const mutation of mutations) {
    if (mutation.type === "CREATE") {
      nextTasks.push({
        taskKey: buildNextTaskKey(nextTasks),
        taskContent: normalizeTaskContent(mutation.taskContent, "taskContent"),
        assigneeAiLabel:
          mutation.assigneeAiLabel === undefined
            ? null
            : normalizeNullableString(
                mutation.assigneeAiLabel,
                "assigneeAiLabel",
              ),
        deadline:
          mutation.deadline === undefined ? null : normalizeDeadline(mutation.deadline),
        active: true,
        lastMutationChunkIndex: chunkIndex,
      });
      continue;
    }

    const taskKey = normalizeTaskKey(mutation.taskKey);
    const taskIndex = findTaskIndex(nextTasks, taskKey);

    if (taskIndex === -1) {
      throw new Error(`Unknown rolling draft task key ${taskKey}.`);
    }

    const existingTask = nextTasks[taskIndex]!;

    if (mutation.type === "CANCEL") {
      existingTask.active = false;
      existingTask.lastMutationChunkIndex = chunkIndex;
      continue;
    }

    if (!existingTask.active) {
      throw new Error(`Cannot update inactive rolling draft task ${taskKey}.`);
    }

    if (mutation.taskContent !== undefined) {
      existingTask.taskContent = normalizeTaskContent(
        mutation.taskContent,
        "taskContent",
      );
    }

    if (hasOwn(mutation, "assigneeAiLabel")) {
      existingTask.assigneeAiLabel = normalizeNullableString(
        mutation.assigneeAiLabel,
        "assigneeAiLabel",
      );
    }

    if (hasOwn(mutation, "deadline")) {
      existingTask.deadline = normalizeDeadline(mutation.deadline);
    }

    existingTask.lastMutationChunkIndex = chunkIndex;
    existingTask.active = true;
  }

  return nextTasks;
};

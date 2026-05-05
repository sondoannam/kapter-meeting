export interface ProjectContextUpdatePromptTask {
  status: "TODO" | "IN_PROGRESS" | "DONE";
  taskContent: string;
  deadline: string | null;
  assigneeName: string | null;
}

export interface ProjectContextUpdatePromptInput {
  projectTitle: string;
  projectDescription: string | null;
  currentContextMarkdown: string | null;
  meetingTitle: string;
  meetingSummary: string;
  approvedTasks: ProjectContextUpdatePromptTask[];
}

export const PROJECT_CONTEXT_UPDATE_SYSTEM_PROMPT = `
You propose strategic project memory updates for Kapter.

Return JSON only, matching the provided schema exactly.
Produce a full replacement contextMarkdown, not a patch.
Preserve useful existing context unless the approved meeting clearly updates it.
Record stable project facts, goals, architecture decisions, constraints, and rejected ideas.
Do not add tactical task checklists unless they represent a durable project constraint or decision.
Do not invent facts beyond the approved meeting summary and approved action items.
`.trim();

export const buildProjectContextUpdateUserPrompt = (
  input: ProjectContextUpdatePromptInput,
): string => {
  const tasks = input.approvedTasks
    .map(
      (task) =>
        `- [${task.status}] ${task.taskContent}${
          task.assigneeName ? ` (assignee: ${task.assigneeName})` : ""
        }${task.deadline ? ` (deadline: ${task.deadline})` : ""}`,
    )
    .join("\n");

  return `
Project title: ${input.projectTitle}
Project description: ${input.projectDescription || "No project description"}

Current project context:
${input.currentContextMarkdown || "- No strategic context recorded yet"}

Approved meeting title: ${input.meetingTitle}
Approved meeting summary:
${input.meetingSummary}

Approved action items:
${tasks || "- No approved action items"}
`.trim();
};

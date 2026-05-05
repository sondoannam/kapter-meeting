export interface MeetingArtifactPromptSpeaker {
  aiLabel: string;
  realName: string | null;
}

export interface MeetingArtifactPromptTranscriptSegment {
  aiLabel: string;
  realName: string | null;
  startTime: number;
  endTime: number;
  content: string;
}

export interface MeetingArtifactPromptTaskMemory {
  status: "TODO" | "IN_PROGRESS" | "DONE";
  taskContent: string;
  deadline: string | null;
  sourceMeetingTitle: string;
}

export interface MeetingArtifactPromptInput {
  meetingTitle: string;
  meetingCreatedAt: string;
  projectTitle: string | null;
  projectDescription: string | null;
  projectContextMarkdown: string | null;
  tacticalTasks: MeetingArtifactPromptTaskMemory[];
  speakers: MeetingArtifactPromptSpeaker[];
  transcriptSegments: MeetingArtifactPromptTranscriptSegment[];
}

export const MEETING_ARTIFACTS_SYSTEM_PROMPT = `
You extract structured meeting artifacts from diarized transcripts for Kapter.

Return JSON only, matching the provided schema exactly.
Do not invent facts, tasks, assignees, or deadlines.
Use the transcript as the source of truth for new summary and tasks.
Use project context only to resolve project-specific jargon, constraints, and continuity.
Use active task memory only to avoid duplicating existing work.
Write the summary in the primary language used in the meeting.
Create a task only when the transcript contains a concrete follow-up action.
Set assigneeAiLabel to the exact aiLabel from the speaker roster when ownership is clear; otherwise use null.
Set deadline to an ISO 8601 date or datetime only when the transcript explicitly states a deadline.
If a relative deadline is stated, resolve it from meetingCreatedAt only when the relative date is unambiguous.
If no tasks are present, return an empty tasks array.
`.trim();

const formatTimestamp = (seconds: number): string => {
  if (!Number.isFinite(seconds)) {
    return "unknown";
  }

  return `${seconds.toFixed(2)}s`;
};

export const buildMeetingArtifactsUserPrompt = (
  input: MeetingArtifactPromptInput,
): string => {
  const speakers = input.speakers
    .map((speaker) =>
      speaker.realName
        ? `- ${speaker.aiLabel} (${speaker.realName})`
        : `- ${speaker.aiLabel}`,
    )
    .join("\n");

  const transcript = input.transcriptSegments
    .map((segment) => {
      const speakerName = segment.realName
        ? `${segment.aiLabel} (${segment.realName})`
        : segment.aiLabel;

      return `[${formatTimestamp(segment.startTime)}-${formatTimestamp(
        segment.endTime,
      )}] ${speakerName}: ${segment.content}`;
    })
    .join("\n");
  const tacticalTasks = input.tacticalTasks
    .map(
      (task) =>
        `- [${task.status}] ${task.taskContent} (source: ${
          task.sourceMeetingTitle
        }${task.deadline ? `, deadline: ${task.deadline}` : ""})`,
    )
    .join("\n");

  return `
Project title: ${input.projectTitle || "No project attached"}
Project description: ${input.projectDescription || "No project description"}
Project strategic context:
${input.projectContextMarkdown || "- No strategic context recorded yet"}

Current approved project task memory:
${tacticalTasks || "- No approved project tasks recorded yet"}

Meeting title: ${input.meetingTitle}
meetingCreatedAt: ${input.meetingCreatedAt}

Speaker roster:
${speakers || "- No speakers detected"}

Transcript:
${transcript || "- No transcript segments available"}
`.trim();
};

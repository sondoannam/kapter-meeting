import type {
  MeetingArtifactDraftTask,
} from "../../meetings/meeting-artifact-draft.utils";
import type {
  MeetingArtifactPromptSpeaker,
  MeetingArtifactPromptTaskMemory,
  MeetingArtifactPromptTranscriptSegment,
} from "./meeting-artifacts.prompt";

export interface MeetingExtractionChunkPromptInput {
  meetingTitle: string;
  meetingCreatedAt: string;
  projectTitle: string | null;
  projectDescription: string | null;
  projectContextMarkdown: string | null;
  tacticalTasks: MeetingArtifactPromptTaskMemory[];
  speakers: MeetingArtifactPromptSpeaker[];
  transcriptSegments: MeetingArtifactPromptTranscriptSegment[];
  currentRollingTasks: MeetingArtifactDraftTask[];
  newContentStartMs: number;
  promptStartMs: number;
  promptEndMs: number;
}

export const MEETING_EXTRACTION_CHUNK_SYSTEM_PROMPT = `
You update rolling meeting artifacts for Kapter from one transcript window.

Return JSON only, matching the provided schema exactly.
The transcript may include overlap context from earlier in the meeting.
Use overlap only to understand continuity. The partialSummary must describe only the new-content portion of the chunk.
Do not invent facts, tasks, assignees, deadlines, or cancellations.
When a follow-up already exists in the rolling task state, prefer UPDATE or CANCEL instead of creating a duplicate task.
Use CREATE only for a new concrete follow-up action supported by the transcript.
Use CANCEL only when the transcript clearly reverses, removes, or dismisses an earlier task.
Use the exact rolling taskKey when returning UPDATE or CANCEL.
Set assigneeAiLabel to the exact aiLabel from the speaker roster when ownership is clear; otherwise use null.
Set deadline to an ISO 8601 date or datetime only when the transcript explicitly states it.
If a relative deadline is stated, resolve it from meetingCreatedAt only when the date is unambiguous.
If no task changes are needed, return an empty taskMutations array.
`.trim();

const formatTimestamp = (seconds: number): string => {
  if (!Number.isFinite(seconds)) {
    return "unknown";
  }

  return `${seconds.toFixed(2)}s`;
};

export const buildMeetingExtractionChunkUserPrompt = (
  input: MeetingExtractionChunkPromptInput,
): string => {
  const speakers = input.speakers
    .map((speaker) =>
      speaker.realName
        ? `- ${speaker.aiLabel} (${speaker.realName})`
        : `- ${speaker.aiLabel}`,
    )
    .join("\n");
  const tacticalTasks = input.tacticalTasks
    .map(
      (task) =>
        `- [${task.status}] ${task.taskContent} (source: ${
          task.sourceMeetingTitle
        }${task.deadline ? `, deadline: ${task.deadline}` : ""})`,
    )
    .join("\n");
  const rollingTasks = input.currentRollingTasks
    .filter((task) => task.active)
    .map(
      (task) =>
        `- ${task.taskKey}: ${task.taskContent} (assignee: ${
          task.assigneeAiLabel ?? "unassigned"
        }${task.deadline ? `, deadline: ${task.deadline}` : ""})`,
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

Current rolling draft tasks:
${rollingTasks || "- No active rolling draft tasks yet"}

New-content window start (inclusive): ${(input.newContentStartMs / 1000).toFixed(2)}s
Prompt window start: ${(input.promptStartMs / 1000).toFixed(2)}s
Prompt window end: ${(input.promptEndMs / 1000).toFixed(2)}s

Transcript window:
${transcript || "- No transcript segments available"}
`.trim();
};

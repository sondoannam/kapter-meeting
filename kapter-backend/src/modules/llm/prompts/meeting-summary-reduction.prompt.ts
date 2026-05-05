export interface MeetingSummaryReductionPromptInput {
  meetingTitle: string;
  meetingCreatedAt: string;
  partialSummaries: string[];
}

export const MEETING_SUMMARY_REDUCTION_SYSTEM_PROMPT = `
You reduce chunk-level partial summaries into one cohesive Kapter meeting summary.

Return JSON only, matching the provided schema exactly.
Write a concise, non-repetitive executive summary in the meeting's primary language.
Preserve important decisions, outcomes, and follow-up context that materially define the meeting.
Do not invent facts beyond the supplied partial summaries.
`.trim();

export const buildMeetingSummaryReductionUserPrompt = (
  input: MeetingSummaryReductionPromptInput,
): string => {
  const partialSummaries = input.partialSummaries
    .map((summary, index) => `${index + 1}. ${summary}`)
    .join("\n");

  return `
Meeting title: ${input.meetingTitle}
meetingCreatedAt: ${input.meetingCreatedAt}

Chunk partial summaries:
${partialSummaries || "- No partial summaries available"}
`.trim();
};

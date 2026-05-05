export interface MeetingSummaryReduction {
  summary: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const MEETING_SUMMARY_REDUCTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "A cohesive, non-repetitive final executive summary of the full meeting.",
    },
  },
  required: ["summary"],
  additionalProperties: false,
} satisfies Record<string, unknown>;

export const validateMeetingSummaryReduction = (
  value: unknown,
): MeetingSummaryReduction => {
  if (!isRecord(value)) {
    throw new Error("Summary reduction response must be an object.");
  }

  if (typeof value.summary !== "string") {
    throw new Error("Summary reduction field summary must be a string.");
  }

  return {
    summary: value.summary.trim(),
  };
};

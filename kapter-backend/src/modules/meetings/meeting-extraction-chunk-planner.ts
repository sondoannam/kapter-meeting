export interface PlannedMeetingExtractionChunk {
  chunkIndex: number;
  newContentStartMs: number;
  promptStartMs: number;
  promptEndMs: number;
}

export interface PlanMeetingExtractionChunksInput {
  existingChunkCount: number;
  maxTranscriptEndMs: number;
  captureCompleted: boolean;
  targetWindowMs: number;
  overlapWindowMs: number;
}

export const planMeetingExtractionChunks = (
  input: PlanMeetingExtractionChunksInput,
): PlannedMeetingExtractionChunk[] => {
  const maxTranscriptEndMs = Math.max(0, input.maxTranscriptEndMs);

  if (maxTranscriptEndMs <= 0) {
    return [];
  }

  const fullChunkCount = Math.floor(maxTranscriptEndMs / input.targetWindowMs);
  const hasTailChunk = maxTranscriptEndMs % input.targetWindowMs !== 0;
  const targetChunkCount =
    fullChunkCount +
    (input.captureCompleted && hasTailChunk ? 1 : 0);

  if (targetChunkCount <= input.existingChunkCount) {
    return [];
  }

  const plannedChunks: PlannedMeetingExtractionChunk[] = [];

  for (
    let chunkIndex = input.existingChunkCount;
    chunkIndex < targetChunkCount;
    chunkIndex += 1
  ) {
    const newContentStartMs = chunkIndex * input.targetWindowMs;
    const defaultPromptEndMs = Math.min(
      maxTranscriptEndMs,
      newContentStartMs + input.targetWindowMs,
    );
    const promptEndMs =
      chunkIndex === targetChunkCount - 1 && input.captureCompleted
        ? maxTranscriptEndMs
        : defaultPromptEndMs;

    plannedChunks.push({
      chunkIndex,
      newContentStartMs,
      promptStartMs: Math.max(
        0,
        newContentStartMs - input.overlapWindowMs,
      ),
      promptEndMs,
    });
  }

  return plannedChunks;
};

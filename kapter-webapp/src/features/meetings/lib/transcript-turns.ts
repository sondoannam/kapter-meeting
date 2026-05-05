import type {
  DashboardMeetingTranscriptSegment,
  DashboardMeetingTranscriptTurn,
} from "../types"

const TERMINAL_PUNCTUATION_REGEX = /[.!?…。！？]["')\]]*$/u
const LEADING_PUNCTUATION_REGEX = /^[,.;:!?%)\]}»”’]/u
const TRAILING_JOINER_REGEX = /[([{«“‘]$/u
const MAX_GAP_SECONDS = 1.25

function endsSentence(text: string) {
  return TERMINAL_PUNCTUATION_REGEX.test(text.trim())
}

function joinContent(left: string, right: string) {
  const normalizedLeft = left.trim()
  const normalizedRight = right.trim()

  if (!normalizedLeft) {
    return normalizedRight
  }

  if (!normalizedRight) {
    return normalizedLeft
  }

  if (LEADING_PUNCTUATION_REGEX.test(normalizedRight)) {
    return `${normalizedLeft}${normalizedRight}`
  }

  if (TRAILING_JOINER_REGEX.test(normalizedLeft)) {
    return `${normalizedLeft}${normalizedRight}`
  }

  return `${normalizedLeft} ${normalizedRight}`
}

function appendUnique<T extends string>(items: T[], value: T | null): T[] {
  if (!value || items.includes(value)) {
    return items
  }

  return [...items, value]
}

function createTurn(
  segment: DashboardMeetingTranscriptSegment
): DashboardMeetingTranscriptTurn {
  return {
    id: segment.id,
    speakerId: segment.speakerId,
    aiLabel: segment.aiLabel,
    realName: segment.realName,
    content: segment.content.trim(),
    startTime: segment.startTime,
    endTime: segment.endTime,
    sourceSegmentCount: 1,
    sourceTypes: segment.sourceType ? [segment.sourceType] : [],
    mergeStrategies: segment.mergeStrategy ? [segment.mergeStrategy] : [],
    mergeSourceTypes: segment.mergeSourceType ? [segment.mergeSourceType] : [],
  }
}

export function buildTranscriptTurns(
  segments: DashboardMeetingTranscriptSegment[]
): DashboardMeetingTranscriptTurn[] {
  if (segments.length === 0) {
    return []
  }

  const sortedSegments = [...segments].sort((left, right) => {
    if (left.startTime === right.startTime) {
      return left.endTime - right.endTime
    }

    return left.startTime - right.startTime
  })

  const turns: DashboardMeetingTranscriptTurn[] = []
  let currentTurn = createTurn(sortedSegments[0])

  for (const segment of sortedSegments.slice(1)) {
    const gap = segment.startTime - currentTurn.endTime
    const currentTurnSourceType = currentTurn.sourceTypes[0] ?? null
    const currentTurnMergeStrategy = currentTurn.mergeStrategies[0] ?? null
    const shouldMerge =
      segment.speakerId === currentTurn.speakerId &&
      gap <= MAX_GAP_SECONDS &&
      !endsSentence(currentTurn.content) &&
      segment.sourceType === currentTurnSourceType &&
      segment.mergeStrategy === currentTurnMergeStrategy

    if (!shouldMerge) {
      turns.push(currentTurn)
      currentTurn = createTurn(segment)
      continue
    }

    currentTurn = {
      ...currentTurn,
      id: `${currentTurn.id}__${segment.id}`,
      realName: currentTurn.realName ?? segment.realName,
      content: joinContent(currentTurn.content, segment.content),
      endTime: Math.max(currentTurn.endTime, segment.endTime),
      sourceSegmentCount: currentTurn.sourceSegmentCount + 1,
      sourceTypes: appendUnique(currentTurn.sourceTypes, segment.sourceType),
      mergeStrategies: appendUnique(
        currentTurn.mergeStrategies,
        segment.mergeStrategy
      ),
      mergeSourceTypes: appendUnique(
        currentTurn.mergeSourceTypes,
        segment.mergeSourceType
      ),
    }
  }

  turns.push(currentTurn)
  return turns
}

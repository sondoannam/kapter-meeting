import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

const VERY_SHORT_TURN_SECONDS = 0.75;
const SHORT_TURN_SECONDS = 1.25;
const MAX_SHORT_TURN_WORDS = 4;
const REPAIR_SCORE_THRESHOLD = 0.75;
const REPAIR_SCORE_MARGIN = 0.2;
const BACKCHANNEL_TOKENS = new Set([
  "ok",
  "okay",
  "right",
  "nice",
  "yes",
  "yeah",
  "yep",
  "no",
  "uh",
  "uhhuh",
  "mm",
  "hmm",
  "dạ",
  "vâng",
  "ừ",
  "ừm",
  "ờ",
  "okela",
]);

type RepairSegment = {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  content: string;
  sourceType: "TAB_MIX" | "SELF_MIC" | null;
  mergeStrategy: "PREFERRED_SELF_MIC_DUPLICATE" | "AMBIGUOUS_OVERLAP" | null;
  speaker: {
    aiLabel: string;
    recurringSpeakerProfileId: string | null;
  };
};

export type MeetingSpeakerRepairResult = {
  materialChanges: boolean;
  repairedSegments: number;
};

const normalizeLexicalContent = (content: string): string[] =>
  content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const isShortTurn = (segment: RepairSegment): boolean => {
  const durationSeconds = segment.endTime - segment.startTime;
  if (durationSeconds <= VERY_SHORT_TURN_SECONDS) {
    return true;
  }

  if (durationSeconds > SHORT_TURN_SECONDS) {
    return false;
  }

  return normalizeLexicalContent(segment.content).length <= MAX_SHORT_TURN_WORDS;
};

const isBackchannelTurn = (segment: RepairSegment): boolean => {
  const tokens = normalizeLexicalContent(segment.content);

  if (tokens.length === 0 || tokens.length > MAX_SHORT_TURN_WORDS) {
    return false;
  }

  return tokens.every((token) => BACKCHANNEL_TOKENS.has(token));
};

@Injectable()
export class MeetingSpeakerRepairService {
  constructor(private readonly prisma: PrismaService) {}

  async repairMeetingShortTurns(
    meetingId: string,
  ): Promise<MeetingSpeakerRepairResult> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        artifactReviewStatus: true,
      },
    });

    if (
      !meeting ||
      meeting.status !== "COMPLETED" ||
      meeting.artifactReviewStatus === "APPROVED"
    ) {
      return {
        materialChanges: false,
        repairedSegments: 0,
      };
    }

    const segments = await this.prisma.transcriptSegment.findMany({
      where: {
        meetingId,
        isSuppressed: false,
      },
      orderBy: {
        startTime: "asc",
      },
      select: {
        id: true,
        speakerId: true,
        startTime: true,
        endTime: true,
        content: true,
        sourceType: true,
        mergeStrategy: true,
        speaker: {
          select: {
            aiLabel: true,
            recurringSpeakerProfileId: true,
          },
        },
      },
    });

    const rewrites: Array<{ segmentId: string; speakerId: string }> = [];

    for (const [index, segment] of segments.entries()) {
      if (
        segment.mergeStrategy === "AMBIGUOUS_OVERLAP" ||
        !isShortTurn(segment as RepairSegment)
      ) {
        continue;
      }

      const previousSegment = this.findAdjacentNonShortSegment(segments, index, -1);
      const nextSegment = this.findAdjacentNonShortSegment(segments, index, 1);
      const decision = this.chooseSpeakerRepairCandidate(
        segment as RepairSegment,
        previousSegment as RepairSegment | null,
        nextSegment as RepairSegment | null,
      );

      if (!decision || decision.speakerId === segment.speakerId) {
        continue;
      }

      rewrites.push({
        segmentId: segment.id,
        speakerId: decision.speakerId,
      });
    }

    for (const rewrite of rewrites) {
      await this.prisma.transcriptSegment.update({
        where: {
          id: rewrite.segmentId,
        },
        data: {
          speakerId: rewrite.speakerId,
        },
      });
    }

    return {
      materialChanges: rewrites.length > 0,
      repairedSegments: rewrites.length,
    };
  }

  private findAdjacentNonShortSegment(
    segments: RepairSegment[],
    startIndex: number,
    direction: -1 | 1,
  ): RepairSegment | null {
    let currentIndex = startIndex + direction;

    while (currentIndex >= 0 && currentIndex < segments.length) {
      const candidate = segments[currentIndex]!;

      if (!isShortTurn(candidate)) {
        return candidate;
      }

      currentIndex += direction;
    }

    return null;
  }

  private chooseSpeakerRepairCandidate(
    segment: RepairSegment,
    previousSegment: RepairSegment | null,
    nextSegment: RepairSegment | null,
  ): { speakerId: string; score: number } | null {
    const candidateScores = new Map<string, number>();

    const applyScore = (speakerId: string, score: number) => {
      candidateScores.set(
        speakerId,
        (candidateScores.get(speakerId) ?? 0) + score,
      );
    };

    if (previousSegment) {
      applyScore(previousSegment.speakerId, 0.35);
      if (
        previousSegment.sourceType &&
        previousSegment.sourceType === segment.sourceType
      ) {
        applyScore(previousSegment.speakerId, 0.1);
      }
      if (previousSegment.speaker.aiLabel === "RECORDER") {
        applyScore(previousSegment.speakerId, 0.05);
      }
    }

    if (nextSegment) {
      applyScore(nextSegment.speakerId, 0.35);
      if (nextSegment.sourceType && nextSegment.sourceType === segment.sourceType) {
        applyScore(nextSegment.speakerId, 0.1);
      }
      if (nextSegment.speaker.aiLabel === "RECORDER") {
        applyScore(nextSegment.speakerId, 0.05);
      }
    }

    if (
      previousSegment &&
      nextSegment &&
      previousSegment.speakerId === nextSegment.speakerId
    ) {
      applyScore(previousSegment.speakerId, 0.3);
    }

    if (
      previousSegment &&
      nextSegment &&
      previousSegment.speaker.recurringSpeakerProfileId &&
      previousSegment.speaker.recurringSpeakerProfileId ===
        nextSegment.speaker.recurringSpeakerProfileId
    ) {
      applyScore(previousSegment.speakerId, 0.15);
      applyScore(nextSegment.speakerId, 0.15);
    }

    if (segment.sourceType === "SELF_MIC") {
      if (previousSegment?.speaker.aiLabel === "RECORDER") {
        applyScore(previousSegment.speakerId, 0.2);
      }

      if (nextSegment?.speaker.aiLabel === "RECORDER") {
        applyScore(nextSegment.speakerId, 0.2);
      }
    }

    if (isBackchannelTurn(segment) && previousSegment) {
      applyScore(previousSegment.speakerId, 0.15);
    }

    const orderedCandidates = [...candidateScores.entries()].sort(
      (left, right) => right[1] - left[1],
    );
    const [bestCandidate, secondCandidate] = orderedCandidates;

    if (!bestCandidate || bestCandidate[1] < REPAIR_SCORE_THRESHOLD) {
      return null;
    }

    if (
      secondCandidate &&
      bestCandidate[1] - secondCandidate[1] < REPAIR_SCORE_MARGIN
    ) {
      return null;
    }

    return {
      speakerId: bestCandidate[0],
      score: bestCandidate[1],
    };
  }
}

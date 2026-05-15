import type { ProcessedAudioBatch } from "../ai-worker/ai-worker.client";
import { Inject, Injectable } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { PrismaService } from "../../database/prisma.service";
import { MeetingArtifactExtractionService } from "./meeting-artifact-extraction.service";
import { toPrismaAudioSourceType } from "../audio-stream/audio-source.utils";

type PersistedAudioSourceType = "TAB_MIX" | "SELF_MIC" | undefined;

type MergeDecision =
  | {
      kind: "persist";
    }
  | {
      kind: "prefer-self-mic";
      suppressedExistingIds: string[];
      counterpartSourceType: "TAB_MIX" | "SELF_MIC";
      suppressIncoming: boolean;
    }
  | {
      kind: "ambiguous-overlap";
      counterpartSourceType: "TAB_MIX" | "SELF_MIC";
    };

type ExistingTranscriptSegment = {
  id: string;
  startTime: number;
  endTime: number;
  content: string;
  sourceType: "TAB_MIX" | "SELF_MIC" | null;
};

const DUPLICATE_OVERLAP_RATIO_THRESHOLD = 0.6;
const DUPLICATE_TEXT_OVERLAP_THRESHOLD = 0.8;

const normalizeTranscriptText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeTranscriptText = (value: string): string[] =>
  normalizeTranscriptText(value).split(" ").filter(Boolean);

const calculateOverlapSeconds = (
  left: { startTime: number; endTime: number },
  right: { startTime: number; endTime: number },
): number =>
  Math.max(
    0,
    Math.min(left.endTime, right.endTime) -
      Math.max(left.startTime, right.startTime),
  );

const calculateOverlapRatio = (
  left: { startTime: number; endTime: number },
  right: { startTime: number; endTime: number },
): number => {
  const overlap = calculateOverlapSeconds(left, right);
  const shortestDuration = Math.max(
    0.001,
    Math.min(left.endTime - left.startTime, right.endTime - right.startTime),
  );

  return overlap / shortestDuration;
};

const calculateTokenOverlapRatio = (left: string, right: string): number => {
  const leftTokens = tokenizeTranscriptText(left);
  const rightTokens = tokenizeTranscriptText(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightTokenSet = new Set(rightTokens);
  const intersectionCount = leftTokens.filter((token) =>
    rightTokenSet.has(token),
  ).length;

  return intersectionCount / Math.max(leftTokens.length, rightTokens.length);
};

const areStrongDuplicateCandidates = (
  left: { content: string; startTime: number; endTime: number },
  right: { content: string; startTime: number; endTime: number },
): boolean => {
  if (calculateOverlapRatio(left, right) < DUPLICATE_OVERLAP_RATIO_THRESHOLD) {
    return false;
  }

  const normalizedLeft = normalizeTranscriptText(left.content);
  const normalizedRight = normalizeTranscriptText(right.content);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  if (
    normalizedLeft.length >= 12 &&
    normalizedRight.length >= 12 &&
    (normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft))
  ) {
    return true;
  }

  return (
    calculateTokenOverlapRatio(left.content, right.content) >=
    DUPLICATE_TEXT_OVERLAP_THRESHOLD
  );
};

const resolveComparisonSourceTypes = (
  sourceType: PersistedAudioSourceType,
): Array<"TAB_MIX" | "SELF_MIC" | null> => {
  if (sourceType === "SELF_MIC") {
    return ["TAB_MIX", null];
  }

  if (sourceType === "TAB_MIX") {
    return ["SELF_MIC"];
  }

  return [];
};

const resolveMergeDecision = (
  sourceType: PersistedAudioSourceType,
  incomingSegment: {
    content: string;
    startTime: number;
    endTime: number;
  },
  overlaps: ExistingTranscriptSegment[],
): MergeDecision => {
  if (!sourceType || overlaps.length === 0) {
    return { kind: "persist" };
  }

  const strongDuplicates = overlaps.filter((existingSegment) =>
    areStrongDuplicateCandidates(incomingSegment, existingSegment),
  );

  if (strongDuplicates.length > 0) {
    if (sourceType === "SELF_MIC") {
      return {
        kind: "prefer-self-mic",
        suppressedExistingIds: strongDuplicates.map((segment) => segment.id),
        counterpartSourceType: "TAB_MIX",
        suppressIncoming: false,
      };
    }

    return {
      kind: "prefer-self-mic",
      suppressedExistingIds: [],
      counterpartSourceType: "SELF_MIC",
      suppressIncoming: true,
    };
  }

  const hasAmbiguousOverlap = overlaps.some(
    (existingSegment) =>
      calculateOverlapRatio(incomingSegment, existingSegment) >=
      DUPLICATE_OVERLAP_RATIO_THRESHOLD,
  );

  if (!hasAmbiguousOverlap) {
    return { kind: "persist" };
  }

  return {
    kind: "ambiguous-overlap",
    counterpartSourceType: sourceType === "SELF_MIC" ? "TAB_MIX" : "SELF_MIC",
  };
};

@Injectable()
export class TranscriptPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetingArtifactExtraction: MeetingArtifactExtractionService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async persistWorkerBatch(processedBatch: ProcessedAudioBatch): Promise<void> {
    const { batchId, request, response } = processedBatch;
    const speakerEvidence = response.speakerEvidence ?? [];
    const uniqueLabels = [
      ...new Set([
        ...response.segments.map((segment) => segment.aiLabel),
        ...speakerEvidence.map((evidence) => evidence.aiLabel),
      ]),
    ];
    const mergeMetrics = {
      duplicateSuppressionCount: 0,
      mergeConflictCount: 0,
      recoveredRecorderSegmentCount: 0,
    };

    await this.prisma.$transaction(async (tx) => {
      const batch = await tx.meetingAudioBatch.findUnique({
        where: { id: batchId },
        select: {
          status: true,
        },
      });

      if (batch?.status === "COMPLETED") {
        return;
      }

      const speakerIdByLabel = new Map<string, string>();
      const suppressedTranscriptSegmentIds = new Set<string>();
      const voiceProfileIdByLabel = new Map<string, string>();
      const voiceProfileIds = [
        ...new Set(
          [
            ...response.segments.map((segment) => segment.voiceProfileId),
            ...speakerEvidence.map((evidence) => evidence.voiceProfileId),
          ].filter((voiceProfileId): voiceProfileId is string => !!voiceProfileId),
        ),
      ];
      const voiceProfileNameById =
        voiceProfileIds.length > 0
          ? new Map(
              (
                await tx.voiceProfile.findMany({
                  where: {
                    id: {
                      in: voiceProfileIds,
                    },
                  },
                  select: {
                    id: true,
                    displayName: true,
                  },
                })
              ).map((voiceProfile) => [voiceProfile.id, voiceProfile.displayName]),
            )
          : new Map<string, string>();

      for (const segment of response.segments) {
        if (segment.voiceProfileId) {
          voiceProfileIdByLabel.set(segment.aiLabel, segment.voiceProfileId);
        }
      }

      for (const evidence of speakerEvidence) {
        if (evidence.voiceProfileId) {
          voiceProfileIdByLabel.set(evidence.aiLabel, evidence.voiceProfileId);
        }
      }

      for (const aiLabel of uniqueLabels) {
        const voiceProfileId = voiceProfileIdByLabel.get(aiLabel) ?? null;
        const speakerProfile = await tx.speakerProfile.upsert({
          where: {
            meetingId_aiLabel: {
              meetingId: request.backendMeetingId,
              aiLabel,
            },
          },
          update: voiceProfileId
            ? {
                voiceProfileId,
                realName: voiceProfileNameById.get(voiceProfileId) ?? aiLabel,
              }
            : {},
          create: {
            meetingId: request.backendMeetingId,
            aiLabel,
            voiceProfileId,
            realName: voiceProfileId
              ? (voiceProfileNameById.get(voiceProfileId) ?? aiLabel)
              : null,
          },
        });

        speakerIdByLabel.set(aiLabel, speakerProfile.id);
      }

      if (response.segments.length > 0) {
        const transcriptRows = [];

        for (const segment of response.segments) {
          const sourceType = toPrismaAudioSourceType(
            segment.sourceType ?? response.sourceType ?? request.sourceType,
          );
          const absoluteSegment = {
            content: segment.content,
            startTime: response.streamOffsetMs / 1000 + segment.startTime,
            endTime: response.streamOffsetMs / 1000 + segment.endTime,
          };
          const comparisonSourceTypes =
            resolveComparisonSourceTypes(sourceType);
          const overlappingSegments = comparisonSourceTypes.length
            ? await tx.transcriptSegment.findMany({
                where: {
                  meetingId: request.backendMeetingId,
                  isSuppressed: false,
                  id: {
                    notIn: Array.from(suppressedTranscriptSegmentIds),
                  },
                  startTime: {
                    lt: absoluteSegment.endTime,
                  },
                  endTime: {
                    gt: absoluteSegment.startTime,
                  },
                  OR: comparisonSourceTypes.map((comparisonSourceType) =>
                    comparisonSourceType === null
                      ? { sourceType: null }
                      : { sourceType: comparisonSourceType },
                  ),
                },
                select: {
                  id: true,
                  startTime: true,
                  endTime: true,
                  content: true,
                  sourceType: true,
                },
              })
            : [];
          const mergeDecision = resolveMergeDecision(
            sourceType,
            absoluteSegment,
            overlappingSegments,
          );

          if (mergeDecision.kind === "prefer-self-mic") {
            for (const existingSegmentId of mergeDecision.suppressedExistingIds) {
              suppressedTranscriptSegmentIds.add(existingSegmentId);
            }

            mergeMetrics.duplicateSuppressionCount +=
              mergeDecision.suppressedExistingIds.length +
              (mergeDecision.suppressIncoming ? 1 : 0);

            if (sourceType === "SELF_MIC" && !mergeDecision.suppressIncoming) {
              mergeMetrics.recoveredRecorderSegmentCount += 1;
            }
          }

          if (mergeDecision.kind === "ambiguous-overlap") {
            mergeMetrics.mergeConflictCount += 1;
          }

          const mergeStrategy =
            mergeDecision.kind === "persist"
              ? undefined
              : mergeDecision.kind === "ambiguous-overlap"
                ? ("AMBIGUOUS_OVERLAP" as const)
                : ("PREFERRED_SELF_MIC_DUPLICATE" as const);

          transcriptRows.push({
            meetingId: request.backendMeetingId,
            speakerId: speakerIdByLabel.get(segment.aiLabel)!,
            content: segment.content,
            sourceType,
            startTime: absoluteSegment.startTime,
            endTime: absoluteSegment.endTime,
            mergeStrategy,
            mergeSourceType:
              mergeDecision.kind === "persist"
                ? undefined
                : mergeDecision.counterpartSourceType,
            isSuppressed:
              mergeDecision.kind === "prefer-self-mic" &&
              mergeDecision.suppressIncoming,
            suppressedAt:
              mergeDecision.kind === "prefer-self-mic" &&
              mergeDecision.suppressIncoming
                ? new Date()
                : undefined,
          });
        }

        if (suppressedTranscriptSegmentIds.size > 0) {
          await tx.transcriptSegment.updateMany({
            where: {
              id: {
                in: Array.from(suppressedTranscriptSegmentIds),
              },
            },
            data: {
              isSuppressed: true,
              suppressedAt: new Date(),
              mergeStrategy: "PREFERRED_SELF_MIC_DUPLICATE",
              mergeSourceType: "SELF_MIC",
            },
          });
        }

        await tx.transcriptSegment.createMany({
          data: transcriptRows,
        });
      }

      if (speakerEvidence.length > 0) {
        await tx.meetingSpeakerSample.createMany({
          data: speakerEvidence
            .map((evidence) => {
              const speakerId = speakerIdByLabel.get(evidence.aiLabel);

              if (!speakerId) {
                return null;
              }

              return {
                speakerProfileId: speakerId,
                embedding: evidence.embedding,
                startTime: response.streamOffsetMs / 1000 + evidence.startTime,
                endTime: response.streamOffsetMs / 1000 + evidence.endTime,
                durationSeconds: evidence.durationSeconds,
                sourceType: toPrismaAudioSourceType(
                  evidence.sourceType ??
                    response.sourceType ??
                    request.sourceType,
                ),
                rmsDb: evidence.rmsDb ?? null,
                speechRatio: evidence.speechRatio ?? null,
                qualityScore: evidence.qualityScore ?? null,
                sampleRate: evidence.sampleRate ?? null,
              };
            })
            .filter((sample): sample is NonNullable<typeof sample> => sample !== null),
        });
      }

      await tx.meetingAudioBatch.update({
        where: { id: batchId },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          error: null,
        },
      });
    });

    this.meetingArtifactExtraction.notifyTranscriptPersisted(
      request.backendMeetingId,
    );

    this.logger.info("Dual-lane capture metric", {
      metric: "dual_lane_merge_reconciliation",
      meetingId: request.backendMeetingId,
      batchId,
      sourceType: response.sourceType ?? request.sourceType ?? null,
      duplicateSuppressionCount: mergeMetrics.duplicateSuppressionCount,
      mergeConflictCount: mergeMetrics.mergeConflictCount,
      recoveredRecorderSegmentCount: mergeMetrics.recoveredRecorderSegmentCount,
    });
  }
}

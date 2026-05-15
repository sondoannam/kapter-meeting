import { Injectable } from "@nestjs/common";
import type { Prisma } from "prisma/generated/prisma/client";

import { PrismaService } from "../../database/prisma.service";

const MAX_RECURRING_PROFILE_SAMPLES = 5;
const MAX_MATCH_CANDIDATE_SAMPLES = 3;
const MIN_RECURRING_PROFILE_SAMPLES = 2;
const RECURRING_HIGH_CONFIDENCE = 0.72;
const RECURRING_MARGIN_THRESHOLD = 0.05;
const RECURRING_STRONG_SUPPORT = 0.68;

type NormalizedSample = {
  embedding: Prisma.JsonValue;
  durationSeconds: number;
  qualityScore: number | null;
  rmsDb: number | null;
  speechRatio: number | null;
  sampleRate: number | null;
  sourceMeetingId: string | null;
  sourceSpeakerProfileId: string | null;
  createdAt: Date;
};

type RecurringCandidate = {
  id: string;
  meetingId: string;
  userId: string;
  recurringSpeakerProfileId: string | null;
  evidenceSamples: NormalizedSample[];
};

type ExistingRecurringProfile = {
  id: string;
  meetingCount: number;
  sampleCount: number;
  status: "CANDIDATE" | "STABLE" | "PROMOTED";
  lastSeenAt: Date;
  samples: NormalizedSample[];
};

export type MeetingSpeakerMemoryResult = {
  materialChanges: boolean;
  linkedSpeakers: number;
  createdProfiles: number;
};

const normalizeEmbedding = (embedding: unknown): number[] | null => {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return null;
  }

  const numericEmbedding = embedding.map((value) => Number(value));
  const magnitude = Math.sqrt(
    numericEmbedding.reduce((sum, value) => sum + value * value, 0),
  );

  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    return null;
  }

  return numericEmbedding.map((value) => value / magnitude);
};

const cosineSimilarity = (left: number[], right: number[]): number => {
  if (left.length !== right.length || left.length === 0) {
    return -1;
  }

  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index]! * right[index]!;
  }

  return sum;
};

const sortSamplesByQuality = <TSample extends NormalizedSample>(
  samples: TSample[],
  limit: number,
): TSample[] =>
  [...samples]
    .sort((left, right) => {
      const qualityDelta = (right.qualityScore ?? -1) - (left.qualityScore ?? -1);

      if (qualityDelta !== 0) {
        return qualityDelta;
      }

      const durationDelta = right.durationSeconds - left.durationSeconds;

      if (durationDelta !== 0) {
        return durationDelta;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    })
    .slice(0, limit);

type ProfileMatch = {
  profileId: string;
  score: number;
  supportCount: number;
};

const scoreRecurringProfileMatch = (
  candidateSamples: NormalizedSample[],
  recurringSamples: NormalizedSample[],
): { score: number; supportCount: number } | null => {
  const normalizedCandidateEmbeddings = candidateSamples
    .map((sample) => normalizeEmbedding(sample.embedding))
    .filter((embedding): embedding is number[] => embedding !== null);
  const normalizedRecurringEmbeddings = recurringSamples
    .map((sample) => normalizeEmbedding(sample.embedding))
    .filter((embedding): embedding is number[] => embedding !== null);

  if (
    normalizedCandidateEmbeddings.length < MIN_RECURRING_PROFILE_SAMPLES ||
    normalizedRecurringEmbeddings.length < MIN_RECURRING_PROFILE_SAMPLES
  ) {
    return null;
  }

  const strongestSimilarities = normalizedCandidateEmbeddings.map((embedding) =>
    Math.max(
      ...normalizedRecurringEmbeddings.map((recurringEmbedding) =>
        cosineSimilarity(embedding, recurringEmbedding),
      ),
    ),
  );

  const bestScore = Math.max(...strongestSimilarities);
  const averageScore =
    strongestSimilarities.reduce((sum, value) => sum + value, 0) /
    strongestSimilarities.length;
  const supportCount = strongestSimilarities.filter(
    (value) => value >= RECURRING_STRONG_SUPPORT,
  ).length;

  return {
    score: Number(((0.65 * bestScore) + (0.35 * averageScore)).toFixed(4)),
    supportCount,
  };
};

@Injectable()
export class MeetingSpeakerMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async linkRecurringSpeakersForMeeting(
    meetingId: string,
  ): Promise<MeetingSpeakerMemoryResult> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        userId: true,
        status: true,
        artifactReviewStatus: true,
        speakers: {
          where: {
            voiceProfileId: null,
          },
          select: {
            id: true,
            meetingId: true,
            recurringSpeakerProfileId: true,
            meeting: {
              select: {
                userId: true,
              },
            },
            evidenceSamples: {
              orderBy: {
                createdAt: "desc",
              },
              select: {
                embedding: true,
                durationSeconds: true,
                rmsDb: true,
                speechRatio: true,
                qualityScore: true,
                sampleRate: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (
      !meeting ||
      meeting.status !== "COMPLETED" ||
      meeting.artifactReviewStatus === "APPROVED"
    ) {
      return {
        materialChanges: false,
        linkedSpeakers: 0,
        createdProfiles: 0,
      };
    }

    const recurringProfiles = await this.prisma.recurringSpeakerProfile.findMany({
      where: {
        userId: meeting.userId,
        promotedVoiceProfileId: null,
      },
      select: {
        id: true,
        status: true,
        meetingCount: true,
        sampleCount: true,
        lastSeenAt: true,
        samples: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            embedding: true,
            durationSeconds: true,
            rmsDb: true,
            speechRatio: true,
            qualityScore: true,
            sampleRate: true,
            sourceMeetingId: true,
            sourceSpeakerProfileId: true,
            createdAt: true,
          },
        },
      },
    });

    const candidates: RecurringCandidate[] = meeting.speakers.map((speaker) => ({
      id: speaker.id,
      meetingId: speaker.meetingId,
      userId: speaker.meeting.userId,
      recurringSpeakerProfileId: speaker.recurringSpeakerProfileId,
      evidenceSamples: sortSamplesByQuality(
        speaker.evidenceSamples.map((sample) => ({
          ...sample,
          sourceMeetingId: meeting.id,
          sourceSpeakerProfileId: speaker.id,
        })),
        MAX_MATCH_CANDIDATE_SAMPLES,
      ),
    }));

    let linkedSpeakers = 0;
    let createdProfiles = 0;
    let materialChanges = false;

    for (const candidate of candidates) {
      if (candidate.evidenceSamples.length < MIN_RECURRING_PROFILE_SAMPLES) {
        continue;
      }

      const scoredProfiles: ProfileMatch[] = recurringProfiles
        .map((profile) => {
          const scoredMatch = scoreRecurringProfileMatch(
            candidate.evidenceSamples,
            sortSamplesByQuality(profile.samples, MAX_RECURRING_PROFILE_SAMPLES),
          );

          if (!scoredMatch) {
            return null;
          }

          return {
            profileId: profile.id,
            score: scoredMatch.score,
            supportCount: scoredMatch.supportCount,
          };
        })
        .filter((match): match is ProfileMatch => match !== null)
        .sort((left, right) => right.score - left.score);

      const bestMatch = scoredProfiles[0];
      const secondBestMatch = scoredProfiles[1];
      const hasConfidentMatch =
        bestMatch &&
        bestMatch.score >= RECURRING_HIGH_CONFIDENCE &&
        bestMatch.supportCount >= MIN_RECURRING_PROFILE_SAMPLES &&
        (!secondBestMatch ||
          bestMatch.score - secondBestMatch.score >= RECURRING_MARGIN_THRESHOLD);

      if (hasConfidentMatch && bestMatch) {
        const matchedProfile = recurringProfiles.find(
          (profile) => profile.id === bestMatch.profileId,
        );

        if (!matchedProfile) {
          continue;
        }

        const newMeetingCount = matchedProfile.meetingCount + 1;
        const hasSeenCurrentMeeting = matchedProfile.samples.some(
          (sample) => sample.sourceMeetingId === meeting.id,
        );
        const nextMeetingCount = hasSeenCurrentMeeting
          ? matchedProfile.meetingCount
          : newMeetingCount;
        const mergedSamples = sortSamplesByQuality(
          [...matchedProfile.samples, ...candidate.evidenceSamples],
          MAX_RECURRING_PROFILE_SAMPLES,
        );

        await this.prisma.$transaction(async (tx) => {
          await tx.speakerProfile.update({
            where: {
              id: candidate.id,
            },
            data: {
              recurringSpeakerProfileId: matchedProfile.id,
              recurringMatchConfidence: bestMatch.score,
              recurringMatchSeenCount: nextMeetingCount,
            },
          });

          await tx.recurringSpeakerProfile.update({
            where: {
              id: matchedProfile.id,
            },
            data: {
              status:
                nextMeetingCount >= 2 ? "STABLE" : matchedProfile.status,
              lastSeenAt: new Date(),
              meetingCount: nextMeetingCount,
            },
          });

          await tx.recurringSpeakerSample.deleteMany({
            where: {
              recurringSpeakerProfileId: matchedProfile.id,
            },
          });

          await tx.recurringSpeakerSample.createMany({
            data: mergedSamples.map((sample) => ({
              recurringSpeakerProfileId: matchedProfile.id,
              embedding: sample.embedding as Prisma.InputJsonValue,
              durationSeconds: sample.durationSeconds,
              rmsDb: sample.rmsDb,
              speechRatio: sample.speechRatio,
              qualityScore: sample.qualityScore,
              sampleRate: sample.sampleRate,
              sourceMeetingId: sample.sourceMeetingId,
              sourceSpeakerProfileId: sample.sourceSpeakerProfileId,
            })),
          });

          await tx.recurringSpeakerProfile.update({
            where: {
              id: matchedProfile.id,
            },
            data: {
              sampleCount: mergedSamples.length,
            },
          });
        });

        matchedProfile.lastSeenAt = new Date();
        matchedProfile.meetingCount = nextMeetingCount;
        matchedProfile.sampleCount = mergedSamples.length;
        matchedProfile.status =
          nextMeetingCount >= 2 ? "STABLE" : matchedProfile.status;
        matchedProfile.samples = mergedSamples;

        linkedSpeakers += 1;
        materialChanges = true;
        continue;
      }

      if (scoredProfiles.length > 1) {
        const scoreGap = scoredProfiles[0]!.score - scoredProfiles[1]!.score;
        if (
          scoredProfiles[0]!.score >= RECURRING_STRONG_SUPPORT &&
          scoreGap < RECURRING_MARGIN_THRESHOLD
        ) {
          continue;
        }
      }

      const createdProfile = await this.prisma.recurringSpeakerProfile.create({
        data: {
          userId: candidate.userId,
          status: "CANDIDATE",
          lastSeenAt: new Date(),
          meetingCount: 1,
          sampleCount: candidate.evidenceSamples.length,
          samples: {
            createMany: {
              data: candidate.evidenceSamples.map((sample) => ({
                embedding: sample.embedding as Prisma.InputJsonValue,
                durationSeconds: sample.durationSeconds,
                rmsDb: sample.rmsDb,
                speechRatio: sample.speechRatio,
                qualityScore: sample.qualityScore,
                sampleRate: sample.sampleRate,
                sourceMeetingId: sample.sourceMeetingId,
                sourceSpeakerProfileId: sample.sourceSpeakerProfileId,
              })),
            },
          },
        },
        select: {
          id: true,
          meetingCount: true,
        },
      });

      await this.prisma.speakerProfile.update({
        where: {
          id: candidate.id,
        },
        data: {
          recurringSpeakerProfileId: createdProfile.id,
          recurringMatchConfidence: 1,
          recurringMatchSeenCount: createdProfile.meetingCount,
        },
      });

      recurringProfiles.push({
        id: createdProfile.id,
        meetingCount: createdProfile.meetingCount,
        sampleCount: candidate.evidenceSamples.length,
        status: "CANDIDATE",
        lastSeenAt: new Date(),
        samples: candidate.evidenceSamples,
      });
      createdProfiles += 1;
      materialChanges = true;
    }

    return {
      materialChanges,
      linkedSpeakers,
      createdProfiles,
    };
  }
}

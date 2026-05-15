import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateVoiceProfileInput,
  VoiceProfile,
  VoiceProfileEnrollmentResponse,
  VoiceProfileSampleSummary,
} from "@kapter/contracts";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Prisma } from "prisma/generated/prisma/client";
import type { Logger } from "winston";

import { PrismaService } from "../../database/prisma.service";
import { AiWorkerClient } from "../ai-worker/ai-worker.client";

const MAX_SYNCED_VOICE_PROFILE_SAMPLES = 5;
const MAX_PROMOTED_MEETING_SAMPLES = 3;

const normalizeOptionalText = (value?: string | null): string | null => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

const voiceProfileSelect = {
  id: true,
  displayName: true,
  position: true,
  department: true,
  isActive: true,
  workerCacheStatus: true,
  workerCacheError: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      samples: true,
    },
  },
  samples: {
    orderBy: {
      createdAt: "desc",
    },
    take: MAX_SYNCED_VOICE_PROFILE_SAMPLES,
    select: {
      id: true,
      source: true,
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
} as const;

type VoiceProfileRecord = {
  id: string;
  displayName: string;
  position: string | null;
  department: string | null;
  isActive: boolean;
  workerCacheStatus: "PENDING" | "SYNCED" | "FAILED";
  workerCacheError: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    samples: number;
  };
  samples: Array<{
    id: string;
    source: "UPLOAD" | "MEETING_PROMOTION";
    durationSeconds: number;
    rmsDb: number | null;
    speechRatio: number | null;
    qualityScore: number | null;
    sampleRate: number | null;
    sourceMeetingId: string | null;
    sourceSpeakerProfileId: string | null;
    createdAt: Date;
  }>;
};

type OwnedVoiceProfileSummary = {
  id: string;
  displayName: string;
  isActive: boolean;
};

type WorkerCacheSyncSample = {
  embedding: unknown;
  qualityScore: number | null;
  durationSeconds: number;
  createdAt: Date;
};

type WorkerCacheSyncTarget = {
  id: string;
  displayName: string;
  isActive: boolean;
  samples: WorkerCacheSyncSample[];
};

export type VoiceProfileCacheRebuildResult = {
  clearedExistingCache: boolean;
  syncedProfiles: number;
  failedProfiles: number;
  skippedProfiles: number;
};

const toVoiceProfileSampleSummary = (
  sample: VoiceProfileRecord["samples"][number],
): VoiceProfileSampleSummary => ({
  id: sample.id,
  source: sample.source,
  durationSeconds: sample.durationSeconds,
  rmsDb: sample.rmsDb,
  speechRatio: sample.speechRatio,
  qualityScore: sample.qualityScore,
  sampleRate: sample.sampleRate,
  sourceMeetingId: sample.sourceMeetingId,
  sourceSpeakerProfileId: sample.sourceSpeakerProfileId,
  createdAt: sample.createdAt.toISOString(),
});

const toVoiceProfile = (voiceProfile: VoiceProfileRecord): VoiceProfile => ({
  id: voiceProfile.id,
  displayName: voiceProfile.displayName,
  position: voiceProfile.position,
  department: voiceProfile.department,
  isActive: voiceProfile.isActive,
  workerCacheStatus: voiceProfile.workerCacheStatus,
  workerCacheError: voiceProfile.workerCacheError,
  lastSyncedAt: voiceProfile.lastSyncedAt?.toISOString() ?? null,
  sampleCount: voiceProfile._count.samples,
  createdAt: voiceProfile.createdAt.toISOString(),
  updatedAt: voiceProfile.updatedAt.toISOString(),
  samples: voiceProfile.samples.map(toVoiceProfileSampleSummary),
});

const toEmbeddingVector = (value: unknown): number[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Voice embedding payload is malformed.");
  }

  return value.map((item) => Number(item));
};

const pickBestWorkerCacheEmbeddings = (
  samples: WorkerCacheSyncSample[],
): number[][] =>
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
    .slice(0, MAX_SYNCED_VOICE_PROFILE_SAMPLES)
    .map((sample) => toEmbeddingVector(sample.embedding));

@Injectable()
export class VoiceProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiWorkerClient: AiWorkerClient,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async listVoiceProfiles(clerkUserId: string): Promise<VoiceProfile[]> {
    const voiceProfiles = await this.prisma.voiceProfile.findMany({
      where: {
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: voiceProfileSelect,
    });

    return voiceProfiles.map((voiceProfile) =>
      toVoiceProfile(voiceProfile as VoiceProfileRecord),
    );
  }

  async createVoiceProfile(
    clerkUserId: string,
    input: CreateVoiceProfileInput,
  ): Promise<VoiceProfile> {
    const user = await this.prisma.user.findFirst({
      where: {
        clerkId: clerkUserId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Authenticated user was not found.");
    }

    const displayName = input.displayName.trim();

    if (!displayName) {
      throw new BadRequestException("Voice profile display name cannot be empty.");
    }

    const voiceProfile = await this.prisma.voiceProfile.create({
      data: {
        userId: user.id,
        displayName,
        position: normalizeOptionalText(input.position),
        department: normalizeOptionalText(input.department),
        isActive: input.isActive ?? true,
        workerCacheStatus: "PENDING",
      },
      select: voiceProfileSelect,
    });

    return toVoiceProfile(voiceProfile as VoiceProfileRecord);
  }

  async updateVoiceProfile(
    clerkUserId: string,
    voiceProfileId: string,
    input: Partial<CreateVoiceProfileInput>,
  ): Promise<VoiceProfile> {
    const existing = await this.prisma.voiceProfile.findFirst({
      where: {
        id: voiceProfileId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        samples: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Voice profile not found.");
    }

    const data: {
      displayName?: string;
      position?: string | null;
      department?: string | null;
      isActive?: boolean;
    } = {};

    if (typeof input.displayName === "string") {
      const displayName = input.displayName.trim();

      if (!displayName) {
        throw new BadRequestException(
          "Voice profile display name cannot be empty.",
        );
      }

      data.displayName = displayName;
    }

    if (input.position !== undefined) {
      data.position = normalizeOptionalText(input.position);
    }

    if (input.department !== undefined) {
      data.department = normalizeOptionalText(input.department);
    }

    if (typeof input.isActive === "boolean") {
      data.isActive = input.isActive;
    }

    if (Object.keys(data).length === 0) {
      return this.getVoiceProfile(clerkUserId, voiceProfileId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.voiceProfile.update({
        where: {
          id: voiceProfileId,
        },
        data: {
          ...data,
          workerCacheStatus:
            existing.samples.length > 0 ? "PENDING" : undefined,
          workerCacheError: existing.samples.length > 0 ? null : undefined,
        },
      });

      if (data.displayName) {
        await tx.speakerProfile.updateMany({
          where: {
            voiceProfileId,
          },
          data: {
            realName: data.displayName,
          },
        });
      }
    });

    if (existing.samples.length > 0) {
      await this.syncVoiceProfileToWorker(voiceProfileId);
    }

    return this.getVoiceProfile(clerkUserId, voiceProfileId);
  }

  async deleteVoiceProfile(
    clerkUserId: string,
    voiceProfileId: string,
  ): Promise<void> {
    const voiceProfile = await this.prisma.voiceProfile.findFirst({
      where: {
        id: voiceProfileId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!voiceProfile) {
      throw new NotFoundException("Voice profile not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.speakerProfile.updateMany({
        where: {
          voiceProfileId,
        },
        data: {
          voiceProfileId: null,
          realName: null,
        },
      });

      await tx.voiceProfile.delete({
        where: {
          id: voiceProfileId,
        },
      });
    });

    try {
      await this.aiWorkerClient.deleteVoiceProfileCache(voiceProfileId);
    } catch (error) {
      this.logger.error("Voice profile cache delete failed", {
        voiceProfileId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.logger.info("Voice profile deleted", {
      voiceProfileId,
      clerkUserId,
    });
  }

  async enrollVoiceProfileAudio(
    clerkUserId: string,
    voiceProfileId: string,
    file: {
      buffer: Buffer;
      mimeType: string;
    },
  ): Promise<VoiceProfileEnrollmentResponse> {
    const voiceProfile = await this.prisma.voiceProfile.findFirst({
      where: {
        id: voiceProfileId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!voiceProfile) {
      throw new NotFoundException("Voice profile not found.");
    }

    const enrollment = await this.aiWorkerClient.extractVoiceProfileEnrollment(
      file.buffer,
      file.mimeType,
    );

    const sample = await this.prisma.$transaction(async (tx) => {
      await tx.voiceProfile.update({
        where: {
          id: voiceProfileId,
        },
        data: {
          workerCacheStatus: "PENDING",
          workerCacheError: null,
        },
      });

      return tx.voiceProfileSample.create({
        data: {
          voiceProfileId,
          source: "UPLOAD",
          embedding: enrollment.embedding,
          durationSeconds: enrollment.durationSeconds,
          rmsDb: enrollment.rmsDb ?? null,
          speechRatio: enrollment.speechRatio ?? null,
          qualityScore: enrollment.qualityScore ?? null,
          sampleRate: enrollment.sampleRate ?? null,
        },
        select: {
          id: true,
          source: true,
          durationSeconds: true,
          rmsDb: true,
          speechRatio: true,
          qualityScore: true,
          sampleRate: true,
          sourceMeetingId: true,
          sourceSpeakerProfileId: true,
          createdAt: true,
        },
      });
    });

    this.logger.info("Voice profile enrollment sample stored", {
      voiceProfileId,
      clerkUserId,
      sampleId: sample.id,
      durationSeconds: sample.durationSeconds,
      qualityScore: sample.qualityScore,
    });

    await this.syncVoiceProfileToWorker(voiceProfileId);

    return {
      voiceProfile: await this.getVoiceProfile(clerkUserId, voiceProfileId),
      sample: toVoiceProfileSampleSummary(sample),
    };
  }

  async listActiveVoiceProfileIdsForUser(userId: string): Promise<string[]> {
    const voiceProfiles = await this.prisma.voiceProfile.findMany({
      where: {
        userId,
        isActive: true,
        samples: {
          some: {},
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return voiceProfiles.map((voiceProfile) => voiceProfile.id);
  }

  async getOwnedVoiceProfileSummary(
    clerkUserId: string,
    voiceProfileId: string,
  ): Promise<OwnedVoiceProfileSummary> {
    const voiceProfile = await this.prisma.voiceProfile.findFirst({
      where: {
        id: voiceProfileId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        isActive: true,
      },
    });

    if (!voiceProfile) {
      throw new NotFoundException("Voice profile not found.");
    }

    return voiceProfile;
  }

  async promoteMeetingSpeakerToVoiceProfile(
    clerkUserId: string,
    meetingId: string,
    speakerId: string,
    input: CreateVoiceProfileInput,
  ): Promise<OwnedVoiceProfileSummary> {
    const speaker = await this.prisma.speakerProfile.findFirst({
      where: {
        id: speakerId,
        meetingId,
        meeting: {
          user: {
            is: {
              clerkId: clerkUserId,
              deletedAt: null,
            },
          },
        },
      },
      select: {
        id: true,
        meetingId: true,
        meeting: {
          select: {
            userId: true,
          },
        },
        evidenceSamples: {
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
    });

    if (!speaker) {
      throw new NotFoundException("Meeting speaker not found.");
    }

    const displayName = input.displayName.trim();

    if (!displayName) {
      throw new BadRequestException("Voice profile display name cannot be empty.");
    }

    const eligibleSamples = [...speaker.evidenceSamples]
      .sort((left, right) => {
        const qualityDelta =
          (right.qualityScore ?? -1) - (left.qualityScore ?? -1);

        if (qualityDelta !== 0) {
          return qualityDelta;
        }

        const durationDelta = right.durationSeconds - left.durationSeconds;

        if (durationDelta !== 0) {
          return durationDelta;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      })
      .slice(0, MAX_PROMOTED_MEETING_SAMPLES);

    if (eligibleSamples.length === 0) {
      throw new BadRequestException(
        "This meeting speaker does not have enough enrollment-quality evidence yet.",
      );
    }

    const voiceProfile = await this.prisma.$transaction(async (tx) => {
      const createdProfile = await tx.voiceProfile.create({
        data: {
          userId: speaker.meeting.userId,
          displayName,
          position: normalizeOptionalText(input.position),
          department: normalizeOptionalText(input.department),
          isActive: input.isActive ?? true,
          workerCacheStatus: "PENDING",
        },
        select: {
          id: true,
          displayName: true,
          isActive: true,
        },
      });

      await tx.voiceProfileSample.createMany({
        data: eligibleSamples.map((sample) => ({
          voiceProfileId: createdProfile.id,
          source: "MEETING_PROMOTION",
          embedding: sample.embedding as Prisma.InputJsonValue,
          durationSeconds: sample.durationSeconds,
          rmsDb: sample.rmsDb,
          speechRatio: sample.speechRatio,
          qualityScore: sample.qualityScore,
          sampleRate: sample.sampleRate,
          sourceMeetingId: meetingId,
          sourceSpeakerProfileId: speaker.id,
        })),
      });

      return createdProfile;
    });

    this.logger.info("Meeting speaker promoted to voice profile", {
      clerkUserId,
      meetingId,
      speakerId,
      voiceProfileId: voiceProfile.id,
      promotedSampleCount: eligibleSamples.length,
    });

    await this.syncVoiceProfileToWorker(voiceProfile.id);

    return voiceProfile;
  }

  async getVoiceProfile(
    clerkUserId: string,
    voiceProfileId: string,
  ): Promise<VoiceProfile> {
    const voiceProfile = await this.prisma.voiceProfile.findFirst({
      where: {
        id: voiceProfileId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: voiceProfileSelect,
    });

    if (!voiceProfile) {
      throw new NotFoundException("Voice profile not found.");
    }

    return toVoiceProfile(voiceProfile as VoiceProfileRecord);
  }

  async rebuildWorkerCacheFromDatabase(options?: {
    clearExistingFirst?: boolean;
    reason?: string;
  }): Promise<VoiceProfileCacheRebuildResult> {
    const clearExistingFirst = options?.clearExistingFirst === true;
    const reason = options?.reason?.trim() || "manual-rebuild";

    this.logger.info("Starting voice profile worker cache rebuild", {
      clearExistingFirst,
      reason,
    });

    if (clearExistingFirst) {
      await this.aiWorkerClient.clearVoiceProfileCache();
    }

    const voiceProfiles = await this.prisma.voiceProfile.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        displayName: true,
        isActive: true,
        samples: {
          select: {
            embedding: true,
            qualityScore: true,
            durationSeconds: true,
            createdAt: true,
          },
        },
      },
    });

    const result: VoiceProfileCacheRebuildResult = {
      clearedExistingCache: clearExistingFirst,
      syncedProfiles: 0,
      failedProfiles: 0,
      skippedProfiles: 0,
    };

    for (const voiceProfile of voiceProfiles as WorkerCacheSyncTarget[]) {
      const embeddings = pickBestWorkerCacheEmbeddings(voiceProfile.samples);

      if (embeddings.length === 0) {
        await this.prisma.voiceProfile.update({
          where: {
            id: voiceProfile.id,
          },
          data: {
            workerCacheStatus: "PENDING",
            workerCacheError: null,
            lastSyncedAt: null,
          },
        });
        result.skippedProfiles += 1;
        continue;
      }

      try {
        await this.aiWorkerClient.upsertVoiceProfileCache({
          voiceProfileId: voiceProfile.id,
          displayName: voiceProfile.displayName,
          isActive: voiceProfile.isActive,
          embeddings,
        });

        await this.prisma.voiceProfile.update({
          where: {
            id: voiceProfile.id,
          },
          data: {
            workerCacheStatus: "SYNCED",
            workerCacheError: null,
            lastSyncedAt: new Date(),
          },
        });

        result.syncedProfiles += 1;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await this.prisma.voiceProfile.update({
          where: {
            id: voiceProfile.id,
          },
          data: {
            workerCacheStatus: "FAILED",
            workerCacheError: errorMessage,
          },
        });

        result.failedProfiles += 1;
        this.logger.error("Voice profile worker cache rebuild entry failed", {
          voiceProfileId: voiceProfile.id,
          reason,
          error: errorMessage,
        });
      }
    }

    this.logger.info("Completed voice profile worker cache rebuild", {
      reason,
      ...result,
    });

    return result;
  }

  async syncVoiceProfileToWorker(voiceProfileId: string): Promise<void> {
    const voiceProfile = await this.prisma.voiceProfile.findUnique({
      where: {
        id: voiceProfileId,
      },
      select: {
        id: true,
        displayName: true,
        isActive: true,
        samples: {
          select: {
            embedding: true,
            qualityScore: true,
            durationSeconds: true,
            createdAt: true,
          },
        },
      },
    });

    if (!voiceProfile) {
      throw new NotFoundException("Voice profile not found.");
    }

    const embeddings = pickBestWorkerCacheEmbeddings(voiceProfile.samples);

    if (embeddings.length === 0) {
      await this.prisma.voiceProfile.update({
        where: {
          id: voiceProfileId,
        },
        data: {
          workerCacheStatus: "PENDING",
          workerCacheError: null,
          lastSyncedAt: null,
        },
      });
      return;
    }

    try {
      await this.aiWorkerClient.upsertVoiceProfileCache({
        voiceProfileId: voiceProfile.id,
        displayName: voiceProfile.displayName,
        isActive: voiceProfile.isActive,
        embeddings,
      });

      await this.prisma.voiceProfile.update({
        where: {
          id: voiceProfileId,
        },
        data: {
          workerCacheStatus: "SYNCED",
          workerCacheError: null,
          lastSyncedAt: new Date(),
        },
      });

      this.logger.info("Voice profile worker cache synced", {
        voiceProfileId,
        embeddingCount: embeddings.length,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.voiceProfile.update({
        where: {
          id: voiceProfileId,
        },
        data: {
          workerCacheStatus: "FAILED",
          workerCacheError: errorMessage,
        },
      });

      this.logger.error("Voice profile worker cache sync failed", {
        voiceProfileId,
        error: errorMessage,
      });
    }
  }
}

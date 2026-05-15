import { Inject, Injectable } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { PrismaService } from "../../database/prisma.service";
import { MeetingSpeakerMemoryService } from "./meeting-speaker-memory.service";
import { MeetingSpeakerRepairService } from "./meeting-speaker-repair.service";

export type MeetingSpeakerPostProcessingResult = {
  materialChanges: boolean;
  linkedSpeakers: number;
  createdRecurringProfiles: number;
  repairedSegments: number;
};

@Injectable()
export class MeetingSpeakerPostProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetingSpeakerMemoryService: MeetingSpeakerMemoryService,
    private readonly meetingSpeakerRepairService: MeetingSpeakerRepairService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async runForCompletedMeeting(
    meetingId: string,
  ): Promise<MeetingSpeakerPostProcessingResult | null> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        artifactReviewStatus: true,
        speakerPostProcessStatus: true,
      },
    });

    if (
      !meeting ||
      meeting.status !== "COMPLETED" ||
      meeting.artifactReviewStatus === "APPROVED" ||
      meeting.speakerPostProcessStatus === "COMPLETED"
    ) {
      return null;
    }

    await this.prisma.meeting.update({
      where: {
        id: meetingId,
      },
      data: {
        speakerPostProcessStatus: "PROCESSING",
        speakerPostProcessError: null,
      },
    });

    try {
      const memoryResult =
        await this.meetingSpeakerMemoryService.linkRecurringSpeakersForMeeting(
          meetingId,
        );
      const repairResult =
        await this.meetingSpeakerRepairService.repairMeetingShortTurns(meetingId);

      await this.prisma.meeting.update({
        where: {
          id: meetingId,
        },
        data: {
          speakerPostProcessStatus: "COMPLETED",
          speakerPostProcessedAt: new Date(),
          speakerPostProcessError: null,
        },
      });

      const result: MeetingSpeakerPostProcessingResult = {
        materialChanges:
          memoryResult.materialChanges || repairResult.materialChanges,
        linkedSpeakers: memoryResult.linkedSpeakers,
        createdRecurringProfiles: memoryResult.createdProfiles,
        repairedSegments: repairResult.repairedSegments,
      };

      this.logger.info("Meeting speaker post-processing completed", {
        meetingId,
        ...result,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.meeting.update({
        where: {
          id: meetingId,
        },
        data: {
          speakerPostProcessStatus: "FAILED",
          speakerPostProcessError: errorMessage,
        },
      });

      this.logger.error("Meeting speaker post-processing failed", {
        meetingId,
        error: errorMessage,
      });

      throw error;
    }
  }
}

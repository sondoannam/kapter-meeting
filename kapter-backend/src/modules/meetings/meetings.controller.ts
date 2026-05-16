import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { ClerkSessionAuth } from "../clerk/clerk-auth.service";
import { CurrentUser } from "../clerk/current-user.decorator";
import { NotionService } from "../notion/notion.service";
import { CreateMeetingUploadDto } from "./dto/create-meeting-upload.dto";
import { LinkMeetingSpeakerDto } from "./dto/link-meeting-speaker.dto";
import { MeetingUploadService } from "./meeting-upload.service";
import { PromoteMeetingSpeakerDto } from "./dto/promote-meeting-speaker.dto";
import { SaveMeetingReviewDto } from "./dto/save-meeting-review.dto";
import { UpdateMeetingMetadataDto } from "./dto/update-meeting-metadata.dto";
import { MeetingsService } from "./meetings.service";

type UploadedMeetingAudioFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@ApiTags("meetings")
@ApiBearerAuth()
@Controller("meetings")
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly meetingUploadService: MeetingUploadService,
    private readonly notionService?: NotionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Return dashboard meeting history for the authenticated user",
  })
  async getMeetingHistory(@CurrentUser() currentUser: ClerkSessionAuth) {
    return {
      meetings: await this.meetingsService.listMeetingHistory(
        currentUser.userId,
      ),
    };
  }

  @Get("active")
  @ApiOperation({
    summary: "Return the authenticated user's current active dashboard meeting",
  })
  async getActiveMeetingForUser(@CurrentUser() currentUser: ClerkSessionAuth) {
    return {
      meeting: await this.meetingsService.getActiveMeeting(currentUser.userId),
    };
  }

  @Post("uploads")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({
    summary: "Upload one MP3 file and process it as a dashboard meeting",
  })
  async uploadMeetingAudioForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Body() body: CreateMeetingUploadDto,
    @UploadedFile() file?: UploadedMeetingAudioFile,
  ) {
    return {
      status: "accepted" as const,
      meeting: await this.meetingUploadService.acceptUpload(
        currentUser.userId,
        file,
        body,
      ),
    };
  }

  @Get(":meetingId")
  @ApiOperation({
    summary:
      "Return one dashboard meeting detail payload for the authenticated user",
  })
  async getMeetingDetailForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
  ) {
    return {
      meeting: await this.meetingsService.getMeetingDetail(
        currentUser.userId,
        meetingId,
      ),
    };
  }

  @Delete(":meetingId")
  @ApiOperation({
    summary: "Delete one meeting and its persisted artifacts for the authenticated user",
  })
  async deleteMeetingForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
  ) {
    await this.meetingsService.deleteMeeting(currentUser.userId, meetingId);

    return {
      deletedMeetingId: meetingId,
    };
  }

  @Patch(":meetingId")
  @ApiOperation({
    summary: "Update editable meeting metadata for the authenticated user",
  })
  async updateMeetingMetadataForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
    @Body() body: UpdateMeetingMetadataDto,
  ) {
    return {
      meeting: await this.meetingsService.updateMeetingMetadata(
        currentUser.userId,
        meetingId,
        body,
      ),
    };
  }

  @Post(":meetingId/speakers/:speakerId/link")
  @ApiOperation({
    summary: "Link one meeting speaker to an existing voice profile",
  })
  async linkMeetingSpeakerForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
    @Param("speakerId") speakerId: string,
    @Body() body: LinkMeetingSpeakerDto,
  ) {
    return {
      meeting: await this.meetingsService.linkMeetingSpeakerToVoiceProfile(
        currentUser.userId,
        meetingId,
        speakerId,
        body.voiceProfileId,
      ),
    };
  }

  @Post(":meetingId/speakers/:speakerId/promote")
  @ApiOperation({
    summary: "Promote one meeting speaker into a new voice profile",
  })
  async promoteMeetingSpeakerForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
    @Param("speakerId") speakerId: string,
    @Body() body: PromoteMeetingSpeakerDto,
  ) {
    return {
      meeting: await this.meetingsService.promoteMeetingSpeakerToVoiceProfile(
        currentUser.userId,
        meetingId,
        speakerId,
        body,
      ),
    };
  }

  @Post(":meetingId/speakers/:speakerId/clear-link")
  @ApiOperation({
    summary: "Clear the voice profile mapping for one meeting speaker",
  })
  async clearMeetingSpeakerLinkForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
    @Param("speakerId") speakerId: string,
  ) {
    return {
      meeting: await this.meetingsService.clearMeetingSpeakerVoiceProfileLink(
        currentUser.userId,
        meetingId,
        speakerId,
      ),
    };
  }

  @Patch(":meetingId/review")
  @ApiOperation({
    summary: "Save edited meeting summary and action items before approval",
  })
  async saveMeetingReviewForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
    @Body() body: SaveMeetingReviewDto,
  ) {
    return {
      meeting: await this.meetingsService.saveMeetingReview(
        currentUser.userId,
        meetingId,
        body,
      ),
    };
  }

  @Post(":meetingId/review/approve")
  @ApiOperation({
    summary:
      "Approve the current meeting artifacts and propose context updates",
  })
  async approveMeetingReviewForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
  ) {
    return {
      meeting: await this.meetingsService.approveMeetingReview(
        currentUser.userId,
        meetingId,
      ),
    };
  }

  @Post(":meetingId/notion/sync")
  @ApiOperation({
    summary: "Sync approved meeting action items to the project's Notion tasks",
  })
  async syncMeetingActionItemsToNotionForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
  ) {
    if (!this.notionService) {
      throw new BadRequestException("Notion sync is not available.");
    }

    const sync = await this.notionService.syncMeetingActionItems(
      currentUser.userId,
      meetingId,
    );

    return {
      sync,
      meeting: await this.meetingsService.getMeetingDetail(
        currentUser.userId,
        meetingId,
      ),
    };
  }

  @Post(":meetingId/extraction/retry")
  @ApiOperation({
    summary: "Retry LLM extraction for an unapproved meeting",
  })
  async retryMeetingExtractionForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
  ) {
    return {
      meeting: await this.meetingsService.retryMeetingExtraction(
        currentUser.userId,
        meetingId,
      ),
    };
  }

  @Post(":meetingId/context-proposals/:proposalId/apply")
  @ApiOperation({
    summary: "Apply a pending project context update proposal",
  })
  async applyProjectContextProposalForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
    @Param("proposalId") proposalId: string,
  ) {
    return {
      meeting: await this.meetingsService.applyProjectContextProposal(
        currentUser.userId,
        meetingId,
        proposalId,
      ),
    };
  }

  @Post(":meetingId/context-proposals/:proposalId/dismiss")
  @ApiOperation({
    summary: "Dismiss a pending project context update proposal",
  })
  async dismissProjectContextProposalForUser(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("meetingId") meetingId: string,
    @Param("proposalId") proposalId: string,
  ) {
    return {
      meeting: await this.meetingsService.dismissProjectContextProposal(
        currentUser.userId,
        meetingId,
        proposalId,
      ),
    };
  }
}

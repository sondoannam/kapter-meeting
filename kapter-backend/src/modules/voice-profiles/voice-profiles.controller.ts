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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";

import type { ClerkSessionAuth } from "../clerk/clerk-auth.service";
import { CurrentUser } from "../clerk/current-user.decorator";
import { CreateVoiceProfileDto } from "./dto/create-voice-profile.dto";
import { UpdateVoiceProfileDto } from "./dto/update-voice-profile.dto";
import { VoiceProfilesService } from "./voice-profiles.service";

type UploadedAudioFile = {
  buffer: Buffer;
  mimetype: string;
};

@ApiTags("voice-profiles")
@ApiBearerAuth()
@Controller("voice-profiles")
export class VoiceProfilesController {
  constructor(private readonly voiceProfilesService: VoiceProfilesService) {}

  @Get()
  @ApiOperation({
    summary: "Return voice profiles for the authenticated user",
  })
  async listVoiceProfiles(@CurrentUser() currentUser: ClerkSessionAuth) {
    return {
      voiceProfiles: await this.voiceProfilesService.listVoiceProfiles(
        currentUser.userId,
      ),
    };
  }

  @Post()
  @ApiOperation({
    summary: "Create a voice profile for the authenticated user",
  })
  async createVoiceProfile(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Body() body: CreateVoiceProfileDto,
  ) {
    return {
      voiceProfile: await this.voiceProfilesService.createVoiceProfile(
        currentUser.userId,
        body,
      ),
    };
  }

  @Patch(":voiceProfileId")
  @ApiOperation({
    summary: "Update a voice profile for the authenticated user",
  })
  async updateVoiceProfile(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("voiceProfileId") voiceProfileId: string,
    @Body() body: UpdateVoiceProfileDto,
  ) {
    return {
      voiceProfile: await this.voiceProfilesService.updateVoiceProfile(
        currentUser.userId,
        voiceProfileId,
        body,
      ),
    };
  }

  @Delete(":voiceProfileId")
  @ApiOperation({
    summary: "Delete a voice profile for the authenticated user",
  })
  async deleteVoiceProfile(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("voiceProfileId") voiceProfileId: string,
  ) {
    await this.voiceProfilesService.deleteVoiceProfile(
      currentUser.userId,
      voiceProfileId,
    );

    return {
      deletedVoiceProfileId: voiceProfileId,
    };
  }

  @Post(":voiceProfileId/enrollment-audio")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({
    summary: "Upload enrollment audio for one voice profile",
  })
  async uploadEnrollmentAudio(
    @CurrentUser() currentUser: ClerkSessionAuth,
    @Param("voiceProfileId") voiceProfileId: string,
    @UploadedFile() file?: UploadedAudioFile,
  ) {
    if (!file || file.buffer.length === 0) {
      throw new BadRequestException("Enrollment audio file is required.");
    }

    if (!file.mimetype.startsWith("audio/")) {
      throw new BadRequestException("Enrollment upload must be an audio file.");
    }

    return this.voiceProfilesService.enrollVoiceProfileAudio(
      currentUser.userId,
      voiceProfileId,
      {
        buffer: file.buffer,
        mimeType: file.mimetype,
      },
    );
  }
}

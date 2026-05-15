import { IsString } from "class-validator";

export class LinkMeetingSpeakerDto {
  @IsString()
  voiceProfileId!: string;
}

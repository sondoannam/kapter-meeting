import { IsOptional, IsString } from "class-validator";

export class UpdateMeetingMetadataDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  externalMeetingId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

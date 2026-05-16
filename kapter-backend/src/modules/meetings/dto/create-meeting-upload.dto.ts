import { IsOptional, IsString } from "class-validator";

export class CreateMeetingUploadDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

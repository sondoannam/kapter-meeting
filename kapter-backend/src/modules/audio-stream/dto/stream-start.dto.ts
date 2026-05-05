import { IsOptional, IsString } from "class-validator";

import type { CaptureContext } from "@kapter/contracts";

export class StreamStartDto {
  @IsString()
  streamId!: string;

  @IsOptional()
  @IsString()
  meetingId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  captureContext?: CaptureContext;
}

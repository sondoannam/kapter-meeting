import { IsInt, IsOptional, IsString, Min } from "class-validator";

import type { AudioSourceType } from "@kapter/contracts";

export class AudioChunkDto {
  @IsString()
  streamId!: string;

  @IsInt()
  @Min(0)
  sequence!: number;

  @IsString()
  mimeType!: string;

  @IsString()
  payload!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsString()
  sourceType?: AudioSourceType;
}

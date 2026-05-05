import { IsBoolean, IsOptional, IsString } from "class-validator";

export class StreamReadyDto {
  @IsString()
  streamId!: string;

  @IsOptional()
  @IsBoolean()
  degradedWithoutSelfMic?: boolean;
}

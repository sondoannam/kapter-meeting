import { IsBoolean, IsOptional, IsString } from "class-validator";

export class PromoteMeetingSpeakerDto {
  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

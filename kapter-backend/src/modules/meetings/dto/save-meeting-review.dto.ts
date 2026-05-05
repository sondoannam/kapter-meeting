import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

const ACTION_ITEM_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export class SaveMeetingReviewActionItemDto {
  @IsString()
  taskContent!: string;

  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsEnum(ACTION_ITEM_STATUSES)
  status?: (typeof ACTION_ITEM_STATUSES)[number];
}

export class SaveMeetingReviewDto {
  @IsString()
  summary!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveMeetingReviewActionItemDto)
  actionItems!: SaveMeetingReviewActionItemDto[];
}

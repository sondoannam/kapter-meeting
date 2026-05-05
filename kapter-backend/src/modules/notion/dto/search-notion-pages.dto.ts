import { IsOptional, IsString } from "class-validator";

export class SearchNotionPagesDto {
  @IsOptional()
  @IsString()
  query?: string;
}

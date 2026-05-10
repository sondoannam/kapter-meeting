import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  initialDescription?: string;

  @IsOptional()
  @IsString()
  contextMarkdown?: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

import { IsOptional, IsString } from "class-validator";

export class CreateProjectDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  initialDescription?: string;

  @IsOptional()
  @IsString()
  contextMarkdown?: string;
}

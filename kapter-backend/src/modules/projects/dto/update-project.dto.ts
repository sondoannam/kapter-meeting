import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

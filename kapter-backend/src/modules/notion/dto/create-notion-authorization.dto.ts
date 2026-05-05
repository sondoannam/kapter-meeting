import { IsOptional, IsString } from "class-validator";

export class CreateNotionAuthorizationDto {
  @IsOptional()
  @IsString()
  returnToPath?: string;
}

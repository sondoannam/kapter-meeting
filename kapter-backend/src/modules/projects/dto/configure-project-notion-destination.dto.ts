import { IsEnum, IsString } from "class-validator";

export class ConfigureProjectNotionDestinationDto {
  @IsString()
  parentPageId!: string;

  @IsEnum(["PROJECT_PAGE", "EXISTING_PAGE"])
  mode!: "PROJECT_PAGE" | "EXISTING_PAGE";
}

import { Module } from "@nestjs/common";

import { ClerkModule } from "../clerk/clerk.module";
import { NotionModule } from "../notion/notion.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [ClerkModule, NotionModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}

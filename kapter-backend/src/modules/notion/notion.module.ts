import { Module } from "@nestjs/common";

import { ClerkModule } from "../clerk/clerk.module";
import { NotionController } from "./notion.controller";
import { NotionService } from "./notion.service";

@Module({
  imports: [ClerkModule],
  controllers: [NotionController],
  providers: [NotionService],
  exports: [NotionService],
})
export class NotionModule {}

import { Module } from "@nestjs/common";

import { ClerkModule } from "../clerk/clerk.module";
import { LlmModule } from "../llm/llm.module";
import { NotionModule } from "../notion/notion.module";
import { MeetingArtifactExtractionService } from "./meeting-artifact-extraction.service";
import { MeetingsController } from "./meetings.controller";
import { MeetingsService } from "./meetings.service";
import { TranscriptPersistenceService } from "./transcript-persistence.service";

@Module({
  imports: [ClerkModule, LlmModule, NotionModule],
  controllers: [MeetingsController],
  providers: [
    MeetingsService,
    TranscriptPersistenceService,
    MeetingArtifactExtractionService,
  ],
  exports: [
    MeetingsService,
    TranscriptPersistenceService,
    MeetingArtifactExtractionService,
  ],
})
export class MeetingsModule {}

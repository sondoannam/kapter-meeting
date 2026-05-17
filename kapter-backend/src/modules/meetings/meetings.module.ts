import { Module } from "@nestjs/common";

import { AiWorkerModule } from "../ai-worker/ai-worker.module";
import { BillingModule } from "../billing/billing.module";
import { ClerkModule } from "../clerk/clerk.module";
import { LlmModule } from "../llm/llm.module";
import { NotionModule } from "../notion/notion.module";
import { StorageModule } from "../storage/storage.module";
import { VoiceProfilesModule } from "../voice-profiles/voice-profiles.module";
import { MeetingArtifactExtractionService } from "./meeting-artifact-extraction.service";
import { MeetingsController } from "./meetings.controller";
import { MeetingUploadService } from "./meeting-upload.service";
import { MeetingSpeakerMemoryService } from "./meeting-speaker-memory.service";
import { MeetingSpeakerPostProcessingService } from "./meeting-speaker-post-processing.service";
import { MeetingSpeakerRepairService } from "./meeting-speaker-repair.service";
import { MeetingsService } from "./meetings.service";
import { TranscriptPersistenceService } from "./transcript-persistence.service";

@Module({
  imports: [
    AiWorkerModule,
    BillingModule,
    ClerkModule,
    LlmModule,
    NotionModule,
    StorageModule,
    VoiceProfilesModule,
  ],
  controllers: [MeetingsController],
  providers: [
    MeetingsService,
    MeetingUploadService,
    TranscriptPersistenceService,
    MeetingArtifactExtractionService,
    MeetingSpeakerMemoryService,
    MeetingSpeakerRepairService,
    MeetingSpeakerPostProcessingService,
  ],
  exports: [
    MeetingsService,
    TranscriptPersistenceService,
    MeetingArtifactExtractionService,
    MeetingSpeakerPostProcessingService,
  ],
})
export class MeetingsModule {}

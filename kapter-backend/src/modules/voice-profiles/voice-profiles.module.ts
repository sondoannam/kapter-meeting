import { Module } from "@nestjs/common";

import { AiWorkerModule } from "../ai-worker/ai-worker.module";
import { ClerkModule } from "../clerk/clerk.module";
import { VoiceProfileCacheWarmupService } from "./voice-profile-cache-warmup.service";
import { VoiceProfilesController } from "./voice-profiles.controller";
import { VoiceProfilesService } from "./voice-profiles.service";

@Module({
  imports: [ClerkModule, AiWorkerModule],
  controllers: [VoiceProfilesController],
  providers: [VoiceProfilesService, VoiceProfileCacheWarmupService],
  exports: [VoiceProfilesService],
})
export class VoiceProfilesModule {}

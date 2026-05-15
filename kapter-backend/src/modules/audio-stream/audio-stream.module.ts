import { Module } from "@nestjs/common";

import { AiWorkerModule } from "../ai-worker/ai-worker.module";
import { BillingModule } from "../billing/billing.module";
import { ClerkModule } from "../clerk/clerk.module";
import { MeetingsModule } from "../meetings/meetings.module";
import { VoiceProfilesModule } from "../voice-profiles/voice-profiles.module";
import { STREAM_SESSION_STORE } from "./audio-stream.constants";
import { AudioStreamGateway } from "./audio-stream.gateway";
import { AudioStreamService } from "./audio-stream.service";
import { InMemoryStreamSessionStore } from "./in-memory-stream-session.store";

@Module({
  imports: [
    ClerkModule,
    MeetingsModule,
    AiWorkerModule,
    BillingModule,
    VoiceProfilesModule,
  ],
  providers: [
    AudioStreamGateway,
    AudioStreamService,
    {
      provide: STREAM_SESSION_STORE,
      useClass: InMemoryStreamSessionStore,
    },
  ],
  exports: [AudioStreamService, STREAM_SESSION_STORE],
})
export class AudioStreamModule {}

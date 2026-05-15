import { Inject, Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { VoiceProfilesService } from "./voice-profiles.service";

@Injectable()
export class VoiceProfileCacheWarmupService
  implements OnApplicationBootstrap
{
  constructor(
    private readonly voiceProfilesService: VoiceProfilesService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.KAPTER_DISABLE_VOICE_PROFILE_CACHE_WARMUP === "true") {
      return;
    }

    const timeout = setTimeout(() => {
      void this.voiceProfilesService
        .rebuildWorkerCacheFromDatabase({
          clearExistingFirst: true,
          reason: "backend-startup",
        })
        .catch((error: unknown) => {
          this.logger.warn("Voice profile cache warmup failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }, 0);

    timeout.unref?.();
  }
}

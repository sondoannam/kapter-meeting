import "reflect-metadata";

import * as dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";

import { AppModule } from "../src/app.module";
import { VoiceProfilesService } from "../src/modules/voice-profiles/voice-profiles.service";

const main = async (): Promise<void> => {
  dotenv.config({ path: ".env" });
  dotenv.config({ path: "kapter-backend/.env" });

  const directUrl = process.env.DIRECT_URL?.trim();
  if (directUrl) {
    process.env.DATABASE_URL = directUrl;
  }

  process.env.KAPTER_DISABLE_VOICE_PROFILE_CACHE_WARMUP = "true";

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  try {
    const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
    app.useLogger(logger);

    const voiceProfilesService = app.get(VoiceProfilesService);
    const result = await voiceProfilesService.rebuildWorkerCacheFromDatabase({
      clearExistingFirst: true,
      reason: "manual-maintenance-script",
    });

    logger.log("Voice profile worker cache rebuild finished", result);
  } finally {
    await app.close();
  }
};

void main().catch((error: unknown) => {
  console.error("Voice profile worker cache rebuild failed:", error);
  process.exitCode = 1;
});

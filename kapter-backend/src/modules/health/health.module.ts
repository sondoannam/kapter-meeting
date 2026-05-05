import { Module } from "@nestjs/common";

import { AiWorkerModule } from "../ai-worker/ai-worker.module";
import { ClerkModule } from "../clerk/clerk.module";
import { LlmModule } from "../llm/llm.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  imports: [ClerkModule, AiWorkerModule, LlmModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}

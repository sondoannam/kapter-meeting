import { Module } from "@nestjs/common";

import { ClerkModule } from "../clerk/clerk.module";
import { AiWorkerClient } from "./ai-worker.client";

@Module({
  imports: [ClerkModule],
  providers: [AiWorkerClient],
  exports: [AiWorkerClient],
})
export class AiWorkerModule {}

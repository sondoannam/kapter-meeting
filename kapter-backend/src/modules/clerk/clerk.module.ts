import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { PrismaService } from "../../database/prisma.service";
import { ClerkAuthService } from "./clerk-auth.service";
import { ClerkAuthGuard } from "./clerk-auth.guard";
import { ClerkController } from "./clerk.controller";
import { ClerkLocalUserService } from "./clerk-local-user.service";
import { ClerkSessionController } from "./clerk-session.controller";
import { ClerkWebhookService } from "./clerk-webhook.service";

@Module({
  controllers: [ClerkController, ClerkSessionController],
  providers: [
    PrismaService,
    ClerkLocalUserService,
    ClerkAuthService,
    ClerkWebhookService,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
  exports: [ClerkAuthService, ClerkLocalUserService, PrismaService],
})
export class ClerkModule {}

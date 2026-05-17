import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { appConfig } from "src/config/app.config";
import {
  ClerkLocalUserService,
  type SyncedLocalUser,
} from "./clerk-local-user.service";
import {
  normalizeClerkUserRecord,
  type ClerkApiUserLike,
} from "./clerk-user.mapper";

export interface ClerkSessionAuth {
  userId: string;
  sessionId: string | null;
  authorizedParty: string | null;
  claims: Record<string, unknown>;
}

type ClerkHydrationError = {
  errors?: unknown;
};

@Injectable()
export class ClerkAuthService {
  private readonly clerkClient;

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly clerkLocalUserService: ClerkLocalUserService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {
    this.clerkClient = createClerkClient({
      secretKey: this.config.clerk.secretKey,
    });
  }

  async verifySessionToken(token: string): Promise<ClerkSessionAuth> {
    const verifiedToken = await verifyToken(token, {
      secretKey: this.config.clerk.secretKey,
      jwtKey: this.config.clerk.jwtKey,
      authorizedParties:
        this.config.clerk.authorizedParties.length > 0
          ? this.config.clerk.authorizedParties
          : undefined,
    });

    const userId =
      typeof verifiedToken.sub === "string" ? verifiedToken.sub : undefined;

    if (!userId) {
      throw new UnauthorizedException(
        "Verified Clerk session token is missing a subject claim.",
      );
    }

    return {
      userId,
      sessionId:
        typeof verifiedToken.sid === "string" ? verifiedToken.sid : null,
      authorizedParty:
        typeof verifiedToken.azp === "string" ? verifiedToken.azp : null,
      claims: verifiedToken,
    };
  }

  async getOrSyncLocalUser(clerkUserId: string): Promise<SyncedLocalUser> {
    const existingUser =
      await this.clerkLocalUserService.findActiveByClerkId(clerkUserId);

    if (existingUser) {
      return existingUser;
    }

    try {
      const clerkUser = (await this.clerkClient.users.getUser(
        clerkUserId,
      )) as ClerkApiUserLike;

      const syncedUser = await this.clerkLocalUserService.syncNormalizedUser(
        normalizeClerkUserRecord(clerkUser),
      );

      if (!syncedUser) {
        throw new UnauthorizedException(
          "Authenticated Clerk user could not be synchronized locally.",
        );
      }

      this.logger.info("Hydrated missing local user from Clerk", {
        clerkUserId,
        userId: syncedUser.id,
      });

      return syncedUser;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const details =
        error && typeof error === "object" && "errors" in error
          ? JSON.stringify((error as ClerkHydrationError).errors)
          : "";

      this.logger.warn("Failed to hydrate missing local user from Clerk", {
        clerkUserId,
        message,
        details,
      });

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        "Authenticated Clerk user could not be synchronized locally.",
      );
    }
  }
}

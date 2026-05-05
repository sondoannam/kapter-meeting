import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { ClerkSessionAuth } from "./clerk-auth.service";
import type { SyncedLocalUser } from "./clerk-local-user.service";
import { ClerkAuthService } from "./clerk-auth.service";
import { extractSessionTokenFromHttpRequest } from "./clerk-http-auth";
import { IS_PUBLIC_ROUTE } from "./public.decorator";

type AuthenticatedRequest = Request & {
  auth?: ClerkSessionAuth;
  localUser?: SyncedLocalUser;
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clerkAuthService: ClerkAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<"http" | "ws">() !== "http") {
      return true;
    }

    const isPublicRoute = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublicRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = extractSessionTokenFromHttpRequest(request);

    if (!sessionToken) {
      throw new UnauthorizedException("Missing Clerk session token.");
    }

    request.auth = await this.clerkAuthService.verifySessionToken(sessionToken);
    request.localUser = await this.clerkAuthService.getOrSyncLocalUser(
      request.auth.userId,
    );

    return true;
  }
}

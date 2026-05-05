import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { ClerkSessionAuth } from "./clerk-auth.service";

type AuthenticatedRequest = Request & {
  auth?: ClerkSessionAuth;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClerkSessionAuth | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.auth;
  },
);

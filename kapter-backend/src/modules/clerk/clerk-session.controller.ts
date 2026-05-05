import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "../../database/prisma.service";
import type { ClerkSessionAuth } from "./clerk-auth.service";
import { CurrentUser } from "./current-user.decorator";

@ApiTags("auth")
@ApiBearerAuth()
@Controller("auth")
export class ClerkSessionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  @ApiOperation({
    summary: "Return the authenticated Clerk session and synced local user",
  })
  async getCurrentUser(@CurrentUser() currentUser: ClerkSessionAuth) {
    const user = await this.prisma.user.findUnique({
      where: {
        clerkId: currentUser.userId,
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        name: true,
        imageUrl: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      auth: {
        clerkUserId: currentUser.userId,
        sessionId: currentUser.sessionId,
        authorizedParty: currentUser.authorizedParty,
      },
      user,
    };
  }
}

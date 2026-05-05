import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { PrismaService } from "src/database/prisma.service";

import type { NormalizedClerkUser } from "./clerk-user.mapper";

export interface SyncedLocalUser {
  id: string;
  clerkId: string | null;
  email: string;
  name: string | null;
  imageUrl: string | null;
}

const syncedLocalUserSelect = {
  id: true,
  clerkId: true,
  email: true,
  name: true,
  imageUrl: true,
} as const;

@Injectable()
export class ClerkLocalUserService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async findActiveByClerkId(clerkId: string): Promise<SyncedLocalUser | null> {
    return await this.prisma.user.findFirst({
      where: {
        clerkId,
        deletedAt: null,
      },
      select: syncedLocalUserSelect,
    });
  }

  async syncNormalizedUser(
    normalizedUser: NormalizedClerkUser,
  ): Promise<SyncedLocalUser | null> {
    if (normalizedUser.deleted) {
      return await this.syncDeletedUser(normalizedUser);
    }

    const existingByClerkId = await this.prisma.user.findUnique({
      where: { clerkId: normalizedUser.clerkId },
    });

    if (existingByClerkId) {
      await this.prisma.user.update({
        where: { id: existingByClerkId.id },
        data: {
          email: normalizedUser.email,
          name: normalizedUser.name,
          imageUrl: normalizedUser.imageUrl,
          deletedAt: null,
        },
      });

      this.logger.info("Updated existing Clerk-linked user", {
        clerkId: normalizedUser.clerkId,
        userId: existingByClerkId.id,
      });

      return await this.findActiveByClerkId(normalizedUser.clerkId);
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: normalizedUser.email },
    });

    if (existingByEmail) {
      if (
        existingByEmail.clerkId &&
        existingByEmail.clerkId !== normalizedUser.clerkId
      ) {
        throw new ConflictException(
          `Email ${normalizedUser.email} is already linked to a different Clerk user.`,
        );
      }

      await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          clerkId: normalizedUser.clerkId,
          name: normalizedUser.name,
          imageUrl: normalizedUser.imageUrl,
          deletedAt: null,
        },
      });

      this.logger.info("Linked existing user record to Clerk identity", {
        clerkId: normalizedUser.clerkId,
        userId: existingByEmail.id,
      });

      return await this.findActiveByClerkId(normalizedUser.clerkId);
    }

    const createdUser = await this.prisma.user.create({
      data: {
        clerkId: normalizedUser.clerkId,
        email: normalizedUser.email,
        name: normalizedUser.name,
        imageUrl: normalizedUser.imageUrl,
        deletedAt: null,
      },
      select: syncedLocalUserSelect,
    });

    this.logger.info("Created new user from Clerk webhook sync", {
      clerkId: normalizedUser.clerkId,
      userId: createdUser.id,
    });

    return createdUser;
  }

  private async syncDeletedUser(
    normalizedUser: NormalizedClerkUser,
  ): Promise<null> {
    const existingByClerkId = await this.prisma.user.findUnique({
      where: { clerkId: normalizedUser.clerkId },
    });

    if (!existingByClerkId) {
      this.logger.debug(
        "Ignoring Clerk delete webhook for unknown local user",
        {
          clerkId: normalizedUser.clerkId,
        },
      );
      return null;
    }

    await this.prisma.user.update({
      where: { id: existingByClerkId.id },
      data: {
        email: normalizedUser.email,
        name: normalizedUser.name,
        imageUrl: normalizedUser.imageUrl,
        deletedAt: new Date(),
      },
    });

    this.logger.info("Synced deleted Clerk user into the database", {
      clerkId: normalizedUser.clerkId,
      userId: existingByClerkId.id,
    });

    return null;
  }
}

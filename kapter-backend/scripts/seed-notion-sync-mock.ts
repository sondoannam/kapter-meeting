import * as dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/prisma/client";

type SeedTargetUser = {
  id: string;
  clerkId: string | null;
  email: string;
  name: string | null;
  NotionConnection: {
    workspaceName: string | null;
    workspaceId: string;
  } | null;
};

const loadEnvironment = (): void => {
  dotenv.config({ path: ".env" });

  if (!process.env.DATABASE_URL) {
    dotenv.config({ path: "kapter-backend/.env" });
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in kapter-backend/.env or export it before running the script.",
    );
  }
};

const getArgValue = (name: string): string | null => {
  const prefix = `--${name}=`;
  const rawValue = process.argv.find((arg) => arg.startsWith(prefix));

  return rawValue ? rawValue.slice(prefix.length).trim() : null;
};

const normalizeBaseUrl = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const getBackendBaseUrl = (): string => {
  const configuredBaseUrl = process.env.BACKEND_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  return `http://localhost:${process.env.PORT?.trim() || "3001"}`;
};

const selectTargetUser = async (
  prisma: PrismaClient,
): Promise<SeedTargetUser> => {
  const clerkId = getArgValue("clerk-id");
  const email = getArgValue("email");

  if (clerkId || email) {
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        ...(clerkId ? { clerkId } : {}),
        ...(email ? { email } : {}),
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        name: true,
        NotionConnection: {
          select: {
            workspaceId: true,
            workspaceName: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error(
        `No active user found for ${clerkId ? `clerk-id=${clerkId}` : `email=${email}`}.`,
      );
    }

    return user;
  }

  const userWithNotion = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      NotionConnection: {
        isNot: null,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      clerkId: true,
      email: true,
      name: true,
      NotionConnection: {
        select: {
          workspaceId: true,
          workspaceName: true,
        },
      },
    },
  });

  if (userWithNotion) {
    return userWithNotion;
  }

  const fallbackUser = await prisma.user.findFirst({
    where: {
      deletedAt: null,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      clerkId: true,
      email: true,
      name: true,
      NotionConnection: {
        select: {
          workspaceId: true,
          workspaceName: true,
        },
      },
    },
  });

  if (!fallbackUser) {
    throw new Error(
      "No active local user exists. Sign in through the webapp or call GET /api/auth/me once before seeding mock data.",
    );
  }

  return fallbackUser;
};

const main = async (): Promise<void> => {
  loadEnvironment();

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await selectTargetUser(prisma);
    const now = new Date();
    const deadline = new Date(now);
    const backendBaseUrl = getBackendBaseUrl();
    deadline.setDate(deadline.getDate() + 7);

    const project = await prisma.project.create({
      data: {
        title: `Postman Notion Sync Test ${now.toISOString()}`,
        description:
          "Mock project generated locally to verify approved Kapter action items sync into Notion.",
        isDraft: false,
        userId: user.id,
        context: {
          create: {
            initialDescription:
              "Seeded project for Notion sync verification.",
            contextMarkdown:
              "- This project exists only to test the Notion sync endpoint from Postman.",
          },
        },
      },
    });

    const meeting = await prisma.meeting.create({
      data: {
        title: `Postman Notion Sync Mock Meeting ${now.toISOString()}`,
        description:
          "Approved mock meeting with unsynced action items for Notion sync testing.",
        status: "COMPLETED",
        artifactReviewStatus: "APPROVED",
        artifactApprovedAt: now,
        summary:
          "The team reviewed attendance follow-ups and approved tasks for Notion sync testing.",
        externalMeetingId: `mock-notion-sync-${now.getTime()}`,
        userId: user.id,
        projectId: project.id,
      },
      select: {
        id: true,
        title: true,
        artifactReviewStatus: true,
      },
    });

    const speaker = await prisma.speakerProfile.create({
      data: {
        aiLabel: "SPEAKER_00",
        realName: user.name || user.email,
        meetingId: meeting.id,
      },
    });

    await prisma.transcriptSegment.create({
      data: {
        meetingId: meeting.id,
        speakerId: speaker.id,
        startTime: 0,
        endTime: 8,
        content:
          "Let's verify that approved Kapter action items can sync to Notion.",
      },
    });

    const actionItems = await Promise.all([
      prisma.actionItem.create({
        data: {
          meetingId: meeting.id,
          assigneeId: speaker.id,
          taskContent:
            "Create the first Postman-seeded Kapter task in Notion.",
          deadline,
          status: "TODO",
          isSynced: false,
        },
        select: {
          id: true,
          taskContent: true,
        },
      }),
      prisma.actionItem.create({
        data: {
          meetingId: meeting.id,
          assigneeId: speaker.id,
          taskContent:
            "Confirm synced Kapter tasks show assignee, status, deadline, and source meeting.",
          status: "IN_PROGRESS",
          isSynced: false,
        },
        select: {
          id: true,
          taskContent: true,
        },
      }),
    ]);

    console.log("Created Notion sync mock data.");
    console.log(
      JSON.stringify(
        {
          user: {
            id: user.id,
            clerkId: user.clerkId,
            email: user.email,
            notionConnected: Boolean(user.NotionConnection),
            notionWorkspace:
              user.NotionConnection?.workspaceName ??
              user.NotionConnection?.workspaceId ??
              null,
          },
          project: {
            id: project.id,
            title: project.title,
          },
          meeting: {
            id: meeting.id,
            title: meeting.title,
            artifactReviewStatus: meeting.artifactReviewStatus,
          },
          actionItems,
          postman: {
            method: "POST",
            url: `${backendBaseUrl}/api/meetings/${meeting.id}/notion/sync`,
            authorization: "Bearer <Clerk session token for the user above>",
            body: "No JSON body required.",
          },
        },
        null,
        2,
      ),
    );

    if (!user.NotionConnection) {
      console.warn(
        "Warning: this user has no NotionConnection. Connect Notion for this Clerk user before calling the sync endpoint.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
};

void main().catch((error: unknown) => {
  console.error("Failed to seed Notion sync mock data:", error);
  process.exitCode = 1;
});

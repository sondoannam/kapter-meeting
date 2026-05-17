import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateProjectInput,
  DashboardProjectDetail as ProjectDetail,
  DashboardProjectSummary as ProjectSummary,
  MeetingStatus,
  NotionProjectDestinationMode,
  UpdateProjectInput,
} from "@kapter/contracts";

import { PrismaService } from "src/database/prisma.service";
import { MeetingMediaStorageService } from "../storage/meeting-media-storage.service";

const normalizeOptionalText = (value?: string | null): string | null => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

const projectSummarySelect = {
  id: true,
  title: true,
  description: true,
  isDraft: true,
  notionDestinationMode: true,
  notionProjectPageId: true,
  notionTaskDatabaseId: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      meetings: true,
    },
  },
} as const;

const projectDetailSelect = {
  ...projectSummarySelect,
  context: {
    select: {
      initialDescription: true,
      contextMarkdown: true,
    },
  },
  meetings: {
    orderBy: {
      updatedAt: "desc",
    },
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      externalMeetingId: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const toProjectSummary = (project: {
  id: string;
  title: string;
  description: string | null;
  isDraft: boolean;
  notionDestinationMode: string | null;
  notionProjectPageId: string | null;
  notionTaskDatabaseId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    meetings: number;
  };
}): ProjectSummary => ({
  id: project.id,
  title: project.title,
  description: project.description,
  isDraft: project.isDraft,
  notionDestinationMode:
    project.notionDestinationMode as NotionProjectDestinationMode | null,
  notionProjectPageId: project.notionProjectPageId,
  notionTaskDatabaseId: project.notionTaskDatabaseId,
  meetingCount: project._count.meetings,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
});

const toProjectDetail = (project: {
  id: string;
  title: string;
  description: string | null;
  isDraft: boolean;
  notionDestinationMode: string | null;
  notionProjectPageId: string | null;
  notionTaskDatabaseId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    meetings: number;
  };
  context: {
    initialDescription: string | null;
    contextMarkdown: string | null;
  } | null;
  meetings: Array<{
    id: string;
    title: string;
    status: string;
    externalMeetingId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): ProjectDetail => ({
  ...toProjectSummary(project),
  context: project.context,
  recentMeetings: project.meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    status: meeting.status as MeetingStatus,
    externalMeetingId: meeting.externalMeetingId,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
  })),
});

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetingMediaStorage: MeetingMediaStorageService,
  ) {}

  async listProjects(clerkUserId: string): Promise<ProjectSummary[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: projectSummarySelect,
    });

    return projects.map(toProjectSummary);
  }

  async createProject(
    clerkUserId: string,
    input: CreateProjectInput,
  ): Promise<ProjectDetail> {
    const initialDescription = normalizeOptionalText(input.initialDescription);
    const contextMarkdown = normalizeOptionalText(input.contextMarkdown);

    const project = await this.prisma.project.create({
      data: {
        title: input.title.trim(),
        description: normalizeOptionalText(input.description),
        isDraft: false,
        user: {
          connect: {
            clerkId: clerkUserId,
          },
        },
        ...(initialDescription || contextMarkdown
          ? {
              context: {
                create: {
                  initialDescription,
                  contextMarkdown,
                },
              },
            }
          : {}),
      },
      select: projectDetailSelect,
    });

    return toProjectDetail(project);
  }

  async getProjectDetail(
    clerkUserId: string,
    projectId: string,
  ): Promise<ProjectDetail> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: projectDetailSelect,
    });

    if (!project) {
      throw new NotFoundException(
        `Project ${projectId} was not found for the current user.`,
      );
    }

    return toProjectDetail(project);
  }

  async updateProject(
    clerkUserId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectDetail> {
    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        context: {
          select: {
            initialDescription: true,
            contextMarkdown: true,
          },
        },
      },
    });

    if (!existingProject) {
      throw new NotFoundException(
        `Project ${projectId} was not found for the current user.`,
      );
    }

    const data: {
      title?: string;
      description?: string | null;
      isDraft?: boolean;
    } = {};

    if (typeof input.title === "string") {
      const trimmedTitle = input.title.trim();
      if (trimmedTitle) {
        data.title = trimmedTitle;
      }
    }
    if (input.description !== undefined) {
      data.description = normalizeOptionalText(input.description);
    }

    if (typeof input.isDraft === "boolean") {
      data.isDraft = input.isDraft;
    }

    const hasContextUpdate =
      input.initialDescription !== undefined ||
      input.contextMarkdown !== undefined;

    if (hasContextUpdate) {
      const nextInitialDescription =
        input.initialDescription !== undefined
          ? normalizeOptionalText(input.initialDescription)
          : (existingProject.context?.initialDescription ?? null);
      const nextContextMarkdown =
        input.contextMarkdown !== undefined
          ? normalizeOptionalText(input.contextMarkdown)
          : (existingProject.context?.contextMarkdown ?? null);

      await this.prisma.projectContext.upsert({
        where: {
          projectId: existingProject.id,
        },
        create: {
          projectId: existingProject.id,
          initialDescription: nextInitialDescription,
          contextMarkdown: nextContextMarkdown,
        },
        update: {
          initialDescription: nextInitialDescription,
          contextMarkdown: nextContextMarkdown,
        },
      });
    }

    const project = await this.prisma.project.update({
      where: {
        id: existingProject.id,
      },
      data,
      select: projectDetailSelect,
    });

    return toProjectDetail(project);
  }

  async deleteProject(clerkUserId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        user: {
          is: {
            clerkId: clerkUserId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project ${projectId} was not found for the current user.`,
      );
    }

    const linkedMeetings = await this.prisma.meeting.findMany({
      where: {
        projectId: project.id,
      },
      select: {
        audioUrl: true,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.meeting.deleteMany({
        where: {
          projectId: project.id,
        },
      });

      await tx.project.delete({
        where: {
          id: project.id,
        },
      });
    });

    for (const meeting of linkedMeetings) {
      if (!meeting.audioUrl) {
        continue;
      }

      await this.meetingMediaStorage.deleteMeetingAudio(meeting.audioUrl);
    }
  }
}

import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { NotFoundException } from "@nestjs/common";

import { ProjectsService } from "./projects.service";

const createService = () => {
  const findMany = mock.fn(async () => []);
  const findFirst = mock.fn(async () => null);
  const create = mock.fn(async () => undefined);
  const update = mock.fn(async () => undefined);

  const prisma = {
    project: {
      findMany,
      findFirst,
      create,
      update,
    },
  };

  const service = new ProjectsService(prisma as never);

  return {
    service,
    project: {
      findMany,
      findFirst,
      create,
      update,
    },
  };
};

void describe("ProjectsService", () => {
  void it("lists dashboard project summaries for the current Clerk user", async () => {
    const { service, project } = createService();

    project.findMany.mock.mockImplementation(async () => [
      {
        id: "project_2",
        title: "Platform Revamp",
        description: "Q2 planning",
        isDraft: false,
        notionDestinationMode: null,
        notionProjectPageId: null,
        notionTaskDatabaseId: null,
        createdAt: new Date("2026-04-25T09:00:00.000Z"),
        updatedAt: new Date("2026-04-25T10:00:00.000Z"),
        _count: {
          meetings: 3,
        },
      },
    ]);

    const projects = await service.listProjects("clerk_user_1");

    assert.equal(project.findMany.mock.callCount(), 1);
    assert.deepEqual(projects, [
      {
        id: "project_2",
        title: "Platform Revamp",
        description: "Q2 planning",
        isDraft: false,
        notionDestinationMode: null,
        notionProjectPageId: null,
        notionTaskDatabaseId: null,
        meetingCount: 3,
        createdAt: "2026-04-25T09:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
    ]);
  });

  void it("creates a project with optional context seed data", async () => {
    const { service, project } = createService();

    project.create.mock.mockImplementation(async () => ({
      id: "project_1",
      title: "Platform Revamp",
      description: "Q2 planning",
      isDraft: false,
      notionDestinationMode: null,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      createdAt: new Date("2026-04-25T09:00:00.000Z"),
      updatedAt: new Date("2026-04-25T09:00:00.000Z"),
      _count: {
        meetings: 0,
      },
      context: {
        initialDescription: "Initial scope",
        contextMarkdown: "# Context",
      },
      meetings: [],
    }));

    const createdProject = await service.createProject("clerk_user_1", {
      title: "  Platform Revamp ",
      description: " Q2 planning ",
      initialDescription: " Initial scope ",
      contextMarkdown: " # Context ",
    });

    assert.equal(project.create.mock.callCount(), 1);
    assert.deepEqual(project.create.mock.calls[0]?.arguments[0], {
      data: {
        title: "Platform Revamp",
        description: "Q2 planning",
        isDraft: false,
        user: {
          connect: {
            clerkId: "clerk_user_1",
          },
        },
        context: {
          create: {
            initialDescription: "Initial scope",
            contextMarkdown: "# Context",
          },
        },
      },
      select: {
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
      },
    });
    assert.deepEqual(createdProject, {
      id: "project_1",
      title: "Platform Revamp",
      description: "Q2 planning",
      isDraft: false,
      notionDestinationMode: null,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      meetingCount: 0,
      createdAt: "2026-04-25T09:00:00.000Z",
      updatedAt: "2026-04-25T09:00:00.000Z",
      context: {
        initialDescription: "Initial scope",
        contextMarkdown: "# Context",
      },
      recentMeetings: [],
    });
  });

  void it("returns project detail for the current Clerk user", async () => {
    const { service, project } = createService();

    project.findFirst.mock.mockImplementation(async () => ({
      id: "project_1",
      title: "Platform Revamp",
      description: "Q2 planning",
      isDraft: true,
      notionDestinationMode: null,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      createdAt: new Date("2026-04-25T09:00:00.000Z"),
      updatedAt: new Date("2026-04-25T10:00:00.000Z"),
      _count: {
        meetings: 1,
      },
      context: {
        initialDescription: "Initial scope",
        contextMarkdown: "# Context",
      },
      meetings: [
        {
          id: "meeting_1",
          title: "Kickoff",
          status: "COMPLETED",
          externalMeetingId: null,
          createdAt: new Date("2026-04-25T09:30:00.000Z"),
          updatedAt: new Date("2026-04-25T09:45:00.000Z"),
        },
      ],
    }));

    const projectDetail = await service.getProjectDetail(
      "clerk_user_1",
      "project_1",
    );

    assert.equal(project.findFirst.mock.callCount(), 1);
    assert.deepEqual(projectDetail, {
      id: "project_1",
      title: "Platform Revamp",
      description: "Q2 planning",
      isDraft: true,
      notionDestinationMode: null,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      meetingCount: 1,
      createdAt: "2026-04-25T09:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
      context: {
        initialDescription: "Initial scope",
        contextMarkdown: "# Context",
      },
      recentMeetings: [
        {
          id: "meeting_1",
          title: "Kickoff",
          status: "COMPLETED",
          externalMeetingId: null,
          createdAt: "2026-04-25T09:30:00.000Z",
          updatedAt: "2026-04-25T09:45:00.000Z",
        },
      ],
    });
  });

  void it("updates a project owned by the current Clerk user", async () => {
    const { service, project } = createService();

    project.findFirst.mock.mockImplementation(async () => ({
      id: "project_1",
      title: "Platform Revamp",
      description: "Q2 planning",
      isDraft: true,
      notionDestinationMode: null,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      createdAt: new Date("2026-04-25T09:00:00.000Z"),
      updatedAt: new Date("2026-04-25T10:00:00.000Z"),
      _count: {
        meetings: 0,
      },
      context: null,
      meetings: [],
    }));

    project.update.mock.mockImplementation(async () => ({
      id: "project_1",
      title: "Platform Revamp Final",
      description: "Finalized scope",
      isDraft: false,
      notionDestinationMode: null,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      createdAt: new Date("2026-04-25T09:00:00.000Z"),
      updatedAt: new Date("2026-04-25T10:30:00.000Z"),
      _count: {
        meetings: 0,
      },
      context: null,
      meetings: [],
    }));

    const updatedProject = await service.updateProject(
      "clerk_user_1",
      "project_1",
      {
        title: " Platform Revamp Final ",
        description: " Finalized scope ",
        isDraft: false,
      },
    );

    assert.equal(project.findFirst.mock.callCount(), 1);
    assert.equal(project.update.mock.callCount(), 1);
    assert.deepEqual(updatedProject, {
      id: "project_1",
      title: "Platform Revamp Final",
      description: "Finalized scope",
      isDraft: false,
      notionDestinationMode: null,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      meetingCount: 0,
      createdAt: "2026-04-25T09:00:00.000Z",
      updatedAt: "2026-04-25T10:30:00.000Z",
      context: null,
      recentMeetings: [],
    });
  });

  void it("throws when the requested project does not belong to the current Clerk user", async () => {
    const { service } = createService();

    await assert.rejects(
      () => service.getProjectDetail("clerk_user_1", "missing_project"),
      NotFoundException,
    );
  });
});

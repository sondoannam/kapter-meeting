import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { ProjectsController } from "./projects.controller";

void describe("ProjectsController", () => {
  void it("returns project summaries for the current Clerk user", async () => {
    const listProjects = mock.fn(async () => [
      {
        id: "project_1",
        title: "Platform Revamp",
        description: "Q2 planning",
        isDraft: false,
        notionProjectPageId: null,
        notionTaskDatabaseId: null,
        meetingCount: 2,
        createdAt: "2026-04-25T09:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
    ]);

    const controller = new ProjectsController(
      {
        listProjects,
        createProject: mock.fn(async () => undefined),
        getProjectDetail: mock.fn(async () => undefined),
        updateProject: mock.fn(async () => undefined),
      } as never,
      {
        configureProjectDestination: mock.fn(async () => undefined),
        clearProjectDestination: mock.fn(async () => undefined),
      } as never,
    );

    const response = await controller.getProjectsForUser({
      userId: "clerk_user_1",
      sessionId: null,
      authorizedParty: null,
      claims: {},
    });

    assert.equal(listProjects.mock.callCount(), 1);
    assert.deepEqual(listProjects.mock.calls[0]?.arguments, ["clerk_user_1"]);
    assert.deepEqual(response, {
      projects: [
        {
          id: "project_1",
          title: "Platform Revamp",
          description: "Q2 planning",
          isDraft: false,
          notionProjectPageId: null,
          notionTaskDatabaseId: null,
          meetingCount: 2,
          createdAt: "2026-04-25T09:00:00.000Z",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      ],
    });
  });

  void it("creates a project for the current Clerk user", async () => {
    const createProject = mock.fn(async () => ({
      id: "project_1",
      title: "Platform Revamp",
      description: "Q2 planning",
      isDraft: false,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      meetingCount: 0,
      createdAt: "2026-04-25T09:00:00.000Z",
      updatedAt: "2026-04-25T09:00:00.000Z",
      context: null,
      recentMeetings: [],
    }));

    const controller = new ProjectsController(
      {
        listProjects: mock.fn(async () => []),
        createProject,
        getProjectDetail: mock.fn(async () => undefined),
        updateProject: mock.fn(async () => undefined),
      } as never,
      {
        configureProjectDestination: mock.fn(async () => undefined),
        clearProjectDestination: mock.fn(async () => undefined),
      } as never,
    );

    const response = await controller.createProjectForUser(
      {
        userId: "clerk_user_1",
        sessionId: null,
        authorizedParty: null,
        claims: {},
      },
      {
        title: "Platform Revamp",
        description: "Q2 planning",
      },
    );

    assert.equal(createProject.mock.callCount(), 1);
    assert.deepEqual(createProject.mock.calls[0]?.arguments, [
      "clerk_user_1",
      {
        title: "Platform Revamp",
        description: "Q2 planning",
      },
    ]);
    assert.deepEqual(response, {
      project: {
        id: "project_1",
        title: "Platform Revamp",
        description: "Q2 planning",
        isDraft: false,
        notionProjectPageId: null,
        notionTaskDatabaseId: null,
        meetingCount: 0,
        createdAt: "2026-04-25T09:00:00.000Z",
        updatedAt: "2026-04-25T09:00:00.000Z",
        context: null,
        recentMeetings: [],
      },
    });
  });

  void it("returns project detail for the requested project", async () => {
    const getProjectDetail = mock.fn(async () => ({
      id: "project_1",
      title: "Platform Revamp",
      description: "Q2 planning",
      isDraft: false,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      meetingCount: 0,
      createdAt: "2026-04-25T09:00:00.000Z",
      updatedAt: "2026-04-25T09:00:00.000Z",
      context: null,
      recentMeetings: [],
    }));

    const controller = new ProjectsController(
      {
        listProjects: mock.fn(async () => []),
        createProject: mock.fn(async () => undefined),
        getProjectDetail,
        updateProject: mock.fn(async () => undefined),
      } as never,
      {
        configureProjectDestination: mock.fn(async () => undefined),
        clearProjectDestination: mock.fn(async () => undefined),
      } as never,
    );

    const response = await controller.getProjectDetailForUser(
      {
        userId: "clerk_user_1",
        sessionId: null,
        authorizedParty: null,
        claims: {},
      },
      "project_1",
    );

    assert.equal(getProjectDetail.mock.callCount(), 1);
    assert.deepEqual(getProjectDetail.mock.calls[0]?.arguments, [
      "clerk_user_1",
      "project_1",
    ]);
    assert.deepEqual(response, {
      project: {
        id: "project_1",
        title: "Platform Revamp",
        description: "Q2 planning",
        isDraft: false,
        notionProjectPageId: null,
        notionTaskDatabaseId: null,
        meetingCount: 0,
        createdAt: "2026-04-25T09:00:00.000Z",
        updatedAt: "2026-04-25T09:00:00.000Z",
        context: null,
        recentMeetings: [],
      },
    });
  });

  void it("updates a project for the current Clerk user", async () => {
    const updateProject = mock.fn(async () => ({
      id: "project_1",
      title: "Platform Revamp Final",
      description: "Finalized scope",
      isDraft: false,
      notionProjectPageId: null,
      notionTaskDatabaseId: null,
      meetingCount: 0,
      createdAt: "2026-04-25T09:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
      context: null,
      recentMeetings: [],
    }));

    const controller = new ProjectsController(
      {
        listProjects: mock.fn(async () => []),
        createProject: mock.fn(async () => undefined),
        getProjectDetail: mock.fn(async () => undefined),
        updateProject,
      } as never,
      {
        configureProjectDestination: mock.fn(async () => undefined),
        clearProjectDestination: mock.fn(async () => undefined),
      } as never,
    );

    const response = await controller.updateProjectForUser(
      {
        userId: "clerk_user_1",
        sessionId: null,
        authorizedParty: null,
        claims: {},
      },
      "project_1",
      {
        title: "Platform Revamp Final",
        description: "Finalized scope",
        isDraft: false,
      },
    );

    assert.equal(updateProject.mock.callCount(), 1);
    assert.deepEqual(updateProject.mock.calls[0]?.arguments, [
      "clerk_user_1",
      "project_1",
      {
        title: "Platform Revamp Final",
        description: "Finalized scope",
        isDraft: false,
      },
    ]);
    assert.deepEqual(response, {
      project: {
        id: "project_1",
        title: "Platform Revamp Final",
        description: "Finalized scope",
        isDraft: false,
        notionProjectPageId: null,
        notionTaskDatabaseId: null,
        meetingCount: 0,
        createdAt: "2026-04-25T09:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
        context: null,
        recentMeetings: [],
      },
    });
  });
});

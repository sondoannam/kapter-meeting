import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { BadRequestException } from "@nestjs/common";

import { NotionService } from "./notion.service";

const createJsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const createService = () => {
  const getOrSyncLocalUser = mock.fn(async (...args: unknown[]) => {
    void args;

    return {
      id: "user_1",
      clerkId: "clerk_user_1",
      email: "user@example.com",
      name: null,
      imageUrl: null,
    };
  });
  const findConnection = mock.fn(async (...args: unknown[]) => {
    void args;

    return {
      id: "notion_connection_1",
      accessToken: "notion_access_token",
      workspaceId: "workspace_1",
      workspaceName: "Workspace",
      workspaceIcon: null,
    };
  });
  const findMeeting = mock.fn(
    async (...args: unknown[]): Promise<unknown> => {
      void args;

      return null;
    },
  );
  const updateProject = mock.fn(
    async (...args: unknown[]): Promise<unknown> => {
      void args;

      return undefined;
    },
  );
  const updateActionItem = mock.fn(
    async (...args: unknown[]): Promise<unknown> => {
      void args;

      return undefined;
    },
  );
  const service = new NotionService(
    {
      notion: {
        apiBaseUrl: "https://api.notion.test",
        authBaseUrl: "https://api.notion.test/v1/oauth/authorize",
        version: "2026-03-11",
        clientId: "client_id",
        clientSecret: "client_secret",
        oauthRedirectUri: "http://localhost:3001/api/notion/callback",
        webappBaseUrl: "http://localhost:5173",
      },
    } as never,
    {
      notionConnection: {
        findUnique: findConnection,
      },
      meeting: {
        findFirst: findMeeting,
      },
      project: {
        update: updateProject,
      },
      actionItem: {
        update: updateActionItem,
      },
    } as never,
    {
      getOrSyncLocalUser,
    } as never,
  );

  return {
    service,
    clerkAuthService: {
      getOrSyncLocalUser,
    },
    notionConnection: {
      findUnique: findConnection,
    },
    meeting: {
      findFirst: findMeeting,
    },
    project: {
      update: updateProject,
    },
    actionItem: {
      update: updateActionItem,
    },
  };
};

const approvedMeeting = (overrides?: Record<string, unknown>) => ({
  id: "meeting_1",
  artifactReviewStatus: "APPROVED",
  project: {
    id: "project_1",
    title: "Platform Revamp",
    description: "Q2 planning",
    notionDestinationMode: "EXISTING_PAGE",
    notionProjectPageId: "notion_project_page_1",
    notionTaskDatabaseId: "notion_database_1",
  },
  actionItems: [
    {
      id: "action_item_1",
      taskContent: "Prepare Notion sync",
      deadline: new Date("2026-04-30T00:00:00.000Z"),
      status: "TODO",
      isSynced: false,
      assignee: {
        aiLabel: "Speaker 0",
        realName: "Nam",
      },
    },
    {
      id: "action_item_2",
      taskContent: "Already synced task",
      deadline: null,
      status: "DONE",
      isSynced: true,
      assignee: null,
    },
  ],
  ...overrides,
});

void describe("NotionService", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  void it("inserts unsynced approved action items into an existing project Notion database", async () => {
    const { service, meeting, project, actionItem } = createService();
    const requests: Array<{ url: string; init: RequestInit }> = [];

    meeting.findFirst.mock.mockImplementation(async () => approvedMeeting());
    mock.method(
      globalThis,
      "fetch",
      async (url: URL | RequestInfo, init?: RequestInit) => {
        requests.push({ url: String(url), init: init as RequestInit });

        if (String(url).endsWith("/v1/databases/notion_database_1")) {
          return createJsonResponse({
            id: "notion_database_1",
            data_sources: [{ id: "notion_data_source_1", name: "Action Items" }],
          });
        }

        if (String(url).endsWith("/v1/data_sources/notion_data_source_1")) {
          return createJsonResponse({
            id: "notion_data_source_1",
            properties: {
              Name: {
                type: "title",
              },
              "Kapter item key": {
                type: "rich_text",
              },
            },
          });
        }

        if (String(url).endsWith("/v1/data_sources/notion_data_source_1/query")) {
          return createJsonResponse({
            results: [],
          });
        }

        return createJsonResponse({
          id: "notion_task_page_1",
        });
      },
    );

    const result = await service.syncMeetingActionItems(
      "clerk_user_1",
      "meeting_1",
    );

    assert.equal(project.update.mock.callCount(), 0);
    assert.equal(actionItem.update.mock.callCount(), 1);
    assert.deepEqual(actionItem.update.mock.calls[0]?.arguments[0], {
      where: {
        id: "action_item_1",
      },
      data: {
        isSynced: true,
        notionPageId: "notion_task_page_1",
      },
    });
    assert.deepEqual(result, {
      meetingId: "meeting_1",
      projectId: "project_1",
      notionProjectPageId: "notion_project_page_1",
      notionTaskDatabaseId: "notion_database_1",
      notionTaskDataSourceId: "notion_data_source_1",
      createdDestination: false,
      syncedCount: 1,
      skippedCount: 1,
    });

    const createTaskRequest = requests.find(
      (request) =>
        request.url.endsWith("/v1/pages") &&
        request.init.method === "POST",
    );
    const createTaskBody = JSON.parse(
      String(createTaskRequest?.init.body),
    ) as Record<string, unknown>;

    assert.deepEqual(createTaskBody.parent, {
      type: "data_source_id",
      data_source_id: "notion_data_source_1",
    });
    assert.deepEqual(createTaskBody.properties, {
      Name: {
        title: [
          {
            type: "text",
            text: {
              content: "Prepare Notion sync",
            },
          },
        ],
      },
      Status: {
        select: {
          name: "To do",
        },
      },
      Assignee: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Nam",
            },
          },
        ],
      },
      "Source meeting": {
        url: "http://localhost:5173/dashboard/meetings/meeting_1",
      },
      "Kapter item key": {
        rich_text: [
          {
            type: "text",
            text: {
              content: "meeting_1:action_item_1",
            },
          },
        ],
      },
      Deadline: {
        date: {
          start: "2026-04-30T00:00:00.000Z",
        },
      },
    });
  });

  void it("adds the sync-key property to an existing data source before creating the Notion page", async () => {
    const { service, meeting, project, actionItem } = createService();
    const requests: Array<{ url: string; init: RequestInit }> = [];

    meeting.findFirst.mock.mockImplementation(async () =>
      approvedMeeting({
        project: {
          id: "project_1",
          title: "Platform Revamp",
          description: "Q2 planning",
          notionDestinationMode: "EXISTING_PAGE",
          notionProjectPageId: "notion_project_page_1",
          notionTaskDatabaseId: null,
        },
        actionItems: [
          {
            id: "action_item_1",
            taskContent: "Prepare Notion sync",
            deadline: null,
            status: "IN_PROGRESS",
            isSynced: false,
            assignee: null,
          },
        ],
      }),
    );
    mock.method(
      globalThis,
      "fetch",
      async (url: URL | RequestInfo, init?: RequestInit) => {
        requests.push({ url: String(url), init: init as RequestInit });

        if (
          String(url).endsWith("/v1/databases") &&
          (init as RequestInit).method === "POST"
        ) {
          return createJsonResponse({
            id: "created_database_1",
          });
        }

        if (String(url).endsWith("/v1/databases/created_database_1")) {
          return createJsonResponse({
            id: "created_database_1",
            data_sources: [{ id: "created_data_source_1" }],
          });
        }

        if (
          String(url).endsWith("/v1/data_sources/created_data_source_1") &&
          (init as RequestInit).method === "GET"
        ) {
          return createJsonResponse({
            id: "created_data_source_1",
            properties: {
              Name: {
                type: "title",
              },
            },
          });
        }

        if (
          String(url).endsWith("/v1/data_sources/created_data_source_1") &&
          (init as RequestInit).method === "PATCH"
        ) {
          return createJsonResponse({
            id: "created_data_source_1",
            properties: {
              Name: {
                type: "title",
              },
              "Kapter item key": {
                type: "rich_text",
              },
            },
          });
        }

        if (
          String(url).endsWith("/v1/data_sources/created_data_source_1/query")
        ) {
          return createJsonResponse({
            results: [],
          });
        }

        return createJsonResponse({
          id: "notion_task_page_1",
        });
      },
    );

    const result = await service.syncMeetingActionItems(
      "clerk_user_1",
      "meeting_1",
    );

    assert.equal(project.update.mock.callCount(), 1);
    assert.deepEqual(project.update.mock.calls[0]?.arguments[0], {
      where: {
        id: "project_1",
      },
      data: {
        notionDestinationMode: "EXISTING_PAGE",
        notionProjectPageId: "notion_project_page_1",
        notionTaskDatabaseId: "created_database_1",
      },
    });
    assert.equal(actionItem.update.mock.callCount(), 1);
    assert.deepEqual(result, {
      meetingId: "meeting_1",
      projectId: "project_1",
      notionProjectPageId: "notion_project_page_1",
      notionTaskDatabaseId: "created_database_1",
      notionTaskDataSourceId: "created_data_source_1",
      createdDestination: true,
      syncedCount: 1,
      skippedCount: 0,
    });

    const createDatabaseBody = JSON.parse(
      String(requests[0]?.init.body),
    ) as Record<string, unknown>;
    const patchDataSourceBody = JSON.parse(
      String(requests[3]?.init.body),
    ) as Record<string, unknown>;

    assert.deepEqual(createDatabaseBody.parent, {
      type: "page_id",
      page_id: "notion_project_page_1",
    });
    assert.deepEqual(patchDataSourceBody, {
      properties: {
        "Kapter item key": {
          rich_text: {},
        },
      },
    });
  });

  void it("rejects sync before meeting artifacts are approved", async () => {
    const { service, meeting } = createService();

    meeting.findFirst.mock.mockImplementation(async () =>
      approvedMeeting({
        artifactReviewStatus: "READY",
      }),
    );
    mock.method(globalThis, "fetch", async () => createJsonResponse({}));

    await assert.rejects(
      () => service.syncMeetingActionItems("clerk_user_1", "meeting_1"),
      BadRequestException,
    );
  });

  void it("reconciles an already-created Notion page before creating a duplicate", async () => {
    const { service, meeting, project, actionItem } = createService();
    const requests: Array<{ url: string; init: RequestInit }> = [];

    meeting.findFirst.mock.mockImplementation(async () =>
      approvedMeeting({
        actionItems: [
          {
            id: "action_item_1",
            taskContent: "Prepare Notion sync",
            deadline: null,
            status: "TODO",
            isSynced: false,
            assignee: null,
          },
        ],
      }),
    );
    mock.method(
      globalThis,
      "fetch",
      async (url: URL | RequestInfo, init?: RequestInit) => {
        requests.push({ url: String(url), init: init as RequestInit });

        if (String(url).endsWith("/v1/databases/notion_database_1")) {
          return createJsonResponse({
            id: "notion_database_1",
            data_sources: [{ id: "notion_data_source_1", name: "Action Items" }],
          });
        }

        if (String(url).endsWith("/v1/data_sources/notion_data_source_1")) {
          return createJsonResponse({
            id: "notion_data_source_1",
            properties: {
              Name: {
                type: "title",
              },
              "Kapter item key": {
                type: "rich_text",
              },
            },
          });
        }

        if (String(url).endsWith("/v1/data_sources/notion_data_source_1/query")) {
          return createJsonResponse({
            results: [
              {
                id: "existing_notion_task_page_1",
              },
            ],
          });
        }

        return createJsonResponse({
          id: "unexpected_page_creation",
        });
      },
    );

    const result = await service.syncMeetingActionItems(
      "clerk_user_1",
      "meeting_1",
    );

    assert.equal(project.update.mock.callCount(), 0);
    assert.equal(actionItem.update.mock.callCount(), 1);
    assert.deepEqual(actionItem.update.mock.calls[0]?.arguments[0], {
      where: {
        id: "action_item_1",
      },
      data: {
        isSynced: true,
        notionPageId: "existing_notion_task_page_1",
      },
    });
    assert.equal(
      requests.some((request) => request.url.endsWith("/v1/pages")),
      false,
    );
    assert.equal(result.syncedCount, 1);
  });
});

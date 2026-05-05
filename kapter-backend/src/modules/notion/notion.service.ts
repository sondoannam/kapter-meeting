import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

import { appConfig } from "src/config/app.config";
import type { SyncedLocalUser } from "src/modules/clerk/clerk-local-user.service";
import { ClerkAuthService } from "src/modules/clerk/clerk-auth.service";
import { PrismaService } from "src/database/prisma.service";
import type { ConfigureProjectNotionDestinationDto } from "../projects/dto/configure-project-notion-destination.dto";

export interface NotionConnectionStatus {
  provider: "notion";
  oauthConfigured: boolean;
  connected: boolean;
  workspace: {
    id: string;
    name: string | null;
    icon: string | null;
  } | null;
  connectedAt: string | null;
}

interface NotionOAuthStatePayload {
  clerkUserId: string;
  issuedAt: number;
  returnToPath: string;
}

interface NotionTokenOwnerUser {
  id?: string;
  name?: string | null;
  person?: {
    email?: string;
  };
}

interface NotionTokenResponse {
  access_token: string;
  refresh_token: string | null;
  bot_id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  owner?: {
    type?: string;
    user?: NotionTokenOwnerUser;
  };
}

export interface NotionPageSearchResult {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string | null;
}

interface NotionSearchResponse {
  results?: Array<{
    id: string;
    url: string;
    last_edited_time?: string;
    properties?: Record<string, unknown>;
  }>;
}

interface NotionPageCreateResponse {
  id: string;
  url?: string;
}

interface NotionDatabaseCreateResponse {
  id: string;
  data_sources?: Array<{
    id: string;
    name?: string;
  }>;
}

interface NotionDatabaseRetrieveResponse {
  id: string;
  data_sources?: Array<{
    id: string;
    name?: string;
  }>;
}

interface NotionDataSourceProperty {
  id?: string;
  type?: string;
  name?: string;
}

interface NotionDataSourceResponse {
  id: string;
  properties?: Record<string, NotionDataSourceProperty>;
}

interface NotionDataSourceQueryResponse {
  results?: Array<{
    id: string;
  }>;
}

export interface NotionTaskSyncResult {
  meetingId: string;
  projectId: string;
  notionProjectPageId: string;
  notionTaskDatabaseId: string;
  notionTaskDataSourceId: string | null;
  createdDestination: boolean;
  syncedCount: number;
  skippedCount: number;
}

const NOTION_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const NOTION_RICH_TEXT_LIMIT = 2000;
const ACTION_ITEM_SYNC_KEY_PROPERTY_NAME = "Kapter item key";

const ACTION_ITEM_STATUS_LABELS = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
} as const;

const normalizeReturnToPath = (value?: string): string => {
  const trimmed = value?.trim();

  if (!trimmed || !trimmed.startsWith("/")) {
    return "/dashboard";
  }

  return trimmed;
};

const getPageTitleFromProperties = (
  properties?: Record<string, unknown>,
): string => {
  if (!properties) {
    return "Untitled page";
  }

  for (const property of Object.values(properties)) {
    if (
      typeof property === "object" &&
      property !== null &&
      "type" in property &&
      property.type === "title" &&
      "title" in property &&
      Array.isArray(property.title)
    ) {
      const title = property.title
        .map((item) => {
          if (
            typeof item === "object" &&
            item !== null &&
            "plain_text" in item &&
            typeof item.plain_text === "string"
          ) {
            return item.plain_text;
          }

          return "";
        })
        .join("")
        .trim();

      if (title) {
        return title;
      }
    }
  }

  return "Untitled page";
};

const truncateNotionText = (value: string): string =>
  value.length > NOTION_RICH_TEXT_LIMIT
    ? value.slice(0, NOTION_RICH_TEXT_LIMIT)
    : value;

const toNotionText = (content: string) => ({
  type: "text",
  text: {
    content: truncateNotionText(content),
  },
});

const buildActionItemSyncKey = (meetingId: string, actionItemId: string) =>
  `${meetingId}:${actionItemId}`;

@Injectable()
export class NotionService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly prisma: PrismaService,
    private readonly clerkAuthService: ClerkAuthService,
  ) {}

  async getConnectionStatus(
    clerkUserId: string,
  ): Promise<NotionConnectionStatus> {
    const localUser = await this.getLocalUser(clerkUserId);
    const connection = await this.prisma.notionConnection.findUnique({
      where: {
        userId: localUser.id,
      },
    });

    return {
      provider: "notion",
      oauthConfigured: this.isOAuthConfigured(),
      connected: Boolean(connection),
      workspace: connection
        ? {
            id: connection.workspaceId,
            name: connection.workspaceName,
            icon: connection.workspaceIcon,
          }
        : null,
      connectedAt: connection ? connection.updatedAt.toISOString() : null,
    };
  }

  async buildAuthorizationUrl(
    clerkUserId: string,
    returnToPath?: string,
  ): Promise<string> {
    if (!this.isOAuthConfigured()) {
      throw new BadRequestException(
        "Notion OAuth is not configured for this environment.",
      );
    }

    await this.getLocalUser(clerkUserId);

    const state = this.signState({
      clerkUserId,
      issuedAt: Date.now(),
      returnToPath: normalizeReturnToPath(returnToPath),
    });

    const url = new URL(this.config.notion.authBaseUrl);
    url.searchParams.set("owner", "user");
    url.searchParams.set("client_id", this.config.notion.clientId!);
    url.searchParams.set("redirect_uri", this.config.notion.oauthRedirectUri!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);

    return url.toString();
  }

  async handleOAuthCallback(input: {
    code?: string;
    error?: string;
    state?: string;
  }): Promise<string> {
    const fallbackReturnToPath = "/dashboard";
    const nextState = input.state ? this.tryVerifyState(input.state) : null;
    const returnToPath = nextState?.returnToPath ?? fallbackReturnToPath;

    if (input.error) {
      return this.buildFrontendRedirect(returnToPath, {
        notion_status: "error",
        reason: input.error,
      });
    }

    if (!input.code || !nextState) {
      return this.buildFrontendRedirect(returnToPath, {
        notion_status: "error",
        reason: "invalid_callback",
      });
    }

    try {
      const tokenResponse = await this.exchangeAuthorizationCode(input.code);
      await this.persistNotionConnection(nextState.clerkUserId, tokenResponse);

      return this.buildFrontendRedirect(returnToPath, {
        notion_status: "connected",
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.message
          ? error.message
          : "callback_failed";

      return this.buildFrontendRedirect(returnToPath, {
        notion_status: "error",
        reason,
      });
    }
  }

  async searchPages(
    clerkUserId: string,
    query?: string,
  ): Promise<NotionPageSearchResult[]> {
    const connection = await this.getRequiredConnection(clerkUserId);
    const response = await this.notionRequest<NotionSearchResponse>(
      "/v1/search",
      {
        method: "POST",
        body: JSON.stringify({
          query: query?.trim() || undefined,
          page_size: 12,
          filter: {
            property: "object",
            value: "page",
          },
          sort: {
            direction: "descending",
            timestamp: "last_edited_time",
          },
        }),
      },
      connection.accessToken,
    );

    return (response.results ?? []).map((result) => ({
      id: result.id,
      title: getPageTitleFromProperties(result.properties),
      url: result.url,
      lastEditedTime: result.last_edited_time ?? null,
    }));
  }

  async configureProjectDestination(
    clerkUserId: string,
    projectId: string,
    input: ConfigureProjectNotionDestinationDto,
  ): Promise<void> {
    const localUser = await this.getLocalUser(clerkUserId);
    const connection = await this.getRequiredConnection(clerkUserId);
    const project = await this.getOwnedProject(localUser.id, projectId);
    const parentPageId = input.parentPageId.trim();

    let anchorPageId = parentPageId;

    if (input.mode === "PROJECT_PAGE") {
      const createdPage = await this.notionRequest<NotionPageCreateResponse>(
        "/v1/pages",
        {
          method: "POST",
          body: JSON.stringify({
            parent: {
              type: "page_id",
              page_id: parentPageId,
            },
            properties: {
              title: {
                title: [
                  {
                    type: "text",
                    text: {
                      content: project.title,
                    },
                  },
                ],
              },
            },
            markdown:
              project.description?.trim() ||
              "Created by Kapter to anchor project captures and action items.",
          }),
        },
        connection.accessToken,
      );

      anchorPageId = createdPage.id;
    }

    const createdDatabase =
      await this.notionRequest<NotionDatabaseCreateResponse>(
        "/v1/databases",
        {
          method: "POST",
          body: JSON.stringify({
            parent: {
              type: "page_id",
              page_id: anchorPageId,
            },
            title: [
              {
                type: "text",
                text: {
                  content: "Action Items",
                },
              },
            ],
            description: [
              {
                type: "text",
                text: {
                  content: `Kapter-managed action items for ${project.title}`,
                },
              },
            ],
            initial_data_source: {
              properties: {
                Name: {
                  title: {},
                },
                Status: {
                  select: {
                    options: [
                      {
                        name: "To do",
                        color: "default",
                      },
                      {
                        name: "In progress",
                        color: "blue",
                      },
                      {
                        name: "Done",
                        color: "green",
                      },
                    ],
                  },
                },
                Assignee: {
                  rich_text: {},
                },
                Deadline: {
                  date: {},
                },
                "Source meeting": {
                  url: {},
                },
              },
            },
          }),
        },
        connection.accessToken,
      );

    await this.prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        notionDestinationMode: input.mode,
        notionProjectPageId: anchorPageId,
        notionTaskDatabaseId: createdDatabase.id,
      },
    });
  }

  async syncMeetingActionItems(
    clerkUserId: string,
    meetingId: string,
  ): Promise<NotionTaskSyncResult> {
    const localUser = await this.getLocalUser(clerkUserId);
    const connection = await this.getRequiredConnection(clerkUserId);
    const meeting = await this.prisma.meeting.findFirst({
      where: {
        id: meetingId,
        userId: localUser.id,
        user: {
          is: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        artifactReviewStatus: true,
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            notionDestinationMode: true,
            notionProjectPageId: true,
            notionTaskDatabaseId: true,
          },
        },
        actionItems: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            taskContent: true,
            deadline: true,
            status: true,
            isSynced: true,
            assignee: {
              select: {
                aiLabel: true,
                realName: true,
              },
            },
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException("Meeting not found.");
    }

    if (meeting.artifactReviewStatus !== "APPROVED") {
      throw new BadRequestException(
        "Approve meeting artifacts before syncing them to Notion.",
      );
    }

    if (!meeting.project) {
      throw new BadRequestException(
        "Meeting must belong to a project before syncing to Notion.",
      );
    }

    const destination = await this.ensureProjectTaskDatabase(
      meeting.project,
      connection.accessToken,
    );
    const taskParent = await this.resolveTaskParent(
      destination.notionTaskDatabaseId,
      connection.accessToken,
    );
    const syncKeyProperty = await this.ensureActionItemSyncKeyProperty(
      taskParent.dataSourceId,
      connection.accessToken,
    );
    let syncedCount = 0;

    for (const actionItem of meeting.actionItems) {
      if (actionItem.isSynced) {
        continue;
      }

      const actionItemSyncKey = buildActionItemSyncKey(meeting.id, actionItem.id);

      if (syncKeyProperty.enabled && syncKeyProperty.dataSourceId) {
        const existingNotionPageId = await this.findExistingActionItemPage(
          syncKeyProperty.dataSourceId,
          actionItemSyncKey,
          connection.accessToken,
        );

        if (existingNotionPageId) {
          await this.markActionItemSynced(actionItem.id, existingNotionPageId);
          syncedCount += 1;
          continue;
        }
      }

      const notionPage = await this.notionRequest<NotionPageCreateResponse>(
        "/v1/pages",
        {
          method: "POST",
          body: JSON.stringify({
            parent: taskParent.parent,
            properties: this.buildActionItemPageProperties({
              actionItem,
              meetingId: meeting.id,
              actionItemSyncKey: syncKeyProperty.enabled
                ? actionItemSyncKey
                : null,
            }),
          }),
        },
        connection.accessToken,
      );

      await this.markActionItemSynced(actionItem.id, notionPage.id);

      syncedCount += 1;
    }

    return {
      meetingId: meeting.id,
      projectId: meeting.project.id,
      notionProjectPageId: destination.notionProjectPageId,
      notionTaskDatabaseId: destination.notionTaskDatabaseId,
      notionTaskDataSourceId: taskParent.dataSourceId,
      createdDestination: destination.createdDestination,
      syncedCount,
      skippedCount: meeting.actionItems.length - syncedCount,
    };
  }

  async clearProjectDestination(
    clerkUserId: string,
    projectId: string,
  ): Promise<void> {
    const localUser = await this.getLocalUser(clerkUserId);
    const project = await this.getOwnedProject(localUser.id, projectId);

    await this.prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        notionDestinationMode: null,
        notionProjectPageId: null,
        notionTaskDatabaseId: null,
      },
    });
  }

  private isOAuthConfigured(): boolean {
    return Boolean(
      this.config.notion.clientId &&
      this.config.notion.clientSecret &&
      this.config.notion.oauthRedirectUri,
    );
  }

  private async getLocalUser(clerkUserId: string): Promise<SyncedLocalUser> {
    return this.clerkAuthService.getOrSyncLocalUser(clerkUserId);
  }

  private async getRequiredConnection(clerkUserId: string) {
    const localUser = await this.getLocalUser(clerkUserId);
    const connection = await this.prisma.notionConnection.findUnique({
      where: {
        userId: localUser.id,
      },
    });

    if (!connection) {
      throw new BadRequestException(
        "Connect your Notion workspace before using the Notion integration.",
      );
    }

    return connection;
  }

  private async getOwnedProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      select: {
        id: true,
        title: true,
        description: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project ${projectId} was not found for the current user.`,
      );
    }

    return project;
  }

  private async ensureProjectTaskDatabase(
    project: {
      id: string;
      title: string;
      description: string | null;
      notionDestinationMode: "PROJECT_PAGE" | "EXISTING_PAGE" | null;
      notionProjectPageId: string | null;
      notionTaskDatabaseId: string | null;
    },
    accessToken: string,
  ): Promise<{
    notionProjectPageId: string;
    notionTaskDatabaseId: string;
    createdDestination: boolean;
  }> {
    if (project.notionProjectPageId && project.notionTaskDatabaseId) {
      return {
        notionProjectPageId: project.notionProjectPageId,
        notionTaskDatabaseId: project.notionTaskDatabaseId,
        createdDestination: false,
      };
    }

    let notionProjectPageId = project.notionProjectPageId;
    let destinationMode = project.notionDestinationMode;

    if (!notionProjectPageId) {
      const createdPage = await this.notionRequest<NotionPageCreateResponse>(
        "/v1/pages",
        {
          method: "POST",
          body: JSON.stringify({
            parent: {
              type: "workspace",
              workspace: true,
            },
            properties: {
              title: {
                title: [toNotionText(project.title)],
              },
            },
            markdown:
              project.description?.trim() ||
              "Created by Kapter to anchor project captures and action items.",
          }),
        },
        accessToken,
      );

      notionProjectPageId = createdPage.id;
      destinationMode = "PROJECT_PAGE";
    }

    const createdDatabase = await this.createActionItemsDatabase(
      notionProjectPageId,
      project.title,
      accessToken,
    );

    await this.prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        notionDestinationMode:
          destinationMode ??
          (project.notionProjectPageId ? "EXISTING_PAGE" : "PROJECT_PAGE"),
        notionProjectPageId,
        notionTaskDatabaseId: createdDatabase.id,
      },
    });

    return {
      notionProjectPageId,
      notionTaskDatabaseId: createdDatabase.id,
      createdDestination: true,
    };
  }

  private async createActionItemsDatabase(
    parentPageId: string,
    projectTitle: string,
    accessToken: string,
  ): Promise<NotionDatabaseCreateResponse> {
    return this.notionRequest<NotionDatabaseCreateResponse>(
      "/v1/databases",
      {
        method: "POST",
        body: JSON.stringify({
          parent: {
            type: "page_id",
            page_id: parentPageId,
          },
          title: [
            {
              type: "text",
              text: {
                content: "Action Items",
              },
            },
          ],
          description: [
            {
              type: "text",
              text: {
                content: `Kapter-managed action items for ${projectTitle}`,
              },
            },
          ],
          is_inline: true,
          initial_data_source: {
            properties: {
              Name: {
                title: {},
              },
              Status: {
                select: {
                  options: [
                    {
                      name: "To do",
                      color: "default",
                    },
                    {
                      name: "In progress",
                      color: "blue",
                    },
                    {
                      name: "Done",
                      color: "green",
                    },
                  ],
                },
              },
              Assignee: {
                rich_text: {},
              },
              Deadline: {
                date: {},
              },
              "Source meeting": {
                url: {},
              },
              [ACTION_ITEM_SYNC_KEY_PROPERTY_NAME]: {
                rich_text: {},
              },
            },
          },
        }),
      },
      accessToken,
    );
  }

  private async resolveTaskParent(
    databaseId: string,
    accessToken: string,
  ): Promise<{
    dataSourceId: string | null;
    parent:
      | {
          type: "data_source_id";
          data_source_id: string;
        }
      | {
          type: "database_id";
          database_id: string;
        };
  }> {
    const database = await this.notionRequest<NotionDatabaseRetrieveResponse>(
      `/v1/databases/${databaseId}`,
      {
        method: "GET",
      },
      accessToken,
    );
    const dataSourceId = database.data_sources?.[0]?.id ?? null;

    if (dataSourceId) {
      return {
        dataSourceId,
        parent: {
          type: "data_source_id",
          data_source_id: dataSourceId,
        },
      };
    }

    return {
      dataSourceId: null,
      parent: {
        type: "database_id",
        database_id: databaseId,
      },
    };
  }

  private buildActionItemPageProperties(input: {
    actionItem: {
      id: string;
      taskContent: string;
      deadline: Date | null;
      status: string;
      assignee: {
        aiLabel: string;
        realName: string | null;
      } | null;
    };
    meetingId: string;
    actionItemSyncKey: string | null;
  }): Record<string, unknown> {
    const assigneeName =
      input.actionItem.assignee?.realName ??
      input.actionItem.assignee?.aiLabel ??
      "";
    const properties: Record<string, unknown> = {
      Name: {
        title: [toNotionText(input.actionItem.taskContent)],
      },
      Status: {
        select: {
          name:
            ACTION_ITEM_STATUS_LABELS[
              input.actionItem
                .status as keyof typeof ACTION_ITEM_STATUS_LABELS
            ] ?? ACTION_ITEM_STATUS_LABELS.TODO,
        },
      },
      Assignee: {
        rich_text: assigneeName ? [toNotionText(assigneeName)] : [],
      },
      "Source meeting": {
        url: this.buildMeetingUrl(input.meetingId),
      },
    };

    if (input.actionItemSyncKey) {
      properties[ACTION_ITEM_SYNC_KEY_PROPERTY_NAME] = {
        rich_text: [toNotionText(input.actionItemSyncKey)],
      };
    }

    if (input.actionItem.deadline) {
      properties.Deadline = {
        date: {
          start: input.actionItem.deadline.toISOString(),
        },
      };
    }

    return properties;
  }

  private buildMeetingUrl(meetingId: string): string {
    return new URL(
      `/dashboard/meetings/${meetingId}`,
      this.config.notion.webappBaseUrl,
    ).toString();
  }

  private async ensureActionItemSyncKeyProperty(
    dataSourceId: string | null,
    accessToken: string,
  ): Promise<{
    dataSourceId: string | null;
    enabled: boolean;
  }> {
    if (!dataSourceId) {
      return {
        dataSourceId: null,
        enabled: false,
      };
    }

    // This repo targets Notion API version 2026-03-11, where data sources are
    // first-class API objects with their own retrieve/query/update endpoints.
    const dataSource = await this.notionRequest<NotionDataSourceResponse>(
      `/v1/data_sources/${dataSourceId}`,
      {
        method: "GET",
      },
      accessToken,
    );
    const existingProperty =
      dataSource.properties?.[ACTION_ITEM_SYNC_KEY_PROPERTY_NAME];

    if (existingProperty) {
      if (existingProperty.type && existingProperty.type !== "rich_text") {
        throw new BadRequestException(
          `The Notion destination property "${ACTION_ITEM_SYNC_KEY_PROPERTY_NAME}" must be rich text.`,
        );
      }

      return {
        dataSourceId,
        enabled: true,
      };
    }

    await this.notionRequest<NotionDataSourceResponse>(
      `/v1/data_sources/${dataSourceId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            [ACTION_ITEM_SYNC_KEY_PROPERTY_NAME]: {
              rich_text: {},
            },
          },
        }),
      },
      accessToken,
    );

    return {
      dataSourceId,
      enabled: true,
    };
  }

  private async findExistingActionItemPage(
    dataSourceId: string,
    actionItemSyncKey: string,
    accessToken: string,
  ): Promise<string | null> {
    const response = await this.notionRequest<NotionDataSourceQueryResponse>(
      `/v1/data_sources/${dataSourceId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          page_size: 1,
          result_type: "page",
          filter: {
            property: ACTION_ITEM_SYNC_KEY_PROPERTY_NAME,
            rich_text: {
              equals: actionItemSyncKey,
            },
          },
        }),
      },
      accessToken,
    );

    return response.results?.[0]?.id ?? null;
  }

  private async markActionItemSynced(
    actionItemId: string,
    notionPageId: string,
  ): Promise<void> {
    await this.prisma.actionItem.update({
      where: {
        id: actionItemId,
      },
      data: {
        isSynced: true,
        notionPageId,
      },
    });
  }

  private signState(payload: NotionOAuthStatePayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    );
    const signature = createHmac("sha256", this.config.notion.clientSecret!)
      .update(encodedPayload)
      .digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  private tryVerifyState(signedState: string): NotionOAuthStatePayload | null {
    const [encodedPayload, signature] = signedState.split(".");

    if (!encodedPayload || !signature || !this.config.notion.clientSecret) {
      return null;
    }

    const expectedSignature = createHmac(
      "sha256",
      this.config.notion.clientSecret,
    )
      .update(encodedPayload)
      .digest("base64url");

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return null;
    }

    try {
      const parsedPayload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as NotionOAuthStatePayload;

      if (
        !parsedPayload.clerkUserId ||
        typeof parsedPayload.issuedAt !== "number" ||
        Date.now() - parsedPayload.issuedAt > NOTION_STATE_MAX_AGE_MS
      ) {
        return null;
      }

      return {
        clerkUserId: parsedPayload.clerkUserId,
        issuedAt: parsedPayload.issuedAt,
        returnToPath: normalizeReturnToPath(parsedPayload.returnToPath),
      };
    } catch {
      return null;
    }
  }

  private async exchangeAuthorizationCode(
    code: string,
  ): Promise<NotionTokenResponse> {
    const basicAuthToken = Buffer.from(
      `${this.config.notion.clientId}:${this.config.notion.clientSecret}`,
      "utf8",
    ).toString("base64");

    return this.notionRequest<NotionTokenResponse>(
      "/v1/oauth/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuthToken}`,
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: this.config.notion.oauthRedirectUri,
        }),
      },
      undefined,
    );
  }

  private async persistNotionConnection(
    clerkUserId: string,
    tokenResponse: NotionTokenResponse,
  ): Promise<void> {
    const localUser = await this.getLocalUser(clerkUserId);
    const notionOwner =
      tokenResponse.owner?.type === "user" ? tokenResponse.owner.user : null;

    await this.prisma.notionConnection.upsert({
      where: {
        userId: localUser.id,
      },
      update: {
        botId: tokenResponse.bot_id,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        workspaceId: tokenResponse.workspace_id,
        workspaceName: tokenResponse.workspace_name,
        workspaceIcon: tokenResponse.workspace_icon,
        ownerUserId: notionOwner?.id,
        ownerUserName: notionOwner?.name ?? null,
        ownerUserEmail: notionOwner?.person?.email ?? null,
      },
      create: {
        userId: localUser.id,
        botId: tokenResponse.bot_id,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        workspaceId: tokenResponse.workspace_id,
        workspaceName: tokenResponse.workspace_name,
        workspaceIcon: tokenResponse.workspace_icon,
        ownerUserId: notionOwner?.id,
        ownerUserName: notionOwner?.name ?? null,
        ownerUserEmail: notionOwner?.person?.email ?? null,
      },
    });
  }

  private buildFrontendRedirect(
    returnToPath: string,
    queryParams: Record<string, string>,
  ): string {
    const redirectUrl = new URL(
      normalizeReturnToPath(returnToPath),
      this.config.notion.webappBaseUrl,
    );

    for (const [key, value] of Object.entries(queryParams)) {
      redirectUrl.searchParams.set(key, value);
    }

    return redirectUrl.toString();
  }

  private async notionRequest<T>(
    path: string,
    init: RequestInit,
    bearerToken?: string,
  ): Promise<T> {
    const requestUrl = new URL(path, this.config.notion.apiBaseUrl).toString();
    const headers = new Headers(init.headers);

    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");
    headers.set("Notion-Version", this.config.notion.version);

    if (bearerToken) {
      headers.set("Authorization", `Bearer ${bearerToken}`);
    }

    const response = await fetch(requestUrl, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const message = await this.getNotionErrorMessage(response);

      if (response.status === 400 || response.status === 409) {
        throw new BadRequestException(message);
      }

      if (response.status === 401) {
        throw new UnauthorizedException(message);
      }

      if (response.status === 403) {
        throw new ForbiddenException(message);
      }

      if (response.status === 404) {
        throw new NotFoundException(message);
      }

      throw new BadGatewayException(message);
    }

    return (await response.json()) as T;
  }

  private async getNotionErrorMessage(response: Response): Promise<string> {
    try {
      const payload = (await response.json()) as {
        message?: string;
        error?: string;
      };

      return (
        payload.message ||
        payload.error ||
        `Notion request failed with status ${response.status}.`
      );
    } catch {
      return `Notion request failed with status ${response.status}.`;
    }
  }
}

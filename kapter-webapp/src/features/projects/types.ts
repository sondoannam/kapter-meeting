import type { IsoDateTimeString, MeetingStatus } from "@kapter/contracts/domain"

export type NotionProjectDestinationMode = "PROJECT_PAGE" | "EXISTING_PAGE"

export interface DashboardProjectSummary {
  id: string
  title: string
  description: string | null
  isDraft: boolean
  notionDestinationMode: NotionProjectDestinationMode | null
  notionProjectPageId: string | null
  notionTaskDatabaseId: string | null
  meetingCount: number
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface DashboardProjectContextSnapshot {
  initialDescription: string | null
  contextMarkdown: string | null
}

export interface DashboardProjectMeetingSummary {
  id: string
  title: string
  status: MeetingStatus
  externalMeetingId: string | null
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface DashboardProjectDetail extends DashboardProjectSummary {
  context: DashboardProjectContextSnapshot | null
  recentMeetings: DashboardProjectMeetingSummary[]
}

export interface ProjectsResponse {
  projects: DashboardProjectSummary[]
}

export interface ProjectDetailResponse {
  project: DashboardProjectDetail
}

export interface CreateProjectInput {
  title: string
  description?: string
  initialDescription?: string
  contextMarkdown?: string
}

export interface NotionWorkspaceSummary {
  id: string
  name: string | null
  icon: string | null
}

export interface NotionConnectionStatus {
  provider: "notion"
  oauthConfigured: boolean
  connected: boolean
  workspace: NotionWorkspaceSummary | null
  connectedAt: IsoDateTimeString | null
}

export interface NotionConnectionResponse {
  notion: NotionConnectionStatus
}

export interface CreateNotionAuthorizationResponse {
  authUrl: string
}

export interface NotionPageSearchResult {
  id: string
  title: string
  url: string
  lastEditedTime: IsoDateTimeString | null
}

export interface NotionPagesSearchResponse {
  pages: NotionPageSearchResult[]
}

export interface ConfigureProjectNotionDestinationInput {
  parentPageId: string
  mode: NotionProjectDestinationMode
}

export type ProjectsRequestStatus = "loading" | "ready" | "error"

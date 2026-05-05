import {
  apiClient,
  createAuthHeaders,
  toApiErrorMessage,
} from "@/lib/api-client"

import type {
  ConfigureProjectNotionDestinationInput,
  CreateNotionAuthorizationResponse,
  NotionConnectionResponse,
  NotionPagesSearchResponse,
  ProjectDetailResponse,
} from "../types"

export async function fetchNotionConnection(sessionToken: string) {
  try {
    const response = await apiClient.get<NotionConnectionResponse>(
      "/api/notion/connection",
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to load the Notion connection status.")
    )
  }
}

export async function createNotionAuthorizationUrl(
  sessionToken: string,
  returnToPath = "/dashboard"
) {
  try {
    const response = await apiClient.post<CreateNotionAuthorizationResponse>(
      "/api/notion/connect",
      { returnToPath },
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to start the Notion authorization flow.")
    )
  }
}

export async function searchNotionPages(sessionToken: string, query: string) {
  try {
    const response = await apiClient.get<NotionPagesSearchResponse>(
      "/api/notion/pages/search",
      {
        headers: createAuthHeaders(sessionToken),
        params: {
          query,
        },
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to search shared Notion pages.")
    )
  }
}

export async function configureProjectNotionDestination(
  sessionToken: string,
  projectId: string,
  input: ConfigureProjectNotionDestinationInput
) {
  try {
    const response = await apiClient.post<ProjectDetailResponse>(
      `/api/projects/${projectId}/notion-destination`,
      input,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(
        error,
        "Unable to save the Notion destination for this project."
      )
    )
  }
}

export async function clearProjectNotionDestination(
  sessionToken: string,
  projectId: string
) {
  try {
    const response = await apiClient.delete<ProjectDetailResponse>(
      `/api/projects/${projectId}/notion-destination`,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(
        error,
        "Unable to clear the Notion destination for this project."
      )
    )
  }
}

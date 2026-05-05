import {
  apiClient,
  createAuthHeaders,
  toApiErrorMessage,
} from "@/lib/api-client"

import type {
  CreateProjectInput,
  ProjectDetailResponse,
  ProjectsResponse,
} from "../types"

export async function fetchProjects(sessionToken: string) {
  try {
    const response = await apiClient.get<ProjectsResponse>("/api/projects", {
      headers: createAuthHeaders(sessionToken),
    })

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to load projects from the backend.")
    )
  }
}

export async function createProject(
  sessionToken: string,
  input: CreateProjectInput
) {
  try {
    const response = await apiClient.post<ProjectDetailResponse>(
      "/api/projects",
      input,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to create a project right now.")
    )
  }
}

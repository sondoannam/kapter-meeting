import {
  apiClient,
  createAuthHeaders,
  toApiErrorMessage,
} from "@/lib/api-client"

import type {
  CreateProjectInput,
  DeleteProjectResponse,
  ProjectDetailResponse,
  ProjectsResponse,
  UpdateProjectInput,
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

export async function fetchProjectDetail(
  sessionToken: string,
  projectId: string
) {
  try {
    const response = await apiClient.get<ProjectDetailResponse>(
      `/api/projects/${projectId}`,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to load the requested project details.")
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

export async function updateProject(
  sessionToken: string,
  projectId: string,
  input: UpdateProjectInput
) {
  try {
    const response = await apiClient.patch<ProjectDetailResponse>(
      `/api/projects/${projectId}`,
      input,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to update the project right now.")
    )
  }
}

export async function deleteProject(sessionToken: string, projectId: string) {
  try {
    const response = await apiClient.delete<DeleteProjectResponse>(
      `/api/projects/${projectId}`,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to delete the project right now.")
    )
  }
}

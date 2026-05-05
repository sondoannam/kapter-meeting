import { apiClient, createAuthHeaders, toApiErrorMessage } from "./api-client"

export interface CurrentUserSummary {
  id: string
  clerkId: string | null
  email: string
  name: string | null
  imageUrl: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CurrentUserResponse {
  auth: {
    clerkUserId: string
    sessionId: string | null
    authorizedParty: string | null
  }
  user: CurrentUserSummary | null
}

export async function fetchCurrentUser(sessionToken: string) {
  try {
    const response = await apiClient.get<CurrentUserResponse>("/api/auth/me", {
      headers: createAuthHeaders(sessionToken),
    })

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(
        error,
        "Backend auth lookup failed for the current Clerk session."
      )
    )
  }
}

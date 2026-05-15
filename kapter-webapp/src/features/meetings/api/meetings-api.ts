import {
  apiClient,
  createAuthHeaders,
  toApiErrorMessage,
} from "@/lib/api-client"

import type {
  ActiveMeetingResponse,
  DeleteMeetingResponse,
  LinkMeetingSpeakerRequest,
  MeetingDetailResponse,
  MeetingHistoryResponse,
  MeetingSpeakerPromotionRequest,
  MeetingNotionSyncResponse,
  SaveMeetingReviewRequest,
  UpdateMeetingMetadataRequest,
} from "../types"

export async function fetchMeetingHistory(sessionToken: string) {
  try {
    const response = await apiClient.get<MeetingHistoryResponse>(
      "/api/meetings",
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(
        error,
        "Unable to load meeting history from the backend."
      )
    )
  }
}

export async function fetchActiveMeeting(sessionToken: string) {
  try {
    const response = await apiClient.get<ActiveMeetingResponse>(
      "/api/meetings/active",
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(
        error,
        "Unable to load the active meeting snapshot from the backend."
      )
    )
  }
}

export async function fetchMeetingDetail(
  sessionToken: string,
  meetingId: string
) {
  try {
    const response = await apiClient.get<MeetingDetailResponse>(
      `/api/meetings/${meetingId}`,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(
        error,
        "Unable to load the requested meeting detail from the backend."
      )
    )
  }
}

export async function deleteMeeting(sessionToken: string, meetingId: string) {
  try {
    const response = await apiClient.delete<DeleteMeetingResponse>(
      `/api/meetings/${meetingId}`,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to delete the requested meeting.")
    )
  }
}

export async function saveMeetingReview(
  sessionToken: string,
  meetingId: string,
  payload: SaveMeetingReviewRequest
) {
  try {
    const response = await apiClient.patch<MeetingDetailResponse>(
      `/api/meetings/${meetingId}/review`,
      payload,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to save the meeting review.")
    )
  }
}

export async function updateMeetingMetadata(
  sessionToken: string,
  meetingId: string,
  payload: UpdateMeetingMetadataRequest
) {
  try {
    const response = await apiClient.patch<MeetingDetailResponse>(
      `/api/meetings/${meetingId}`,
      payload,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to update the meeting details.")
    )
  }
}

export async function linkMeetingSpeaker(
  sessionToken: string,
  meetingId: string,
  speakerId: string,
  payload: LinkMeetingSpeakerRequest
) {
  try {
    const response = await apiClient.post<MeetingDetailResponse>(
      `/api/meetings/${meetingId}/speakers/${speakerId}/link`,
      payload,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to link the meeting speaker.")
    )
  }
}

export async function promoteMeetingSpeaker(
  sessionToken: string,
  meetingId: string,
  speakerId: string,
  payload: MeetingSpeakerPromotionRequest
) {
  try {
    const response = await apiClient.post<MeetingDetailResponse>(
      `/api/meetings/${meetingId}/speakers/${speakerId}/promote`,
      payload,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to promote the meeting speaker.")
    )
  }
}

export async function clearMeetingSpeakerLink(
  sessionToken: string,
  meetingId: string,
  speakerId: string
) {
  try {
    const response = await apiClient.post<MeetingDetailResponse>(
      `/api/meetings/${meetingId}/speakers/${speakerId}/clear-link`,
      {},
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to clear the meeting speaker link.")
    )
  }
}

export async function approveMeetingReview(
  sessionToken: string,
  meetingId: string
) {
  try {
    const response = await apiClient.post<MeetingDetailResponse>(
      `/api/meetings/${meetingId}/review/approve`,
      {},
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to approve the meeting review.")
    )
  }
}

export async function retryMeetingExtraction(
  sessionToken: string,
  meetingId: string
) {
  try {
    const response = await apiClient.post<MeetingDetailResponse>(
      `/api/meetings/${meetingId}/extraction/retry`,
      {},
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to retry meeting extraction.")
    )
  }
}

export async function syncMeetingToNotion(
  sessionToken: string,
  meetingId: string
) {
  try {
    const response = await apiClient.post<MeetingNotionSyncResponse>(
      `/api/meetings/${meetingId}/notion/sync`,
      {},
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(
        error,
        "Unable to sync approved meeting action items to Notion."
      )
    )
  }
}

export async function applyContextProposal(
  sessionToken: string,
  meetingId: string,
  proposalId: string
) {
  try {
    const response = await apiClient.post<MeetingDetailResponse>(
      `/api/meetings/${meetingId}/context-proposals/${proposalId}/apply`,
      {},
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to apply the context proposal.")
    )
  }
}

export async function dismissContextProposal(
  sessionToken: string,
  meetingId: string,
  proposalId: string
) {
  try {
    const response = await apiClient.post<MeetingDetailResponse>(
      `/api/meetings/${meetingId}/context-proposals/${proposalId}/dismiss`,
      {},
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to dismiss the context proposal.")
    )
  }
}

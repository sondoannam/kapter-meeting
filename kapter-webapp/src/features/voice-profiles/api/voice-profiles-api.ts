import {
  apiClient,
  createAuthHeaders,
  toApiErrorMessage,
} from "@/lib/api-client"

import type {
  CreateVoiceProfileInput,
  DeleteVoiceProfileResponse,
  UpdateVoiceProfileInput,
  VoiceProfileEnrollmentResponse,
  VoiceProfilesResponse,
} from "../types"

export async function fetchVoiceProfiles(sessionToken: string) {
  try {
    const response = await apiClient.get<VoiceProfilesResponse>(
      "/api/voice-profiles",
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to load voice profiles from the backend.")
    )
  }
}

export async function createVoiceProfile(
  sessionToken: string,
  payload: CreateVoiceProfileInput
) {
  try {
    const response = await apiClient.post<{ voiceProfile: VoiceProfilesResponse["voiceProfiles"][number] }>(
      "/api/voice-profiles",
      payload,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to create the voice profile.")
    )
  }
}

export async function updateVoiceProfile(
  sessionToken: string,
  voiceProfileId: string,
  payload: UpdateVoiceProfileInput
) {
  try {
    const response = await apiClient.patch<{ voiceProfile: VoiceProfilesResponse["voiceProfiles"][number] }>(
      `/api/voice-profiles/${voiceProfileId}`,
      payload,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to update the voice profile.")
    )
  }
}

export async function deleteVoiceProfile(
  sessionToken: string,
  voiceProfileId: string
) {
  try {
    const response = await apiClient.delete<DeleteVoiceProfileResponse>(
      `/api/voice-profiles/${voiceProfileId}`,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(error, "Unable to delete the voice profile.")
    )
  }
}

export async function uploadVoiceProfileEnrollmentAudio(
  sessionToken: string,
  voiceProfileId: string,
  file: File
) {
  const formData = new FormData()
  formData.append("file", file)

  try {
    const response = await apiClient.post<VoiceProfileEnrollmentResponse>(
      `/api/voice-profiles/${voiceProfileId}/enrollment-audio`,
      formData,
      {
        headers: createAuthHeaders(sessionToken),
      }
    )

    return response.data
  } catch (error) {
    throw new Error(
      toApiErrorMessage(
        error,
        "Unable to upload enrollment audio for the voice profile."
      )
    )
  }
}

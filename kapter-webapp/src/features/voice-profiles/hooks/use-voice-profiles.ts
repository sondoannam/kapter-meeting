import * as React from "react"
import { useAuth } from "@clerk/react-router"

import {
  createVoiceProfile,
  deleteVoiceProfile,
  fetchVoiceProfiles,
  updateVoiceProfile,
  uploadVoiceProfileEnrollmentAudio,
} from "../api/voice-profiles-api"
import type {
  CreateVoiceProfileInput,
  UpdateVoiceProfileInput,
  VoiceProfile,
  VoiceProfileEnrollmentResponse,
  VoiceProfilesRequestStatus,
} from "../types"

export function useVoiceProfiles() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [voiceProfiles, setVoiceProfiles] = React.useState<VoiceProfile[]>([])
  const [status, setStatus] = React.useState<VoiceProfilesRequestStatus>("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    try {
      setStatus((currentStatus) =>
        currentStatus === "ready" ? currentStatus : "loading"
      )
      setErrorMessage(null)

      const sessionToken = await getToken()

      if (!sessionToken) {
        throw new Error("Unable to mint a Clerk session token.")
      }

      const response = await fetchVoiceProfiles(sessionToken)
      setVoiceProfiles(response.voiceProfiles)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load voice profiles."
      )
    }
  }, [getToken, isLoaded, isSignedIn])

  const runMutation = React.useCallback(
    async <T,>(
      mutation: (sessionToken: string) => Promise<T>,
      onSuccess: (result: T) => void
    ) => {
      if (!isLoaded || !isSignedIn) {
        throw new Error("Voice profiles require an authenticated session.")
      }

      setErrorMessage(null)
      const sessionToken = await getToken()

      if (!sessionToken) {
        throw new Error("Unable to mint a Clerk session token.")
      }

      try {
        const result = await mutation(sessionToken)
        onSuccess(result)
        setStatus("ready")
        return result
      } catch (error) {
        setStatus("error")
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to update voice profiles."
        )
        throw error
      }
    },
    [getToken, isLoaded, isSignedIn]
  )

  const create = React.useCallback(
    async (payload: CreateVoiceProfileInput) =>
      runMutation(
        (sessionToken) => createVoiceProfile(sessionToken, payload),
        ({ voiceProfile }) => {
          setVoiceProfiles((currentProfiles) => [voiceProfile, ...currentProfiles])
        }
      ),
    [runMutation]
  )

  const update = React.useCallback(
    async (voiceProfileId: string, payload: UpdateVoiceProfileInput) =>
      runMutation(
        (sessionToken) =>
          updateVoiceProfile(sessionToken, voiceProfileId, payload),
        ({ voiceProfile }) => {
          setVoiceProfiles((currentProfiles) =>
            currentProfiles.map((profile) =>
              profile.id === voiceProfile.id ? voiceProfile : profile
            )
          )
        }
      ),
    [runMutation]
  )

  const remove = React.useCallback(
    async (voiceProfileId: string) =>
      runMutation(
        (sessionToken) => deleteVoiceProfile(sessionToken, voiceProfileId),
        ({ deletedVoiceProfileId }) => {
          setVoiceProfiles((currentProfiles) =>
            currentProfiles.filter(
              (voiceProfile) => voiceProfile.id !== deletedVoiceProfileId
            )
          )
        }
      ),
    [runMutation]
  )

  const uploadEnrollment = React.useCallback(
    async (voiceProfileId: string, file: File) =>
      runMutation(
        (sessionToken) =>
          uploadVoiceProfileEnrollmentAudio(sessionToken, voiceProfileId, file),
        (result: VoiceProfileEnrollmentResponse) => {
          setVoiceProfiles((currentProfiles) =>
            currentProfiles.map((profile) =>
              profile.id === result.voiceProfile.id ? result.voiceProfile : profile
            )
          )
        }
      ),
    [runMutation]
  )

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [refresh])

  return {
    voiceProfiles,
    status,
    errorMessage,
    refresh,
    createVoiceProfile: create,
    updateVoiceProfile: update,
    deleteVoiceProfile: remove,
    uploadEnrollment,
  }
}

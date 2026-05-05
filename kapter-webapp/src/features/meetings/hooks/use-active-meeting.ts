import * as React from "react"
import { useAuth } from "@clerk/react-router"

import { fetchActiveMeeting } from "../api/meetings-api"
import type { DashboardMeetingSummary, MeetingsRequestStatus } from "../types"

export function useActiveMeeting(pollingMs = 5000) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [activeMeeting, setActiveMeeting] =
    React.useState<DashboardMeetingSummary | null>(null)
  const [status, setStatus] = React.useState<MeetingsRequestStatus>("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const authErrorMessage =
    isLoaded && !isSignedIn
      ? "Clerk session is not available for active meetings."
      : null

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
        throw new Error(
          "Unable to mint a Clerk session token for active meeting updates."
        )
      }

      const response = await fetchActiveMeeting(sessionToken)

      setActiveMeeting(response.meeting)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load active meeting updates."
      )
    }
  }, [getToken, isLoaded, isSignedIn])

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    let isCancelled = false

    const run = async () => {
      if (isCancelled) {
        return
      }

      await refresh()
    }

    void run()

    const intervalId = window.setInterval(() => {
      void run()
    }, pollingMs)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [isLoaded, isSignedIn, pollingMs, refresh])

  return {
    activeMeeting,
    status: authErrorMessage ? "error" : status,
    errorMessage: authErrorMessage || errorMessage,
    refresh,
  }
}

import * as React from "react"
import { useAuth } from "@clerk/react-router"

import { deleteMeeting, fetchMeetingHistory } from "../api/meetings-api"
import type { DashboardMeetingSummary, MeetingsRequestStatus } from "../types"

export function useMeetingHistory(pollingMs = 20000) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [meetings, setMeetings] = React.useState<DashboardMeetingSummary[]>([])
  const [status, setStatus] = React.useState<MeetingsRequestStatus>("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [activeMeetingDeleteId, setActiveMeetingDeleteId] =
    React.useState<string | null>(null)
  const authErrorMessage =
    isLoaded && !isSignedIn
      ? "Clerk session is not available for meeting history."
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
          "Unable to mint a Clerk session token for meeting history."
        )
      }

      const response = await fetchMeetingHistory(sessionToken)

      setMeetings(response.meetings)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load meeting history."
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

  const removeMeeting = React.useCallback(
    async (meetingId: string) => {
      if (!isLoaded || !isSignedIn) {
        throw new Error("Clerk session is not available for meeting deletion.")
      }

      setActiveMeetingDeleteId(meetingId)
      setErrorMessage(null)

      try {
        const sessionToken = await getToken()

        if (!sessionToken) {
          throw new Error(
            "Unable to mint a Clerk session token for meeting deletion."
          )
        }

        const response = await deleteMeeting(sessionToken, meetingId)

        setMeetings((currentMeetings) =>
          currentMeetings.filter(
            (meeting) => meeting.id !== response.deletedMeetingId
          )
        )
        setStatus("ready")

        return response.deletedMeetingId
      } catch (error) {
        const nextError =
          error instanceof Error
            ? error.message
            : "Unable to delete the requested meeting."

        setStatus("error")
        setErrorMessage(nextError)
        throw new Error(nextError)
      } finally {
        setActiveMeetingDeleteId(null)
      }
    },
    [getToken, isLoaded, isSignedIn]
  )

  return {
    meetings,
    status: authErrorMessage ? "error" : status,
    errorMessage: authErrorMessage || errorMessage,
    activeMeetingDeleteId,
    deleteMeeting: removeMeeting,
    refresh,
  }
}

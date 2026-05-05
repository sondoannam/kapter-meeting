import * as React from "react"
import { MEETING_STATUS } from "@kapter/contracts/domain"
import { useAuth } from "@clerk/react-router"

import { createNotionAuthorizationUrl } from "@/features/projects/api/notion-api"
import { buildMeetingDetailRoute } from "@/routes/routes.constants"

import {
  applyContextProposal,
  approveMeetingReview,
  dismissContextProposal,
  fetchMeetingDetail,
  retryMeetingExtraction,
  saveMeetingReview,
  syncMeetingToNotion,
} from "../api/meetings-api"
import type {
  DashboardMeetingDetail,
  MeetingNotionSyncResult,
  MeetingsRequestStatus,
  SaveMeetingReviewRequest,
} from "../types"

const LIVE_MEETING_STATUSES: ReadonlySet<string> = new Set([
  MEETING_STATUS.RECORDING,
  MEETING_STATUS.PROCESSING,
])
const POLLABLE_ARTIFACT_REVIEW_STATUSES: ReadonlySet<string> = new Set([
  "PENDING",
])

export function useMeetingDetail(
  meetingId: string | undefined,
  pollingMs = 5000
) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [meeting, setMeeting] = React.useState<DashboardMeetingDetail | null>(
    null
  )
  const [lastSyncResult, setLastSyncResult] =
    React.useState<MeetingNotionSyncResult | null>(null)
  const [status, setStatus] = React.useState<MeetingsRequestStatus>("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const authErrorMessage =
    isLoaded && !isSignedIn
      ? "Clerk session is not available for meeting detail."
      : null

  const refresh = React.useCallback(async () => {
    if (!meetingId || !isLoaded || !isSignedIn) {
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
          "Unable to mint a Clerk session token for meeting detail."
        )
      }

      const response = await fetchMeetingDetail(sessionToken, meetingId)

      setMeeting(response.meeting)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the requested meeting."
      )
    }
  }, [getToken, isLoaded, isSignedIn, meetingId])

  const runMeetingMutation = React.useCallback(
    async (
      mutation: (
        sessionToken: string,
        currentMeetingId: string
      ) => Promise<{
        meeting: DashboardMeetingDetail
      }>
    ) => {
      if (!meetingId || !isLoaded || !isSignedIn) {
        return
      }

      try {
        setErrorMessage(null)
        const sessionToken = await getToken()

        if (!sessionToken) {
          throw new Error("Unable to mint a Clerk session token.")
        }

        const response = await mutation(sessionToken, meetingId)

        setMeeting(response.meeting)
        setLastSyncResult(null)
        setStatus("ready")
      } catch (error) {
        setStatus("error")
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to update the meeting review."
        )
        throw error
      }
    },
    [getToken, isLoaded, isSignedIn, meetingId]
  )

  const saveReview = React.useCallback(
    async (payload: SaveMeetingReviewRequest) =>
      runMeetingMutation((sessionToken, currentMeetingId) =>
        saveMeetingReview(sessionToken, currentMeetingId, payload)
      ),
    [runMeetingMutation]
  )

  const approveReview = React.useCallback(
    async () =>
      runMeetingMutation((sessionToken, currentMeetingId) =>
        approveMeetingReview(sessionToken, currentMeetingId)
      ),
    [runMeetingMutation]
  )

  const approveCurrentReview = React.useCallback(
    async (payload: SaveMeetingReviewRequest) => {
      if (!meetingId || !isLoaded || !isSignedIn) {
        return
      }

      try {
        setErrorMessage(null)
        const sessionToken = await getToken()

        if (!sessionToken) {
          throw new Error("Unable to mint a Clerk session token.")
        }

        await saveMeetingReview(sessionToken, meetingId, payload)
        const response = await approveMeetingReview(sessionToken, meetingId)

        setMeeting(response.meeting)
        setLastSyncResult(null)
        setStatus("ready")
      } catch (error) {
        setStatus("error")
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to approve the current meeting review."
        )
        throw error
      }
    },
    [getToken, isLoaded, isSignedIn, meetingId]
  )

  const retryExtraction = React.useCallback(
    async () =>
      runMeetingMutation((sessionToken, currentMeetingId) =>
        retryMeetingExtraction(sessionToken, currentMeetingId)
      ),
    [runMeetingMutation]
  )

  const syncToNotion = React.useCallback(async () => {
    if (!meetingId || !isLoaded || !isSignedIn) {
      return
    }

    try {
      setErrorMessage(null)
      const sessionToken = await getToken()

      if (!sessionToken) {
        throw new Error("Unable to mint a Clerk session token.")
      }

      const response = await syncMeetingToNotion(sessionToken, meetingId)

      setMeeting(response.meeting)
      setLastSyncResult(response.sync)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sync approved meeting action items to Notion."
      )
      throw error
    }
  }, [getToken, isLoaded, isSignedIn, meetingId])

  const connectNotion = React.useCallback(async () => {
    if (!meetingId || !isLoaded || !isSignedIn) {
      return
    }

    setErrorMessage(null)
    const sessionToken = await getToken()

    if (!sessionToken) {
      throw new Error(
        "Unable to mint a Clerk session token for Notion connection."
      )
    }

    const response = await createNotionAuthorizationUrl(
      sessionToken,
      buildMeetingDetailRoute(meetingId)
    )

    window.location.assign(response.authUrl)
  }, [getToken, isLoaded, isSignedIn, meetingId])

  const applyProposal = React.useCallback(
    async (proposalId: string) =>
      runMeetingMutation((sessionToken, currentMeetingId) =>
        applyContextProposal(sessionToken, currentMeetingId, proposalId)
      ),
    [runMeetingMutation]
  )

  const dismissProposal = React.useCallback(
    async (proposalId: string) =>
      runMeetingMutation((sessionToken, currentMeetingId) =>
        dismissContextProposal(sessionToken, currentMeetingId, proposalId)
      ),
    [runMeetingMutation]
  )

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [refresh])

  React.useEffect(() => {
    if (!meetingId || !isLoaded || !isSignedIn || !meeting) {
      return
    }

    const shouldPollMeeting =
      LIVE_MEETING_STATUSES.has(meeting.status) ||
      POLLABLE_ARTIFACT_REVIEW_STATUSES.has(meeting.artifactReviewStatus)

    if (!shouldPollMeeting) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refresh()
    }, pollingMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isLoaded, isSignedIn, meeting, meetingId, pollingMs, refresh])

  return {
    meeting,
    lastSyncResult,
    status: authErrorMessage ? "error" : status,
    errorMessage: authErrorMessage || errorMessage,
    refresh,
    saveReview,
    approveReview,
    approveCurrentReview,
    retryExtraction,
    syncToNotion,
    connectNotion,
    applyProposal,
    dismissProposal,
  }
}

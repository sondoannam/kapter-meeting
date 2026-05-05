import { MEETING_STATUS } from "@kapter/contracts/domain"

import type { DashboardMeetingDetail } from "../types"

export type MeetingWorkflowStage =
  | "extracting"
  | "review"
  | "project-memory"
  | "notion-sync"
  | "complete"

export function getMeetingWorkflowStage(
  meeting: DashboardMeetingDetail
): MeetingWorkflowStage {
  if (
    meeting.status === MEETING_STATUS.RECORDING ||
    meeting.status === MEETING_STATUS.PROCESSING ||
    meeting.artifactReviewStatus === "PENDING"
  ) {
    return "extracting"
  }

  if (meeting.artifactReviewStatus !== "APPROVED") {
    return "review"
  }

  if (meeting.pendingContextProposal) {
    return "project-memory"
  }

  if (meeting.syncReadiness.unsyncedActionItemCount > 0) {
    return "notion-sync"
  }

  return "complete"
}

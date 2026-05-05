import * as React from "react"
import { MEETING_STATUS } from "@kapter/contracts/domain"

import { useMeetingHistory } from "@/features/meetings/hooks/use-meeting-history"

export function useStats() {
  const { meetings } = useMeetingHistory()

  return React.useMemo(() => {
    const statuses = meetings.reduce(
      (counts, meeting) => {
        const isProcessing =
          meeting.status === MEETING_STATUS.RECORDING ||
          meeting.status === MEETING_STATUS.PROCESSING

        if (isProcessing) {
          counts.processingCount += 1
          return counts
        }

        if (meeting.artifactReviewStatus === "READY") {
          counts.reviewCount += 1
        }

        if (meeting.artifactReviewStatus === "APPROVED") {
          counts.approvedCount += 1
        }

        return counts
      },
      {
        processingCount: 0,
        reviewCount: 0,
        approvedCount: 0,
      },
    )

    return { statuses }
  }, [meetings])
}

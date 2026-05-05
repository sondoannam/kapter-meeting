import { useParams } from "react-router"

import { MeetingDetailExperience } from "@/components/meeting-detail/meeting-detail-experience"
import { useMeetingDetail } from "@/features/meetings/hooks/use-meeting-detail"

export default function MeetingDetailPage() {
  const { meetingId } = useParams()
  const {
    meeting,
    lastSyncResult,
    status,
    errorMessage,
    refresh,
    saveReview,
    approveCurrentReview,
    retryExtraction,
    syncToNotion,
    connectNotion,
    applyProposal,
    dismissProposal,
  } = useMeetingDetail(meetingId)

  return (
    <MeetingDetailExperience
      errorMessage={errorMessage}
      lastSyncResult={lastSyncResult}
      meeting={meeting}
      onApplyProposal={applyProposal}
      onApproveCurrentReview={approveCurrentReview}
      onConnectNotion={connectNotion}
      onDismissProposal={dismissProposal}
      onRefresh={refresh}
      onRetryExtraction={retryExtraction}
      onSaveReview={saveReview}
      onSyncToNotion={syncToNotion}
      status={status}
    />
  )
}

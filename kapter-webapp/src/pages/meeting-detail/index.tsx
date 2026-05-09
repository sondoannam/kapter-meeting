import { useNavigate, useParams } from "react-router"

import { MeetingDetailExperience } from "@/components/meeting-detail/meeting-detail-experience"
import { useMeetingDetail } from "@/features/meetings/hooks/use-meeting-detail"
import { useProjects } from "@/features/projects/hooks/use-projects"

export default function MeetingDetailPage() {
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const {
    meeting,
    lastSyncResult,
    status,
    errorMessage,
    refresh,
    saveMetadata,
    saveReview,
    approveCurrentReview,
    retryExtraction,
    syncToNotion,
    connectNotion,
    applyProposal,
    dismissProposal,
    deleteMeeting,
  } = useMeetingDetail(meetingId)
  const { projects, status: projectsStatus } = useProjects({
    includeNotionConnection: false,
  })

  return (
    <MeetingDetailExperience
      errorMessage={errorMessage}
      lastSyncResult={lastSyncResult}
      meeting={meeting}
      onApplyProposal={applyProposal}
      onApproveCurrentReview={approveCurrentReview}
      onConnectNotion={connectNotion}
      onDeleteMeeting={async () => {
        await deleteMeeting()
        navigate("/dashboard")
      }}
      onDismissProposal={dismissProposal}
      onRefresh={refresh}
      onRetryExtraction={retryExtraction}
      onSaveMetadata={saveMetadata}
      onSaveReview={saveReview}
      onSyncToNotion={syncToNotion}
      projectOptions={projects}
      projectStatus={projectsStatus}
      status={status}
    />
  )
}

import { useNavigate, useParams } from "react-router"

import { MeetingDetailExperience } from "@/components/meeting-detail/meeting-detail-experience"
import { setStoredDashboardMode } from "@/features/dashboard/lib/dashboard-mode"
import { useMeetingDetail } from "@/features/meetings/hooks/use-meeting-detail"
import { useProjects } from "@/features/projects/hooks/use-projects"
import { useVoiceProfiles } from "@/features/voice-profiles/hooks/use-voice-profiles"

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
    linkSpeakerToVoiceProfile,
    promoteSpeakerToVoiceProfile,
    clearSpeakerVoiceProfileLink,
    deleteMeeting,
  } = useMeetingDetail(meetingId)
  const {
    voiceProfiles,
    status: voiceProfilesStatus,
    refresh: refreshVoiceProfiles,
  } = useVoiceProfiles()
  const { projects, status: projectsStatus } = useProjects({
    includeNotionConnection: false,
  })

  return (
    <MeetingDetailExperience
      errorMessage={errorMessage}
      lastSyncResult={lastSyncResult}
      meeting={meeting}
      onApplyProposal={applyProposal}
      onApproveCurrentReview={async (payload) => {
        await approveCurrentReview(payload)
        setStoredDashboardMode("standard")
      }}
      onConnectNotion={connectNotion}
      onDeleteMeeting={async () => {
        await deleteMeeting()
        navigate("/dashboard")
      }}
      onDismissProposal={dismissProposal}
      onClearSpeakerLink={async (speakerId) => {
        await clearSpeakerVoiceProfileLink(speakerId)
        await refreshVoiceProfiles()
      }}
      onLinkSpeaker={async (speakerId, voiceProfileId) => {
        await linkSpeakerToVoiceProfile(speakerId, voiceProfileId)
        await refreshVoiceProfiles()
      }}
      onPromoteSpeaker={async (speakerId, payload) => {
        await promoteSpeakerToVoiceProfile(speakerId, payload)
        await refreshVoiceProfiles()
      }}
      onRefresh={refresh}
      onRetryExtraction={retryExtraction}
      onSaveMetadata={saveMetadata}
      onSaveReview={saveReview}
      onSyncToNotion={syncToNotion}
      projectOptions={projects}
      projectStatus={projectsStatus}
      status={status}
      voiceProfiles={voiceProfiles}
      voiceProfilesStatus={voiceProfilesStatus}
    />
  )
}

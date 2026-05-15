import { useState } from "react"
import { MEETING_STATUS } from "@kapter/contracts/domain"
import { ArrowLeft, LoaderCircle, RefreshCw, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { AppShellContainer } from "@/components/app-shell-container"
import { MeetingDetailSkeleton } from "./meeting-detail-skeleton"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getMeetingWorkflowStage } from "@/features/meetings/lib/meeting-workflow-stage"
import { buildTranscriptTurns } from "@/features/meetings/lib/transcript-turns"
import { ROUTES } from "@/routes/routes.constants"

import { MeetingDetailOverview } from "./meeting-detail-overview"
import { MeetingDetailReviewPanel } from "./meeting-detail-review-panel"
import {
  MeetingNotionSyncCard,
  MeetingWorkflowRail,
  ProjectMemoryCard,
} from "./meeting-detail-sidebar"
import { MeetingDetailTranscriptPanel } from "./meeting-detail-transcript-panel"

import type {
  DashboardMeetingDetail,
  MeetingSpeakerPromotionRequest,
  MeetingNotionSyncResult,
  MeetingsRequestStatus,
  SaveMeetingReviewRequest,
} from "@/features/meetings/types"
import type {
  DashboardProjectSummary,
  ProjectsRequestStatus,
} from "@/features/projects/types"
import type { UpdateMeetingMetadataRequest } from "@/features/meetings/types"
import type {
  VoiceProfile,
  VoiceProfilesRequestStatus,
} from "@/features/voice-profiles/types"

interface MeetingDetailExperienceProps {
  lastSyncResult: MeetingNotionSyncResult | null
  meeting: DashboardMeetingDetail | null
  status: MeetingsRequestStatus
  errorMessage: string | null
  projectOptions: DashboardProjectSummary[]
  projectStatus: ProjectsRequestStatus
  onRefresh: () => Promise<void>
  onSaveMetadata: (payload: UpdateMeetingMetadataRequest) => Promise<void>
  onSaveReview: (payload: SaveMeetingReviewRequest) => Promise<void>
  onRetryExtraction: () => Promise<void>
  onApproveCurrentReview: (payload: SaveMeetingReviewRequest) => Promise<void>
  onSyncToNotion: () => Promise<void>
  onConnectNotion: () => Promise<void>
  onApplyProposal: (proposalId: string) => Promise<void>
  onDismissProposal: (proposalId: string) => Promise<void>
  onLinkSpeaker: (speakerId: string, voiceProfileId: string) => Promise<void>
  onPromoteSpeaker: (
    speakerId: string,
    payload: MeetingSpeakerPromotionRequest
  ) => Promise<void>
  onClearSpeakerLink: (speakerId: string) => Promise<void>
  onDeleteMeeting: () => Promise<void>
  voiceProfiles: VoiceProfile[]
  voiceProfilesStatus: VoiceProfilesRequestStatus
}

export function MeetingDetailExperience({
  lastSyncResult,
  meeting,
  status,
  errorMessage,
  projectOptions,
  projectStatus,
  onRefresh,
  onSaveMetadata,
  onSaveReview,
  onRetryExtraction,
  onApproveCurrentReview,
  onSyncToNotion,
  onConnectNotion,
  onApplyProposal,
  onDismissProposal,
  onLinkSpeaker,
  onPromoteSpeaker,
  onClearSpeakerLink,
  onDeleteMeeting,
  voiceProfiles,
  voiceProfilesStatus,
}: MeetingDetailExperienceProps) {
  const { t } = useTranslation(["meeting", "common"])
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (status === "loading" && !meeting) {
    return <MeetingDetailLoadingState />
  }

  if (!meeting) {
    return (
      <MeetingDetailUnavailableState
        errorMessage={errorMessage}
        onRefresh={onRefresh}
      />
    )
  }

  const isLive =
    meeting.status === MEETING_STATUS.RECORDING ||
    meeting.status === MEETING_STATUS.PROCESSING
  const transcriptTurns = buildTranscriptTurns(meeting.transcriptSegments)
  const workflowStage = getMeetingWorkflowStage(meeting)

  const handleDeleteMeeting = async () => {
    setDeleteError(null)
    setIsDeletingMeeting(true)

    try {
      await onDeleteMeeting()
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : t("detailExperience.deleteMeetingError", { ns: "meeting" })
      )
      setIsDeletingMeeting(false)
    }
  }

  return (
    <AppShellContainer className="flex min-h-[calc(100svh-6rem)] flex-col gap-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link to={ROUTES.DASHBOARD}>
            <ArrowLeft />
            {t("actions.backToDashboard", { ns: "common" })}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void onRefresh()} variant="outline">
            <RefreshCw />
            {t("detailExperience.refreshSnapshot", { ns: "meeting" })}
          </Button>
          <Button
            onClick={() => {
              setDeleteError(null)
              setIsDeleteDialogOpen(true)
            }}
            variant="destructive"
          >
            <Trash2 />
            {t("detailExperience.deleteMeeting", { ns: "meeting" })}
          </Button>
        </div>
      </div>

      <MeetingDetailOverview
        isLive={isLive}
        meeting={meeting}
        onSaveMetadata={onSaveMetadata}
        projectOptions={projectOptions}
        projectStatus={projectStatus}
        rawTranscriptSegmentCount={meeting.processing.transcriptSegmentCount}
        transcriptTurnCount={transcriptTurns.length}
        workflowStage={workflowStage}
      />

      <MeetingWorkflowRail currentStage={workflowStage} layout="landscape" />

      <div className="min-w-0">
        <MeetingDetailReviewPanel
          key={`${meeting.id}-${meeting.updatedAt}-${meeting.artifactReviewStatus}`}
          meeting={meeting}
          onApproveCurrentReview={onApproveCurrentReview}
          onRetryExtraction={onRetryExtraction}
          onSaveReview={onSaveReview}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ProjectMemoryCard
          meeting={meeting}
          onApplyProposal={onApplyProposal}
          onClearSpeakerLink={onClearSpeakerLink}
          onDismissProposal={onDismissProposal}
          onLinkSpeaker={onLinkSpeaker}
          onPromoteSpeaker={onPromoteSpeaker}
          voiceProfiles={voiceProfiles}
          voiceProfilesStatus={voiceProfilesStatus}
        />
        <MeetingNotionSyncCard
          lastSyncResult={lastSyncResult}
          meeting={meeting}
          onConnectNotion={onConnectNotion}
          onSyncToNotion={onSyncToNotion}
        />
      </div>

      <section className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {t("detailExperience.transcriptEyebrow", { ns: "meeting" })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("detailExperience.transcriptDescription", {
                ns: "meeting",
              })}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            {t("detailExperience.transcriptSummary", {
              ns: "meeting",
              turns: transcriptTurns.length,
              fragments: meeting.processing.transcriptSegmentCount,
            })}
          </p>
        </div>

        <div className="h-[24rem] xl:h-[28rem]">
          <MeetingDetailTranscriptPanel
            isLive={isLive}
            rawTranscriptSegmentCount={
              meeting.processing.transcriptSegmentCount
            }
            turns={transcriptTurns}
          />
        </div>
      </section>

      {status === "error" && errorMessage ? (
        <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("detailExperience.deleteDialogTitle", { ns: "meeting" })}
            </DialogTitle>
            <DialogDescription>
              {t("detailExperience.deleteDialogDescription", {
                ns: "meeting",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[1.3rem] border border-destructive/20 bg-destructive/8 px-4 py-4 dark:border-destructive/30 dark:bg-destructive/16">
              <p className="text-[11px] font-medium tracking-[0.12em] text-destructive uppercase">
                {t("detailExperience.deleteMeetingSignal", { ns: "meeting" })}
              </p>
              <p className="mt-2 text-base font-medium text-foreground">
                {meeting.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("detailExperience.deleteMeetingHint", {
                  ns: "meeting",
                  project:
                    meeting.projectTitle ??
                    t("overview.draftProject", { ns: "meeting" }),
                })}
              </p>
            </div>

            {deleteError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {deleteError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setDeleteError(null)
              }}
              type="button"
              variant="outline"
            >
              {t("actions.cancel", { ns: "common" })}
            </Button>
            <Button
              disabled={isDeletingMeeting}
              onClick={() => void handleDeleteMeeting()}
              type="button"
              variant="destructive"
            >
              {isDeletingMeeting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              {isDeletingMeeting
                ? t("detailExperience.deletingMeeting", { ns: "meeting" })
                : t("detailExperience.deleteMeetingConfirm", {
                    ns: "meeting",
                  })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShellContainer>
  )
}

function MeetingDetailLoadingState() {
  return <MeetingDetailSkeleton />
}

function MeetingDetailUnavailableState({
  errorMessage,
  onRefresh,
}: {
  errorMessage: string | null
  onRefresh: () => Promise<void>
}) {
  const { t } = useTranslation(["meeting", "common"])

  return (
    <AppShellContainer className="flex flex-col gap-6 py-8" width="narrow">
      <Button asChild className="w-fit" variant="outline">
        <Link to={ROUTES.DASHBOARD}>
          <ArrowLeft />
          {t("actions.backToDashboard", { ns: "common" })}
        </Link>
      </Button>

      <Card className="border-border/70 bg-background/92 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))]">
        <CardHeader>
          <CardTitle>
            {t("detailExperience.unavailableTitle", { ns: "meeting" })}
          </CardTitle>
          <CardDescription>
            {t("detailExperience.unavailableDescription", { ns: "meeting" })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/8 px-4 py-4 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {errorMessage ||
              t("detailExperience.unavailableFallback", { ns: "meeting" })}
          </div>

          <Button onClick={() => void onRefresh()} variant="outline">
            <RefreshCw />
            {t("actions.retry", { ns: "common" })}
          </Button>
        </CardContent>
      </Card>
    </AppShellContainer>
  )
}

import { MEETING_STATUS } from "@kapter/contracts/domain"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { AppShellContainer } from "@/components/app-shell-container"
import { AppLoadingScreen } from "@/components/app-loading-screen"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  MeetingNotionSyncResult,
  MeetingsRequestStatus,
  SaveMeetingReviewRequest,
} from "@/features/meetings/types"

interface MeetingDetailExperienceProps {
  lastSyncResult: MeetingNotionSyncResult | null
  meeting: DashboardMeetingDetail | null
  status: MeetingsRequestStatus
  errorMessage: string | null
  onRefresh: () => Promise<void>
  onSaveReview: (payload: SaveMeetingReviewRequest) => Promise<void>
  onRetryExtraction: () => Promise<void>
  onApproveCurrentReview: (payload: SaveMeetingReviewRequest) => Promise<void>
  onSyncToNotion: () => Promise<void>
  onConnectNotion: () => Promise<void>
  onApplyProposal: (proposalId: string) => Promise<void>
  onDismissProposal: (proposalId: string) => Promise<void>
}

export function MeetingDetailExperience({
  lastSyncResult,
  meeting,
  status,
  errorMessage,
  onRefresh,
  onSaveReview,
  onRetryExtraction,
  onApproveCurrentReview,
  onSyncToNotion,
  onConnectNotion,
  onApplyProposal,
  onDismissProposal,
}: MeetingDetailExperienceProps) {
  const { t } = useTranslation(["meeting", "common"])

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

  return (
    <AppShellContainer className="flex min-h-[calc(100svh-6rem)] flex-col gap-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link to={ROUTES.DASHBOARD}>
            <ArrowLeft />
            {t("actions.backToDashboard", { ns: "common" })}
          </Link>
        </Button>

        <Button onClick={() => void onRefresh()} variant="outline">
          <RefreshCw />
          {t("detailExperience.refreshSnapshot", { ns: "meeting" })}
        </Button>
      </div>

      <MeetingDetailOverview
        isLive={isLive}
        meeting={meeting}
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
          onDismissProposal={onDismissProposal}
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
    </AppShellContainer>
  )
}

function MeetingDetailLoadingState() {
  const { t } = useTranslation("meeting")

  return (
    <AppLoadingScreen
      className="min-h-[calc(100svh-8.5rem)]"
      description={t("detailExperience.loadingDescription")}
      title={t("detailExperience.loadingTitle")}
      steps={t("detailExperience.loadingSteps", {
        returnObjects: true,
      }) as string[]}
    />
  )
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
          <CardTitle>{t("detailExperience.unavailableTitle", { ns: "meeting" })}</CardTitle>
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

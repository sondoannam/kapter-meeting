import { FileStack, LoaderCircle, Radar, Users } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { MeetingStatusBadge } from "@/features/meetings/components/meeting-status-badge"
import { ReviewStatusBadge } from "@/features/meetings/components/review-status-badge"
import {
  formatMeetingDateTime,
  formatMeetingTimeline,
} from "@/features/meetings/lib/formatters"
import type { MeetingWorkflowStage } from "@/features/meetings/lib/meeting-workflow-stage"
import type { DashboardMeetingDetail } from "@/features/meetings/types"

const workflowStageTones: Record<
  MeetingWorkflowStage,
  "info" | "warning" | "neutral" | "success"
> = {
  extracting: "info",
  review: "warning",
  "project-memory": "warning",
  "notion-sync": "info",
  complete: "success",
}

interface MeetingDetailOverviewProps {
  meeting: DashboardMeetingDetail
  isLive: boolean
  transcriptTurnCount: number
  rawTranscriptSegmentCount: number
  workflowStage: MeetingWorkflowStage
}

export function MeetingDetailOverview({
  meeting,
  isLive,
  transcriptTurnCount,
  rawTranscriptSegmentCount,
  workflowStage,
}: MeetingDetailOverviewProps) {
  const { t } = useTranslation("meeting")
  const completedPercent =
    meeting.processing.totalBatches > 0
      ? Math.round(
          (meeting.processing.completedBatches /
            meeting.processing.totalBatches) *
            100
        )
      : 0
  const captureContextLabel =
    meeting.captureContext === "google_meet_room"
      ? t("overview.googleMeet")
      : meeting.captureContext === "generic_tab"
        ? t("overview.genericTab")
        : t("overview.unknownCapture")
  const audioLaneLabel =
    meeting.activeSourceTypes.length === 0
      ? t("overview.noSourceMetadata")
      : meeting.activeSourceTypes
          .map((sourceType) =>
            sourceType === "self_mic"
              ? t("overview.selfMic")
              : t("overview.tabMix")
          )
          .join(" + ")
  const workflowStageLabels: Record<MeetingWorkflowStage, string> = {
    extracting: t("overview.workflowStages.extracting"),
    review: t("overview.workflowStages.review"),
    "project-memory": t("overview.workflowStages.project-memory"),
    "notion-sync": t("overview.workflowStages.notion-sync"),
    complete: t("overview.workflowStages.complete"),
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,_1fr)_22rem] xl:items-start">
      <Card className="border-border/70 bg-background/88 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.84))]">
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_22rem] xl:items-start">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <MeetingStatusBadge status={meeting.status} />
                <StatusBadge tone={workflowStageTones[workflowStage]}>
                  {workflowStageLabels[workflowStage]}
                </StatusBadge>
                <ReviewStatusBadge
                  reviewStatus={meeting.artifactReviewStatus}
                />
                <StatusBadge tone="neutral">{captureContextLabel}</StatusBadge>
                <StatusBadge
                  tone={meeting.degradedWithoutSelfMic ? "warning" : "success"}
                >
                  {meeting.degradedWithoutSelfMic
                    ? t("overview.micDegraded")
                    : meeting.captureContext === "google_meet_room"
                      ? t("overview.recorderMicActive")
                      : t("overview.tabOnlyCapture")}
                </StatusBadge>
                {isLive ? (
                  <StatusBadge tone="info">
                    <LoaderCircle className="size-4 animate-spin" />
                    {t("overview.liveRefreshEnabled")}
                  </StatusBadge>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
                  {meeting.title}
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  {formatMeetingTimeline(
                    meeting.createdAt,
                    meeting.totalDurationMs
                  )}
                </p>
                <CardDescription className="max-w-2xl text-sm leading-6">
                  {t("overview.workflowDescription")}
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewStatCard
              helper={t("overview.batchProgressHelper", {
                completed: meeting.processing.completedBatches,
                total: meeting.processing.totalBatches,
              })}
              icon={<Radar className="size-4" />}
              label={t("overview.batchProgress")}
              value={`${completedPercent}%`}
            />
            <OverviewStatCard
              helper={t("overview.speakersHelper")}
              icon={<Users className="size-4" />}
              label={t("overview.speakers")}
              value={String(meeting.speakers.length)}
            />
            <OverviewStatCard
              helper={t("overview.transcriptHelper")}
              icon={<FileStack className="size-4" />}
              label={t("overview.transcript")}
              value={String(transcriptTurnCount)}
            />
            <OverviewStatCard
              helper={t("overview.latestBatchHelper")}
              icon={<FileStack className="size-4" />}
              label={t("overview.latestBatch")}
              value={
                meeting.artifactProcessing.latestProcessedAt
                  ? formatMeetingDateTime(
                      meeting.artifactProcessing.latestProcessedAt
                    )
                  : t("overview.waiting")
              }
            />
          </div>

          {meeting.artifactExtractionError ? (
            <div className="rounded-[1.35rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
              {meeting.artifactExtractionError}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <InlineStat
          label={t("overview.project")}
          value={meeting.projectTitle ?? t("overview.draftProject")}
        />
        <InlineStat
          label={t("overview.tasks")}
          value={t("overview.tasksValue", {
            count: meeting.actionItems.length,
          })}
        />
        <InlineStat
          label={t("overview.pendingSync")}
          value={t("overview.pendingSyncValue", {
            count: meeting.syncReadiness.unsyncedActionItemCount,
          })}
        />
        <InlineStat label={t("overview.captureMode")} value={captureContextLabel} />
        <InlineStat label={t("overview.audioLanes")} value={audioLaneLabel} />
        <InlineStat
          label={t("overview.transcript")}
          value={t("overview.transcriptValue", {
            turns: transcriptTurnCount,
            fragments: rawTranscriptSegmentCount,
          })}
        />
        <InlineStat
          label={t("overview.identifiers")}
          value={meeting.externalMeetingId ?? t("overview.missingExternalId")}
        />
        <InlineStat
          label={t("overview.approval")}
          value={
            meeting.artifactApprovedAt
              ? formatMeetingDateTime(meeting.artifactApprovedAt)
              : meeting.artifactReviewStatus === "APPROVED"
                ? t("overview.approved")
                : t("overview.waitingForApproval")
          }
        />
      </div>
    </div>
  )
}

function OverviewStatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-[1.1rem] border border-border/80 bg-background px-4 py-3 dark:border-white/10 dark:bg-slate-950/55">
      <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-heading text-xl text-foreground">{value}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{helper}</p>
    </div>
  )
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/88 px-3 py-3 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.84))]">
      <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

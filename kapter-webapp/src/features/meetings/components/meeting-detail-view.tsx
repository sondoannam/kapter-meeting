import * as React from "react"
import { MEETING_STATUS } from "@kapter/contracts/domain"
import {
  ArrowLeft,
  Clock3,
  CheckCircle2,
  FileStack,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  Radar,
} from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ROUTES } from "@/routes/routes.constants"

import { formatDuration, formatMeetingDateTime } from "../lib/formatters"
import {
  getMeetingWorkflowStage,
  type MeetingWorkflowStage,
} from "../lib/meeting-workflow-stage"
import { buildTranscriptTurns } from "../lib/transcript-turns"
import type {
  ActionItemStatus,
  DashboardMeetingDetail,
  MeetingNotionSyncResult,
  MeetingsRequestStatus,
  SaveMeetingReviewRequest,
} from "../types"
import { MeetingSpeakerRoster } from "./meeting-speaker-roster"
import { MeetingStatusBadge } from "./meeting-status-badge"
import { MeetingTranscriptFeed } from "./meeting-transcript-feed"

interface MeetingDetailViewProps {
  lastSyncResult: MeetingNotionSyncResult | null
  meeting: DashboardMeetingDetail | null
  status: MeetingsRequestStatus
  errorMessage: string | null
  onRefresh: () => Promise<void>
  onSaveReview: (payload: SaveMeetingReviewRequest) => Promise<void>
  onRetryExtraction: () => Promise<void>
  onApproveCurrentReview: (payload: SaveMeetingReviewRequest) => Promise<void>
  onSyncToNotion: () => Promise<void>
  onApplyProposal: (proposalId: string) => Promise<void>
  onDismissProposal: (proposalId: string) => Promise<void>
}

interface ReviewTaskDraft {
  taskContent: string
  deadline: string
  assigneeId: string
  status: ActionItemStatus
}

const actionItemStatuses: ActionItemStatus[] = ["TODO", "IN_PROGRESS", "DONE"]

const actionItemStatusLabels: Record<ActionItemStatus, string> = {
  TODO: "Todo",
  IN_PROGRESS: "In progress",
  DONE: "Done",
}

const toDateInputValue = (value: string | null): string =>
  value ? value.slice(0, 10) : ""

export function MeetingDetailView({
  lastSyncResult,
  meeting,
  status,
  errorMessage,
  onRefresh,
  onSaveReview,
  onRetryExtraction,
  onApproveCurrentReview,
  onSyncToNotion,
  onApplyProposal,
  onDismissProposal,
}: MeetingDetailViewProps) {
  if (status === "loading" && !meeting) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="h-10 w-44 animate-pulse rounded-full bg-muted" />
        <div className="h-56 animate-pulse rounded-[2rem] bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="h-[32rem] animate-pulse rounded-[2rem] bg-muted" />
          <div className="h-[32rem] animate-pulse rounded-[2rem] bg-muted" />
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <Button asChild className="w-fit" variant="outline">
          <Link to={ROUTES.DASHBOARD}>
            <ArrowLeft />
            Back to dashboard
          </Link>
        </Button>

        <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))]">
          <CardHeader>
            <CardTitle>Meeting unavailable</CardTitle>
            <CardDescription>
              The requested meeting detail could not be loaded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/8 px-4 py-4 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
              {errorMessage ||
                "The meeting may not exist or may not belong to the current user."}
            </div>

            <Button onClick={() => void onRefresh()} variant="outline">
              <RefreshCw />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isLive =
    meeting.status === MEETING_STATUS.RECORDING ||
    meeting.status === MEETING_STATUS.PROCESSING
  const completedPercent =
    meeting.processing.totalBatches > 0
      ? Math.round(
          (meeting.processing.completedBatches /
            meeting.processing.totalBatches) *
            100
        )
      : 0

  const transcriptTurns = buildTranscriptTurns(meeting.transcriptSegments)
  const rawTranscriptSegmentCount = meeting.processing.transcriptSegmentCount
  const workflowStage = getMeetingWorkflowStage(meeting)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link to={ROUTES.DASHBOARD}>
            <ArrowLeft />
            Back to dashboard
          </Link>
        </Button>

        <Button onClick={() => void onRefresh()} variant="outline">
          <RefreshCw />
          Refresh
        </Button>
      </div>

      <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <MeetingStatusBadge status={meeting.status} />
              {isLive ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary dark:text-orange-200">
                  <LoaderCircle className="animate-spin" />
                  Polling live backend results
                </span>
              ) : null}
            </div>

            <div>
              <CardTitle className="text-3xl sm:text-4xl">
                {meeting.title}
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-sm leading-6">
                {meeting.projectTitle
                  ? `Project: ${meeting.projectTitle}`
                  : "This meeting is attached to a draft project."}
                {meeting.externalMeetingId
                  ? ` External meeting reference: ${meeting.externalMeetingId}.`
                  : " No external Google Meet identifier is attached yet."}
              </CardDescription>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border/80 bg-background px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
            <p>Created {formatMeetingDateTime(meeting.createdAt)}</p>
            <p className="mt-1">
              Updated {formatMeetingDateTime(meeting.updatedAt)}
            </p>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-[1.75rem] border border-border/80 bg-background p-5 dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              <Clock3 className="size-4" />
              Duration
            </div>
            <p className="mt-4 font-heading text-4xl text-foreground">
              {formatDuration(meeting.totalDurationMs)}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-border/80 bg-background p-5 dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              <FileStack className="size-4" />
              Transcript
            </div>
            <p className="mt-4 font-heading text-4xl text-foreground">
              {transcriptTurns.length}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Visible speaker turn(s)
            </p>
            {rawTranscriptSegmentCount !== transcriptTurns.length ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Merged from {rawTranscriptSegmentCount} stored fragment(s)
              </p>
            ) : null}
          </div>

          <div className="rounded-[1.75rem] border border-border/80 bg-background p-5 dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              <Radar className="size-4" />
              Speakers
            </div>
            <p className="mt-4 font-heading text-4xl text-foreground">
              {meeting.speakers.length}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Detected profile(s)
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-border/80 bg-background p-5 dark:border-white/10 dark:bg-slate-950/55">
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Batch progress
            </p>
            <p className="mt-4 font-heading text-4xl text-foreground">
              {completedPercent}%
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {meeting.processing.completedBatches}/
              {meeting.processing.totalBatches} completed batch(es)
            </p>
          </div>
        </CardContent>
      </Card>

      <MeetingWorkflowRail currentStage={workflowStage} />

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          {workflowStage === "extracting" ? (
            <MeetingProcessingStep meeting={meeting} />
          ) : null}

          {workflowStage === "review" ? (
            <MeetingReviewPanel
              key={`${meeting.id}-${meeting.updatedAt}-${meeting.artifactReviewStatus}`}
              meeting={meeting}
              onApproveCurrentReview={onApproveCurrentReview}
              onRetryExtraction={onRetryExtraction}
              onSaveReview={onSaveReview}
            />
          ) : null}

          {workflowStage === "project-memory" ? (
            <ProjectMemoryPanel
              meeting={meeting}
              onApplyProposal={onApplyProposal}
              onDismissProposal={onDismissProposal}
            />
          ) : null}

          {workflowStage === "notion-sync" || workflowStage === "complete" ? (
            <MeetingNotionSyncPanel
              lastSyncResult={lastSyncResult}
              meeting={meeting}
              onSyncToNotion={onSyncToNotion}
            />
          ) : null}

          <MeetingTranscriptFeed isLive={isLive} turns={transcriptTurns} />
        </div>

        <div className="space-y-6">
          {workflowStage !== "project-memory" ? (
            <ProjectMemoryPanel
              meeting={meeting}
              onApplyProposal={onApplyProposal}
              onDismissProposal={onDismissProposal}
            />
          ) : null}

          {workflowStage !== "notion-sync" && workflowStage !== "complete" ? (
            <MeetingNotionSyncPanel
              lastSyncResult={lastSyncResult}
              meeting={meeting}
              onSyncToNotion={onSyncToNotion}
            />
          ) : null}

          <MeetingSpeakerRoster speakers={meeting.speakers} />
        </div>
      </div>

      {status === "error" && errorMessage ? (
        <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}

const workflowSteps: Array<{
  stage: MeetingWorkflowStage
  title: string
  description: string
}> = [
  {
    stage: "extracting",
    title: "Extraction",
    description:
      "Wait for capture, transcript batches, and chunked artifact extraction.",
  },
  {
    stage: "review",
    title: "Review",
    description:
      "Edit the summary and tasks before locking the meeting record.",
  },
  {
    stage: "project-memory",
    title: "Project memory",
    description:
      "Accept or skip the proposed context update for future meetings.",
  },
  {
    stage: "notion-sync",
    title: "Notion sync",
    description:
      "Manually sync approved tasks once the project destination is ready.",
  },
  {
    stage: "complete",
    title: "Complete",
    description:
      "The approved meeting has no pending memory or sync work left.",
  },
]

function MeetingWorkflowRail({
  currentStage,
}: {
  currentStage: MeetingWorkflowStage
}) {
  const currentIndex = workflowSteps.findIndex(
    (step) => step.stage === currentStage
  )

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <CardHeader>
        <CardTitle>Meeting workflow</CardTitle>
        <CardDescription>
          Kapter now guides this page step by step instead of treating review,
          project memory, and sync as one flat surface.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 xl:grid-cols-5">
        {workflowSteps.map((step, index) => {
          const isCurrent = index === currentIndex
          const isComplete = index < currentIndex
          const stateLabel = isCurrent
            ? step.stage === "complete"
              ? "Done"
              : "Current"
            : isComplete
              ? "Done"
              : "Next"

          return (
            <div
              className={[
                "rounded-[1.25rem] border px-4 py-4 transition",
                isCurrent
                  ? "border-primary/40 bg-primary/10 dark:border-primary/50 dark:bg-primary/14"
                  : isComplete
                    ? "border-emerald-500/20 bg-emerald-500/10 dark:border-emerald-500/30 dark:bg-emerald-500/14"
                    : "border-border/70 bg-muted/25 dark:border-white/10 dark:bg-white/4",
              ].join(" ")}
              key={step.stage}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Step {index + 1}
                </span>
                <span className="rounded-full border border-current/10 px-2 py-0.5 text-[11px] font-medium text-foreground/80 uppercase">
                  {stateLabel}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {step.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {step.description}
              </p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function MeetingProcessingStep({
  meeting,
}: {
  meeting: DashboardMeetingDetail
}) {
  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <CardHeader>
        <CardTitle>
          {meeting.status === MEETING_STATUS.RECORDING
            ? "Capture still running"
            : "Extraction still running"}
        </CardTitle>
        <CardDescription>
          Review unlocks after the backend finishes the current transcript and
          artifact-processing work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[1.25rem] border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground dark:border-primary/30 dark:bg-primary/12">
          {meeting.status === MEETING_STATUS.RECORDING
            ? "The extension is still streaming audio. Kapter keeps polling until recording stops and artifact extraction finishes."
            : "Chunked artifact extraction is still running in the background. This page refreshes automatically while work remains pending."}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Audio batches
            </p>
            <p className="mt-2 text-2xl font-medium text-foreground">
              {meeting.processing.completedBatches}/
              {meeting.processing.totalBatches}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed backend transcript batches
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Extraction chunks
            </p>
            <p className="mt-2 text-2xl font-medium text-foreground">
              {meeting.artifactProcessing.completedChunks}/
              {meeting.artifactProcessing.totalChunks}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed summary and task windows
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Pending chunks
            </p>
            <p className="mt-2 text-2xl font-medium text-foreground">
              {meeting.artifactProcessing.pendingChunks}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Remaining extraction work before review
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Draft state
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {meeting.artifactProcessing.finalizationStatus ?? "Pending"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {meeting.artifactProcessing.latestProcessedAt
                ? `Latest chunk ${formatMeetingDateTime(
                    meeting.artifactProcessing.latestProcessedAt
                  )}`
                : "Waiting for the first completed extraction chunk"}
            </p>
          </div>
        </div>

        {meeting.artifactExtractionError ? (
          <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {meeting.artifactExtractionError}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface MeetingReviewPanelProps {
  meeting: DashboardMeetingDetail
  onSaveReview: (payload: SaveMeetingReviewRequest) => Promise<void>
  onRetryExtraction: () => Promise<void>
  onApproveCurrentReview: (payload: SaveMeetingReviewRequest) => Promise<void>
}

function MeetingReviewPanel({
  meeting,
  onSaveReview,
  onRetryExtraction,
  onApproveCurrentReview,
}: MeetingReviewPanelProps) {
  const [summaryDraft, setSummaryDraft] = React.useState(meeting.summary ?? "")
  const [taskDrafts, setTaskDrafts] = React.useState<ReviewTaskDraft[]>(
    meeting.actionItems.map((actionItem) => ({
      taskContent: actionItem.taskContent,
      deadline: toDateInputValue(actionItem.deadline),
      assigneeId: actionItem.assigneeId ?? "",
      status: actionItem.status,
    }))
  )
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [mutationStatus, setMutationStatus] = React.useState<
    "idle" | "saving" | "retrying" | "approving"
  >("idle")
  const isApproved = meeting.artifactReviewStatus === "APPROVED"
  const isMutating = mutationStatus !== "idle"
  const canSaveReview = summaryDraft.trim().length > 0 && !isMutating
  const canApproveReview =
    !isApproved &&
    meeting.artifactReviewStatus !== "PENDING" &&
    summaryDraft.trim().length > 0 &&
    !isMutating
  const canRetryExtraction =
    !isApproved &&
    meeting.artifactReviewStatus !== "PENDING" &&
    meeting.transcriptSegments.length > 0 &&
    meeting.status !== MEETING_STATUS.RECORDING &&
    !isMutating

  const updateTaskDraft = (index: number, patch: Partial<ReviewTaskDraft>) => {
    setTaskDrafts((currentDrafts) =>
      currentDrafts.map((task, taskIndex) =>
        taskIndex === index ? { ...task, ...patch } : task
      )
    )
  }

  const runMutation = async (
    nextStatus: typeof mutationStatus,
    action: () => Promise<void>
  ) => {
    setMutationStatus(nextStatus)
    setMutationError(null)

    try {
      await action()
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "Unable to update review."
      )
    } finally {
      setMutationStatus("idle")
    }
  }

  const buildReviewPayload = (): SaveMeetingReviewRequest => ({
    summary: summaryDraft,
    actionItems: taskDrafts
      .map((task) => ({
        taskContent: task.taskContent.trim(),
        deadline: task.deadline ? `${task.deadline}T00:00:00.000Z` : null,
        assigneeId: task.assigneeId || null,
        status: task.status,
      }))
      .filter((task) => task.taskContent.length > 0),
  })

  const handleSaveReview = async () => {
    await runMutation("saving", () => onSaveReview(buildReviewPayload()))
  }

  const handleApproveReview = async () => {
    await runMutation("approving", () =>
      onApproveCurrentReview(buildReviewPayload())
    )
  }

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Review Extraction</CardTitle>
          <CardDescription>
            Edit the local summary and task drafts. Approving the meeting saves
            the current review and advances the workflow to project memory.
          </CardDescription>
        </div>
        <span className="rounded-full border border-border/80 px-3 py-1 text-xs font-medium text-muted-foreground uppercase dark:border-white/10">
          {meeting.artifactReviewStatus}
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        {meeting.artifactExtractionError ? (
          <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {meeting.artifactExtractionError}
          </div>
        ) : null}

        {meeting.artifactReviewStatus === "PENDING" ? (
          <div className="space-y-3">
            <div className="rounded-[1.25rem] border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground dark:border-primary/30 dark:bg-primary/12">
              Extraction is still running in the background. This page will
              refresh automatically when review becomes available.
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
                <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Chunks
                </p>
                <p className="mt-2 text-2xl font-medium text-foreground">
                  {meeting.artifactProcessing.totalChunks}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
                <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Completed
                </p>
                <p className="mt-2 text-2xl font-medium text-foreground">
                  {meeting.artifactProcessing.completedChunks}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
                <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Pending
                </p>
                <p className="mt-2 text-2xl font-medium text-foreground">
                  {meeting.artifactProcessing.pendingChunks}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
                <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Draft state
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {meeting.artifactProcessing.finalizationStatus ?? "Pending"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {meeting.artifactProcessing.latestProcessedAt
                    ? `Latest chunk ${formatMeetingDateTime(
                        meeting.artifactProcessing.latestProcessedAt
                      )}`
                    : "Waiting for first completed extraction chunk"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Summary
          </label>
          <textarea
            className="min-h-36 w-full rounded-[1.25rem] border border-border/80 bg-background px-4 py-3 text-sm leading-7 text-foreground transition outline-none focus:border-primary dark:border-white/10 dark:bg-slate-950/55"
            onChange={(event) => setSummaryDraft(event.target.value)}
            placeholder="Extraction has not produced a summary yet."
            value={summaryDraft}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Action items
            </p>
            <Button
              onClick={() =>
                setTaskDrafts((currentDrafts) => [
                  ...currentDrafts,
                  {
                    taskContent: "",
                    deadline: "",
                    assigneeId: "",
                    status: "TODO",
                  },
                ])
              }
              type="button"
              variant="outline"
            >
              <Plus />
              Add task
            </Button>
          </div>

          {taskDrafts.length > 0 ? (
            <div className="space-y-3">
              {taskDrafts.map((task, index) => (
                <div
                  className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4"
                  key={`${index}-${task.status}`}
                >
                  <textarea
                    className="min-h-20 rounded-[1rem] border border-border/80 bg-background px-3 py-2 text-sm leading-6 text-foreground transition outline-none focus:border-primary dark:border-white/10 dark:bg-slate-950/55"
                    onChange={(event) =>
                      updateTaskDraft(index, {
                        taskContent: event.target.value,
                      })
                    }
                    placeholder="Describe the follow-up task"
                    value={task.taskContent}
                  />
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      className="rounded-[1rem] border border-border/80 bg-background px-3 py-2 text-sm text-foreground dark:border-white/10 dark:bg-slate-950/55"
                      onChange={(event) =>
                        updateTaskDraft(index, {
                          status: event.target.value as ActionItemStatus,
                        })
                      }
                      value={task.status}
                    >
                      {actionItemStatuses.map((itemStatus) => (
                        <option key={itemStatus} value={itemStatus}>
                          {actionItemStatusLabels[itemStatus]}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-[1rem] border border-border/80 bg-background px-3 py-2 text-sm text-foreground dark:border-white/10 dark:bg-slate-950/55"
                      onChange={(event) =>
                        updateTaskDraft(index, {
                          assigneeId: event.target.value,
                        })
                      }
                      value={task.assigneeId}
                    >
                      <option value="">Unassigned</option>
                      {meeting.speakers.map((speaker) => (
                        <option key={speaker.id} value={speaker.id}>
                          {speaker.realName || speaker.aiLabel}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-[1rem] border border-border/80 bg-background px-3 py-2 text-sm text-foreground dark:border-white/10 dark:bg-slate-950/55"
                      onChange={(event) =>
                        updateTaskDraft(index, {
                          deadline: event.target.value,
                        })
                      }
                      type="date"
                      value={task.deadline}
                    />
                  </div>
                  <Button
                    className="w-fit"
                    onClick={() =>
                      setTaskDrafts((currentDrafts) =>
                        currentDrafts.filter(
                          (_task, taskIndex) => taskIndex !== index
                        )
                      )
                    }
                    type="button"
                    variant="outline"
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-4 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/4">
              No action items yet. Add one manually if the transcript contains a
              concrete follow-up.
            </p>
          )}
        </div>

        {isApproved ? (
          <div className="flex items-center gap-2 rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
            <CheckCircle2 className="size-4" />
            Approved for project memory and Notion sync{" "}
            {meeting.artifactApprovedAt
              ? formatMeetingDateTime(meeting.artifactApprovedAt)
              : "just now"}
          </div>
        ) : null}

        {mutationError ? (
          <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {mutationError}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            disabled={!canSaveReview}
            onClick={handleSaveReview}
            variant="outline"
          >
            {mutationStatus === "saving" ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            Save changes
          </Button>
          <Button
            disabled={!canRetryExtraction}
            onClick={() => void runMutation("retrying", onRetryExtraction)}
            variant="outline"
          >
            {mutationStatus === "retrying" ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            Try again
          </Button>
          <Button disabled={!canApproveReview} onClick={handleApproveReview}>
            {mutationStatus === "approving" ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            Approve reviewed meeting
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface MeetingNotionSyncPanelProps {
  lastSyncResult: MeetingNotionSyncResult | null
  meeting: DashboardMeetingDetail
  onSyncToNotion: () => Promise<void>
}

function MeetingNotionSyncPanel({
  lastSyncResult,
  meeting,
  onSyncToNotion,
}: MeetingNotionSyncPanelProps) {
  const [mutationStatus, setMutationStatus] = React.useState<
    "idle" | "syncing"
  >("idle")
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const isApproved = meeting.artifactReviewStatus === "APPROVED"
  const isConnected = meeting.syncReadiness.notion.connected
  const hasDestination = Boolean(
    meeting.syncReadiness.projectDestination.taskDatabaseId
  )
  const hasPendingProposal = Boolean(meeting.pendingContextProposal)
  const hasUnsyncedTasks = meeting.syncReadiness.unsyncedActionItemCount > 0
  const canSync =
    isApproved &&
    isConnected &&
    hasDestination &&
    !hasPendingProposal &&
    hasUnsyncedTasks &&
    mutationStatus === "idle"

  const runSync = async () => {
    setMutationStatus("syncing")
    setMutationError(null)

    try {
      await onSyncToNotion()
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Unable to sync approved tasks to Notion."
      )
    } finally {
      setMutationStatus("idle")
    }
  }

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))]">
      <CardHeader>
        <CardTitle>
          {meeting.syncReadiness.unsyncedActionItemCount > 0
            ? "Notion sync"
            : "Sync status"}
        </CardTitle>
        <CardDescription>
          Sync stays manual. Kapter only creates Notion tasks after review is
          approved and the project destination is ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Workspace
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {meeting.syncReadiness.notion.workspace?.name ??
                (isConnected ? "Connected workspace" : "Not connected")}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Destination
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {hasDestination ? "Configured" : "Missing"}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Syncable tasks
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {meeting.syncReadiness.unsyncedActionItemCount} pending,{" "}
              {meeting.syncReadiness.syncedActionItemCount} synced
            </p>
          </div>
        </div>

        {lastSyncResult ? (
          <div className="rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/14 dark:text-emerald-200">
            Synced {lastSyncResult.syncedCount} task(s) and skipped{" "}
            {lastSyncResult.skippedCount} already-synced task(s).
            {lastSyncResult.createdDestination
              ? " Kapter created the project destination automatically during this run."
              : ""}
          </div>
        ) : null}

        {!isApproved ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/4">
            Approve the reviewed meeting before syncing any tasks to Notion.
          </div>
        ) : null}

        {isApproved && hasPendingProposal ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/4">
            Resolve the project-memory suggestion first. Sync becomes available
            after you apply it or skip it.
          </div>
        ) : null}

        {isApproved && !hasPendingProposal && !isConnected ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/4">
            Connect Notion from the dashboard before syncing approved tasks.
          </div>
        ) : null}

        {isApproved && !hasPendingProposal && isConnected && !hasDestination ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/4">
            This project does not have a Notion destination yet. Configure the
            destination on the dashboard before syncing tasks.
          </div>
        ) : null}

        {isApproved &&
        !hasPendingProposal &&
        isConnected &&
        hasDestination &&
        !hasUnsyncedTasks ? (
          <div className="rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/14 dark:text-emerald-200">
            All current approved tasks are already synced to Notion.
          </div>
        ) : null}

        {mutationError ? (
          <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {mutationError}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button disabled={!canSync} onClick={() => void runSync()}>
            {mutationStatus === "syncing" ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            Sync approved tasks to Notion
          </Button>
          <Button asChild variant="outline">
            <Link to={ROUTES.DASHBOARD}>Open dashboard setup</Link>
          </Button>
        </div>

        {meeting.actionItems.length > 0 ? (
          <div className="space-y-2">
            {meeting.actionItems.map((actionItem) => (
              <div
                className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4"
                key={actionItem.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {actionItem.taskContent}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {actionItem.status.replace("_", " ")}
                      {actionItem.assigneeRealName || actionItem.assigneeAiLabel
                        ? ` · ${actionItem.assigneeRealName ?? actionItem.assigneeAiLabel}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase",
                      actionItem.isSynced
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
                        : "bg-amber-500/12 text-amber-700 dark:text-amber-200",
                    ].join(" ")}
                  >
                    {actionItem.isSynced ? "Synced" : "Local only"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-4 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/4">
            No approved action items are available for Notion sync yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface ProjectMemoryPanelProps {
  meeting: DashboardMeetingDetail
  onApplyProposal: (proposalId: string) => Promise<void>
  onDismissProposal: (proposalId: string) => Promise<void>
}

function ProjectMemoryPanel({
  meeting,
  onApplyProposal,
  onDismissProposal,
}: ProjectMemoryPanelProps) {
  const [mutationStatus, setMutationStatus] = React.useState<
    "idle" | "applying" | "dismissing"
  >("idle")
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const isMutating = mutationStatus !== "idle"
  const proposal = meeting.pendingContextProposal

  const runMutation = async (
    nextStatus: typeof mutationStatus,
    action: () => Promise<void>
  ) => {
    setMutationStatus(nextStatus)
    setMutationError(null)

    try {
      await action()
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Unable to update project memory."
      )
    } finally {
      setMutationStatus("idle")
    }
  }

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))]">
      <CardHeader>
        <CardTitle>Project Memory</CardTitle>
        <CardDescription>
          Review the proposed context update before future meetings use it as
          extraction memory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {proposal ? (
          <>
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4">
              <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Change summary
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {proposal.changeSummary}
              </p>
            </div>
            <pre className="max-h-72 overflow-auto rounded-[1.25rem] border border-border/70 bg-background p-4 text-xs leading-6 whitespace-pre-wrap text-foreground dark:border-white/10 dark:bg-slate-950/55">
              {proposal.proposedContextMarkdown}
            </pre>
            {mutationError ? (
              <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {mutationError}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isMutating}
                onClick={() =>
                  void runMutation("applying", () =>
                    onApplyProposal(proposal.id)
                  )
                }
              >
                {mutationStatus === "applying" ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                Apply to project memory
              </Button>
              <Button
                disabled={isMutating}
                onClick={() =>
                  void runMutation("dismissing", () =>
                    onDismissProposal(proposal.id)
                  )
                }
                variant="outline"
              >
                Skip for now
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            Approving reviewed artifacts unlocks a proposed project-memory
            update. Nothing is written automatically.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

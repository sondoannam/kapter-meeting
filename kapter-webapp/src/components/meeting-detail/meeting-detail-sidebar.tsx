import * as React from "react"
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusBadge } from "@/components/ui/status-badge"
import { MeetingSpeakerRoster } from "@/features/meetings/components/meeting-speaker-roster"
import type { MeetingWorkflowStage } from "@/features/meetings/lib/meeting-workflow-stage"
import type {
  DashboardMeetingDetail,
  MeetingNotionSyncResult,
} from "@/features/meetings/types"
import { ROUTES } from "@/routes/routes.constants"

interface MeetingDetailSidebarProps {
  lastSyncResult: MeetingNotionSyncResult | null
  meeting: DashboardMeetingDetail
  workflowStage: MeetingWorkflowStage
  onSyncToNotion: () => Promise<void>
  onConnectNotion: () => Promise<void>
  onApplyProposal: (proposalId: string) => Promise<void>
  onDismissProposal: (proposalId: string) => Promise<void>
}

const workflowTones: Record<
  MeetingWorkflowStage,
  "info" | "warning" | "success" | "neutral"
> = {
  extracting: "info",
  review: "warning",
  "project-memory": "warning",
  "notion-sync": "info",
  complete: "success",
}

export function MeetingDetailSidebar({
  meeting,
  workflowStage,
  lastSyncResult,
  onSyncToNotion,
  onConnectNotion,
  onApplyProposal,
  onDismissProposal,
}: MeetingDetailSidebarProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
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
      <div className="lg:col-span-2">
        <MeetingWorkflowRail currentStage={workflowStage} layout="landscape" />
      </div>
    </div>
  )
}

export function MeetingWorkflowRail({
  currentStage,
  layout = "stacked",
}: {
  currentStage: MeetingWorkflowStage
  layout?: "stacked" | "landscape"
}) {
  const { t } = useTranslation("meeting")
  const workflowSteps: Array<{
    stage: MeetingWorkflowStage
    title: string
    description: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    {
      stage: "extracting",
      title: t("workflow.steps.extracting.title"),
      description: t("workflow.steps.extracting.description"),
      icon: Sparkles,
    },
    {
      stage: "review",
      title: t("workflow.steps.review.title"),
      description: t("workflow.steps.review.description"),
      icon: ClipboardCheck,
    },
    {
      stage: "project-memory",
      title: t("workflow.steps.project-memory.title"),
      description: t("workflow.steps.project-memory.description"),
      icon: BookOpen,
    },
    {
      stage: "notion-sync",
      title: t("workflow.steps.notion-sync.title"),
      description: t("workflow.steps.notion-sync.description"),
      icon: RefreshCw,
    },
    {
      stage: "complete",
      title: t("workflow.steps.complete.title"),
      description: t("workflow.steps.complete.description"),
      icon: CheckCircle2,
    },
  ]
  const currentIndex = workflowSteps.findIndex(
    (step) => step.stage === currentStage
  )

  if (layout === "landscape") {
    return (
      <Card className="border-border/70 bg-background/92 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.72)]">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {t("workflow.statusEyebrow")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("workflow.statusDescription")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {workflowSteps.map((step, index) => {
              const isCurrent = index === currentIndex
              const isComplete = index < currentIndex
              const Icon = step.icon
              const tone = isCurrent
                ? workflowTones[step.stage]
                : isComplete
                  ? "success"
                  : "neutral"

              return (
                <div
                  className={[
                    "rounded-[1.2rem] border px-4 py-4",
                    isCurrent
                      ? "border-primary/30 bg-primary/10 dark:border-primary/40 dark:bg-primary/14"
                      : isComplete
                        ? "border-emerald-500/20 bg-emerald-500/10 dark:border-emerald-500/30 dark:bg-emerald-500/14"
                        : "border-border/70 bg-background dark:border-white/10 dark:bg-slate-950/55",
                  ].join(" ")}
                  key={step.stage}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl border border-current/10 bg-background/80 dark:bg-slate-900/70">
                      <Icon className="size-4" />
                    </div>
                    <StatusBadge tone={tone}>
                      {isCurrent
                        ? t("workflow.current")
                        : isComplete
                          ? t("workflow.done")
                          : t("workflow.stepLabel", { index: index + 1 })}
                    </StatusBadge>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/70 bg-background/92 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.72)]">
      <CardHeader>
        <CardTitle>{t("workflow.guideTitle")}</CardTitle>
        <CardDescription>
          {t("workflow.guideDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {workflowSteps.map((step, index) => {
          const isCurrent = index === currentIndex
          const isComplete = index < currentIndex
          const Icon = step.icon
          const tone = isCurrent
            ? workflowTones[step.stage]
            : isComplete
              ? "success"
              : "neutral"

          return (
            <div
              className={[
                "rounded-[1.25rem] border px-4 py-3",
                isCurrent
                  ? "border-primary/30 bg-primary/10 dark:border-primary/40 dark:bg-primary/14"
                  : isComplete
                    ? "border-emerald-500/20 bg-emerald-500/10 dark:border-emerald-500/30 dark:bg-emerald-500/14"
                    : "border-border/70 bg-background dark:border-white/10 dark:bg-slate-950/55",
              ].join(" ")}
              key={step.stage}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-2xl border border-current/10 bg-background/80 dark:bg-slate-900/70">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {step.title}
                  </p>
                </div>
                <StatusBadge tone={tone}>
                  {isCurrent
                    ? t("workflow.current")
                    : isComplete
                      ? t("workflow.done")
                      : t("workflow.next")}
                </StatusBadge>
              </div>
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

export function MeetingNotionSyncCard({
  meeting,
  lastSyncResult,
  onSyncToNotion,
  onConnectNotion,
}: {
  meeting: DashboardMeetingDetail
  lastSyncResult: MeetingNotionSyncResult | null
  onSyncToNotion: () => Promise<void>
  onConnectNotion: () => Promise<void>
}) {
  const { t } = useTranslation("meeting")
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [isConnecting, setIsConnecting] = React.useState(false)
  const [syncError, setSyncError] = React.useState<string | null>(null)
  const [connectError, setConnectError] = React.useState<string | null>(null)
  const isApproved = meeting.artifactReviewStatus === "APPROVED"
  const isConnected = meeting.syncReadiness.notion.connected
  const hasExistingDestination = Boolean(
    meeting.syncReadiness.projectDestination.taskDatabaseId
  )
  const hasPendingProposal = Boolean(meeting.pendingContextProposal)
  const hasUnsyncedTasks = meeting.syncReadiness.unsyncedActionItemCount > 0
  const canSync =
    isApproved &&
    isConnected &&
    !hasPendingProposal &&
    hasUnsyncedTasks &&
    !isSyncing

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncError(null)

    try {
      await onSyncToNotion()
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : t("notionSync.syncError")
      )
    } finally {
      setIsSyncing(false)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setConnectError(null)

    try {
      await onConnectNotion()
    } catch (error) {
      setConnectError(
        error instanceof Error
          ? error.message
          : t("notionSync.connectError")
      )
    } finally {
      setIsConnecting(false)
    }
  }

  const notionWorkspaceLabel =
    meeting.syncReadiness.notion.workspace?.name ??
    (isConnected
      ? t("notionSync.connectedWorkspace")
      : t("notionSync.notConnected"))

  return (
    <Card className="border-border/70 bg-background/92 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.72)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-border/70 bg-background dark:border-white/10 dark:bg-slate-950/55">
            <NotionGlyph className="size-5 text-foreground" />
          </div>
          <div>
            <CardTitle>{t("notionSync.title")}</CardTitle>
            <CardDescription>
              {t("notionSync.description")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 p-4 dark:border-white/10 dark:bg-slate-950/55">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {t("notionSync.workspace")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {notionWorkspaceLabel}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 p-4 dark:border-white/10 dark:bg-slate-950/55">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {t("notionSync.destination")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {hasExistingDestination
                ? t("notionSync.configured")
                : t("notionSync.autoCreate")}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 p-4 dark:border-white/10 dark:bg-slate-950/55">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {t("notionSync.syncableTasks")}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {t("notionSync.pendingSummary", {
                pending: meeting.syncReadiness.unsyncedActionItemCount,
                synced: meeting.syncReadiness.syncedActionItemCount,
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={isConnected ? "success" : "warning"}>
            {isConnected
              ? t("notionSync.workspaceConnected")
              : t("notionSync.workspaceMissing")}
          </StatusBadge>
          <StatusBadge tone={hasExistingDestination ? "success" : "info"}>
            {hasExistingDestination
              ? t("notionSync.destinationReady")
              : t("notionSync.destinationWillBeCreated")}
          </StatusBadge>
        </div>

        {lastSyncResult ? (
          <div className="rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/14 dark:text-emerald-200">
            {t("notionSync.syncResult", {
              synced: lastSyncResult.syncedCount,
              skipped: lastSyncResult.skippedCount,
            })}
            {lastSyncResult.createdDestination
              ? t("notionSync.destinationCreated")
              : ""}
          </div>
        ) : null}

        {!isApproved ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
            {t("notionSync.approveBeforeSync")}
          </div>
        ) : null}

        {isApproved && hasPendingProposal ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
            {t("notionSync.resolveProposalBeforeSync")}
          </div>
        ) : null}

        {!isConnected ? (
          <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
            <p>{t("notionSync.connectPrompt")}</p>
            <Button
              disabled={isConnecting}
              onClick={() => void handleConnect()}
              type="button"
              variant="outline"
            >
              {isConnecting ? <LoaderCircle className="animate-spin" /> : null}
              {t("notionSync.connectNotion")}
            </Button>
          </div>
        ) : null}

        {isApproved &&
        !hasPendingProposal &&
        isConnected &&
        !hasExistingDestination ? (
          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
            {t("notionSync.autoCreateDestinationNotice")}
          </div>
        ) : null}

        {meeting.actionItems.length > 0 ? (
          <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/85 p-4 dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {t("notionSync.taskQueueTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("notionSync.pendingSummary", {
                  pending: meeting.syncReadiness.unsyncedActionItemCount,
                  synced: meeting.syncReadiness.syncedActionItemCount,
                })}
              </p>
            </div>

            <div className="space-y-2">
              {meeting.actionItems.map((actionItem) => (
                <div
                  className="rounded-[1rem] border border-border/70 bg-background px-3 py-3 dark:border-white/10 dark:bg-slate-950/55"
                  key={actionItem.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm leading-6 font-medium text-foreground">
                        {actionItem.taskContent}
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t(`reviewPanel.actionItemStatuses.${actionItem.status}`)}
                        {" · "}
                        {actionItem.assigneeRealName ||
                          actionItem.assigneeAiLabel ||
                          t("notionSync.unassigned")}
                        {actionItem.deadline ? (
                          <>
                            {" · "}
                            {t("notionSync.deadline", {
                              value: actionItem.deadline.slice(0, 10),
                            })}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <StatusBadge
                      tone={actionItem.isSynced ? "success" : "warning"}
                    >
                      {actionItem.isSynced
                        ? t("notionSync.syncedBadge")
                        : t("notionSync.pendingBadge")}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
            {t("notionSync.emptyTaskQueue")}
          </div>
        )}

        {syncError ? (
          <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {syncError}
          </div>
        ) : null}

        {connectError ? (
          <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {connectError}
          </div>
        ) : null}

        <Button
          className="w-full justify-center"
          disabled={!canSync}
          onClick={() => void handleSync()}
        >
          {isSyncing ? <LoaderCircle className="animate-spin" /> : null}
          {t("notionSync.syncApprovedItems")}
        </Button>

        <p className="text-xs leading-6 text-muted-foreground">
          {t("notionSync.manageConnections")}{" "}
          <Link className="underline underline-offset-4" to={ROUTES.DASHBOARD}>
            {t("notionSync.dashboardLink")}
          </Link>
          {t("notionSync.syncDisabledNotice")}
        </p>
      </CardContent>
    </Card>
  )
}

export function ProjectMemoryCard({
  meeting,
  onApplyProposal,
  onDismissProposal,
}: {
  meeting: DashboardMeetingDetail
  onApplyProposal: (proposalId: string) => Promise<void>
  onDismissProposal: (proposalId: string) => Promise<void>
}) {
  const { t } = useTranslation("meeting")
  const [mutationState, setMutationState] = React.useState<
    "idle" | "applying" | "dismissing"
  >("idle")
  const [mutationError, setMutationError] = React.useState<string | null>(null)

  const proposal = meeting.pendingContextProposal

  const runMutation = async (
    nextState: typeof mutationState,
    action: () => Promise<void>
  ) => {
    setMutationState(nextState)
    setMutationError(null)

    try {
      await action()
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : t("projectMemory.mutationError")
      )
    } finally {
      setMutationState("idle")
    }
  }

  return (
    <Card className="border-border/70 bg-background/92 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.72)]">
      <CardHeader>
        <CardTitle>{t("projectMemory.title")}</CardTitle>
        <CardDescription>
          {t("projectMemory.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <MeetingSpeakerRoster speakers={meeting.speakers} />

        <div className="rounded-[1.25rem] border border-border/70 bg-background/85 p-4 dark:border-white/10 dark:bg-slate-950/55">
          <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {t("projectMemory.currentProject")}
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {meeting.projectTitle || t("projectMemory.draftProject")}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("projectMemory.projectDescription")}
          </p>
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-[1.25rem] border border-border/70 bg-background/85 dark:border-white/10 dark:bg-slate-950/55">
          <div className="space-y-4 p-4">
            {proposal ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    {t("projectMemory.changeSummary")}
                  </p>
                  <p className="text-sm leading-6 text-foreground">
                    {proposal.changeSummary}
                  </p>
                </div>

                <pre className="max-h-72 overflow-auto rounded-[1.25rem] border border-border/70 bg-background p-4 text-xs leading-6 whitespace-pre-wrap text-foreground dark:border-white/10 dark:bg-slate-950/55">
                  {proposal.proposedContextMarkdown}
                </pre>

                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={mutationState !== "idle"}
                    onClick={() =>
                      void runMutation("applying", () =>
                        onApplyProposal(proposal.id)
                      )
                    }
                  >
                    {mutationState === "applying" ? (
                      <LoaderCircle className="animate-spin" />
                    ) : null}
                    {t("projectMemory.apply")}
                  </Button>
                  <Button
                    disabled={mutationState !== "idle"}
                    onClick={() =>
                      void runMutation("dismissing", () =>
                        onDismissProposal(proposal.id)
                      )
                    }
                    variant="outline"
                  >
                    {mutationState === "dismissing" ? (
                      <LoaderCircle className="animate-spin" />
                    ) : null}
                    {t("projectMemory.dismiss")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-[1rem] border border-dashed border-border bg-background/70 px-4 py-4 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-slate-950/45">
                {t("projectMemory.noProposal")}
              </div>
            )}

            {mutationError ? (
              <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {mutationError}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function NotionGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.25 4.75 15.84 4l2.91 2.08v12.26l-9.6 1.08-3.9-2.62V6.64l.4-1.89Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M8.5 8.4v7.7m0-7.7 5.4 7.7V8.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

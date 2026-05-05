import * as React from "react"
import { MEETING_STATUS } from "@kapter/contracts/domain"
import {
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ReviewStatusBadge } from "@/features/meetings/components/review-status-badge"
import { formatMeetingDateTime } from "@/features/meetings/lib/formatters"
import type {
  ActionItemStatus,
  DashboardMeetingDetail,
  SaveMeetingReviewRequest,
} from "@/features/meetings/types"
import { cn } from "@/lib/utils"

interface MeetingDetailReviewPanelProps {
  meeting: DashboardMeetingDetail
  onSaveReview: (payload: SaveMeetingReviewRequest) => Promise<void>
  onRetryExtraction: () => Promise<void>
  onApproveCurrentReview: (payload: SaveMeetingReviewRequest) => Promise<void>
}

interface ReviewTaskDraft {
  taskContent: string
  deadline: string
  assigneeId: string
  status: ActionItemStatus
}

const actionItemStatuses: ActionItemStatus[] = ["TODO", "IN_PROGRESS", "DONE"]

const toDateInputValue = (value: string | null): string =>
  value ? value.slice(0, 10) : ""

const toLocalDateValue = (value: Date) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

const fromLocalDateValue = (value: string) =>
  value ? new Date(`${value}T00:00:00`) : undefined

export function MeetingDetailReviewPanel({
  meeting,
  onSaveReview,
  onRetryExtraction,
  onApproveCurrentReview,
}: MeetingDetailReviewPanelProps) {
  const { t, i18n } = useTranslation(["meeting", "common"])
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
  const actionItemStatusLabels: Record<ActionItemStatus, string> = {
    TODO: t("reviewPanel.actionItemStatuses.TODO", { ns: "meeting" }),
    IN_PROGRESS: t("reviewPanel.actionItemStatuses.IN_PROGRESS", {
      ns: "meeting",
    }),
    DONE: t("reviewPanel.actionItemStatuses.DONE", { ns: "meeting" }),
  }
  const deadlineLabelFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        dateStyle: "medium",
      }),
    [i18n.language, i18n.resolvedLanguage]
  )

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
        error instanceof Error
          ? error.message
          : t("reviewPanel.saveError", { ns: "meeting" })
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

  return (
    <Card className="flex h-full flex-col border-border/70 bg-background/92 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.84))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.72)]">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t("reviewPanel.title", { ns: "meeting" })}</CardTitle>
            <CardDescription>
              {t("reviewPanel.description", { ns: "meeting" })}
            </CardDescription>
          </div>
          <ReviewStatusBadge reviewStatus={meeting.artifactReviewStatus} />
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 grow flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <DiagnosticCard
            label={t("reviewPanel.chunks", { ns: "meeting" })}
            value={`${meeting.artifactProcessing.completedChunks}/${meeting.artifactProcessing.totalChunks}`}
          />
          <DiagnosticCard
            label={t("reviewPanel.pending", { ns: "meeting" })}
            value={String(meeting.artifactProcessing.pendingChunks)}
          />
          <DiagnosticCard
            label={t("reviewPanel.latestWork", { ns: "meeting" })}
            value={
              meeting.artifactProcessing.latestProcessedAt
                ? formatMeetingDateTime(
                    meeting.artifactProcessing.latestProcessedAt
                  )
                : t("reviewPanel.waiting", { ns: "meeting" })
            }
          />
        </div>

        {meeting.artifactReviewStatus === "PENDING" ? (
          <div className="rounded-[1.35rem] border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground dark:border-primary/30 dark:bg-primary/12">
            {t("reviewPanel.pendingNotice", { ns: "meeting" })}
          </div>
        ) : null}

        {meeting.artifactExtractionError ? (
          <div className="rounded-[1.35rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {meeting.artifactExtractionError}
          </div>
        ) : null}

        <div className="hidden min-h-0 grow lg:block">
          <ResizablePanelGroup orientation="horizontal" className="h-auto py-4">
            <ResizablePanel defaultSize={60} minSize={38} className="px-2">
            <SummaryEditorPanel
              description={t("reviewPanel.summaryDescription", {
                ns: "meeting",
              })}
                onSummaryChange={setSummaryDraft}
              placeholder={t("reviewPanel.summaryPlaceholder", {
                ns: "meeting",
              })}
                summaryDraft={summaryDraft}
              title={t("reviewPanel.summaryTitle", { ns: "meeting" })}
              />
            </ResizablePanel>
            <ResizableHandle withHandle className="my-4" />
            <ResizablePanel defaultSize={40} minSize={28} className="px-2">
              <ActionItemsEditorPanel
                actionItemStatuses={actionItemStatuses}
                actionItemStatusLabels={actionItemStatusLabels}
                deadlineLabelFormatter={deadlineLabelFormatter}
                fromLocalDateValue={fromLocalDateValue}
                meeting={meeting}
                onAddTask={() =>
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
                onRemoveTask={(index) =>
                  setTaskDrafts((currentDrafts) =>
                    currentDrafts.filter(
                      (_task, taskIndex) => taskIndex !== index
                    )
                  )
                }
                onUpdateTask={updateTaskDraft}
                addTaskLabel={t("actions.addTask", { ns: "common" })}
                taskDrafts={taskDrafts}
                assigneePlaceholder={t("reviewPanel.assigneePlaceholder", {
                  ns: "meeting",
                })}
                description={t("reviewPanel.actionItemsDescription", {
                  ns: "meeting",
                })}
                emptyLabel={t("reviewPanel.emptyTasks", { ns: "meeting" })}
                removeLabel={t("actions.remove", { ns: "common" })}
                setDeadlineLabel={t("reviewPanel.setDeadline", {
                  ns: "meeting",
                })}
                taskPlaceholder={t("reviewPanel.taskPlaceholder", {
                  ns: "meeting",
                })}
                taskStatusPlaceholder={t("reviewPanel.taskStatusPlaceholder", {
                  ns: "meeting",
                })}
                title={t("reviewPanel.actionItemsTitle", { ns: "meeting" })}
                toLocalDateValue={toLocalDateValue}
                unassignedLabel={t("reviewPanel.unassigned", { ns: "meeting" })}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <div className="space-y-4 lg:hidden">
          <SummaryEditorPanel
            description={t("reviewPanel.summaryDescription", { ns: "meeting" })}
            onSummaryChange={setSummaryDraft}
            placeholder={t("reviewPanel.summaryPlaceholder", {
              ns: "meeting",
            })}
            summaryDraft={summaryDraft}
            title={t("reviewPanel.summaryTitle", { ns: "meeting" })}
          />
          <ActionItemsEditorPanel
            actionItemStatuses={actionItemStatuses}
            actionItemStatusLabels={actionItemStatusLabels}
            addTaskLabel={t("actions.addTask", { ns: "common" })}
            assigneePlaceholder={t("reviewPanel.assigneePlaceholder", {
              ns: "meeting",
            })}
            description={t("reviewPanel.actionItemsDescription", {
              ns: "meeting",
            })}
            deadlineLabelFormatter={deadlineLabelFormatter}
            emptyLabel={t("reviewPanel.emptyTasks", { ns: "meeting" })}
            fromLocalDateValue={fromLocalDateValue}
            meeting={meeting}
            onAddTask={() =>
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
            onRemoveTask={(index) =>
              setTaskDrafts((currentDrafts) =>
                currentDrafts.filter((_task, taskIndex) => taskIndex !== index)
              )
            }
            onUpdateTask={updateTaskDraft}
            removeLabel={t("actions.remove", { ns: "common" })}
            setDeadlineLabel={t("reviewPanel.setDeadline", { ns: "meeting" })}
            taskDrafts={taskDrafts}
            taskPlaceholder={t("reviewPanel.taskPlaceholder", { ns: "meeting" })}
            taskStatusPlaceholder={t("reviewPanel.taskStatusPlaceholder", {
              ns: "meeting",
            })}
            title={t("reviewPanel.actionItemsTitle", { ns: "meeting" })}
            toLocalDateValue={toLocalDateValue}
            unassignedLabel={t("reviewPanel.unassigned", { ns: "meeting" })}
          />
        </div>

        {isApproved ? (
          <div className="flex items-center gap-2 rounded-[1.35rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
            <CheckCircle2 className="size-4" />
            {t("reviewPanel.approvedPrefix", { ns: "meeting" })}{" "}
            {meeting.artifactApprovedAt
              ? formatMeetingDateTime(meeting.artifactApprovedAt)
              : t("reviewPanel.approvedFallback", { ns: "meeting" })}
          </div>
        ) : null}

        {mutationError ? (
          <div className="rounded-[1.35rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {mutationError}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4 dark:border-white/10">
          <Button
            disabled={!canSaveReview}
            onClick={() =>
              void runMutation("saving", () =>
                onSaveReview(buildReviewPayload())
              )
            }
            variant="outline"
          >
            {mutationStatus === "saving" ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            {t("actions.saveChanges", { ns: "common" })}
          </Button>
          <Button
            disabled={!canRetryExtraction}
            onClick={() => void runMutation("retrying", onRetryExtraction)}
            variant="outline"
          >
            {mutationStatus === "retrying" ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            {t("reviewPanel.retryExtraction", { ns: "meeting" })}
          </Button>
          <Button
            disabled={!canApproveReview}
            onClick={() =>
              void runMutation("approving", () =>
                onApproveCurrentReview(buildReviewPayload())
              )
            }
          >
            {mutationStatus === "approving" ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            {t("reviewPanel.approveReview", { ns: "meeting" })}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryEditorPanel({
  summaryDraft,
  onSummaryChange,
  title,
  description,
  placeholder,
}: {
  summaryDraft: string
  onSummaryChange: (value: string) => void
  title: string
  description: string
  placeholder: string
}) {
  return (
    <div className="flex h-[420px] flex-col rounded-[1.5rem] border border-border/80 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/4">
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <Textarea
        className="mt-4 max-h-full flex-1 rounded-[1.3rem] border border-border/80 bg-background dark:border-white/10 dark:bg-slate-950/55"
        onChange={(event) => onSummaryChange(event.target.value)}
        placeholder={placeholder}
        value={summaryDraft}
      />
    </div>
  )
}

function ActionItemsEditorPanel({
  actionItemStatuses,
  actionItemStatusLabels,
  deadlineLabelFormatter,
  fromLocalDateValue,
  meeting,
  onAddTask,
  onRemoveTask,
  onUpdateTask,
  taskDrafts,
  toLocalDateValue,
  title,
  description,
  addTaskLabel,
  taskPlaceholder,
  taskStatusPlaceholder,
  assigneePlaceholder,
  unassignedLabel,
  setDeadlineLabel,
  removeLabel,
  emptyLabel,
}: {
  actionItemStatuses: ActionItemStatus[]
  actionItemStatusLabels: Record<ActionItemStatus, string>
  deadlineLabelFormatter: Intl.DateTimeFormat
  fromLocalDateValue: (value: string) => Date | undefined
  meeting: DashboardMeetingDetail
  onAddTask: () => void
  onRemoveTask: (index: number) => void
  onUpdateTask: (index: number, patch: Partial<ReviewTaskDraft>) => void
  taskDrafts: ReviewTaskDraft[]
  toLocalDateValue: (value: Date) => string
  title: string
  description: string
  addTaskLabel: string
  taskPlaceholder: string
  taskStatusPlaceholder: string
  assigneePlaceholder: string
  unassignedLabel: string
  setDeadlineLabel: string
  removeLabel: string
  emptyLabel: string
}) {
  return (
    <div className="flex h-[420px] flex-col rounded-[1.5rem] border border-border/80 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {title}
          </p>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <Button onClick={onAddTask} type="button" variant="outline">
          <Plus />
          {addTaskLabel}
        </Button>
      </div>

      <ScrollArea className="mt-4 flex h-auto min-h-0 flex-col pr-3">
        {taskDrafts.length > 0 ? (
          taskDrafts.map((task, index) => (
            <div
              className={cn(
                "space-y-3 rounded-xl border border-border/70 bg-background/85 p-4 dark:border-white/10 dark:bg-slate-950/55",
                index !== 0 && "mt-3"
              )}
              key={`${index}-${task.status}`}
            >
              <Textarea
                className="min-h-20 rounded-[1rem] border border-border/80 bg-background dark:border-white/10 dark:bg-slate-950/55"
                onChange={(event) =>
                  onUpdateTask(index, {
                    taskContent: event.target.value,
                  })
                }
                placeholder={taskPlaceholder}
                value={task.taskContent}
              />

              <div className="grid gap-3 xl:grid-cols-2">
                <Select
                  onValueChange={(value) =>
                    onUpdateTask(index, {
                      status: value as ActionItemStatus,
                    })
                  }
                  value={task.status}
                >
                  <SelectTrigger className="w-full border border-border/80 bg-background dark:border-white/10 dark:bg-slate-950/55">
                    <SelectValue placeholder={taskStatusPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {actionItemStatuses.map((itemStatus) => (
                      <SelectItem key={itemStatus} value={itemStatus}>
                        {actionItemStatusLabels[itemStatus]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  onValueChange={(value) =>
                    onUpdateTask(index, {
                      assigneeId: value === "unassigned" ? "" : value,
                    })
                  }
                  value={task.assigneeId || "unassigned"}
                >
                  <SelectTrigger className="w-full border border-border/80 bg-background dark:border-white/10 dark:bg-slate-950/55">
                    <SelectValue placeholder={assigneePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">{unassignedLabel}</SelectItem>
                    {meeting.speakers.map((speaker) => (
                      <SelectItem key={speaker.id} value={speaker.id}>
                        {speaker.realName || speaker.aiLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      className="justify-start rounded-[1rem] border border-border/80 bg-background text-left font-normal dark:border-white/10 dark:bg-slate-950/55"
                      type="button"
                      variant="outline"
                    >
                      <CalendarDays className="size-4 text-muted-foreground" />
                      {task.deadline
                        ? deadlineLabelFormatter.format(
                            fromLocalDateValue(task.deadline) ?? new Date()
                          )
                        : setDeadlineLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      onSelect={(value) =>
                        onUpdateTask(index, {
                          deadline: value ? toLocalDateValue(value) : "",
                        })
                      }
                      selected={fromLocalDateValue(task.deadline)}
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={() => onRemoveTask(index)}
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="size-4 text-red-500" />
                  {removeLabel}
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.2rem] border border-dashed border-border bg-background/80 px-4 py-4 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-slate-950/55">
            {emptyLabel}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function DiagnosticCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-border/70 bg-background/85 px-4 py-3 dark:border-white/10 dark:bg-slate-950/55">
      <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

import * as React from "react"
import { CalendarClock, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MeetingStatusBadge } from "@/features/meetings/components/meeting-status-badge"
import { ReviewStatusBadge } from "@/features/meetings/components/review-status-badge"
import { formatMeetingDate } from "@/features/meetings/lib/formatters"
import type {
  DashboardMeetingSummary,
  MeetingArtifactReviewStatus,
  MeetingsRequestStatus,
} from "@/features/meetings/types"
import { cn } from "@/lib/utils"
import { buildMeetingDetailRoute } from "@/routes/routes.constants"

type MeetingPanelStatusFilter = "all" | DashboardMeetingSummary["status"]
type MeetingPanelReviewFilter = "all" | MeetingArtifactReviewStatus

interface MeetingPanelProps {
  meetings: DashboardMeetingSummary[]
  totalMeetings: number
  status: MeetingsRequestStatus
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  statusFilter: MeetingPanelStatusFilter
  onStatusFilterChange: (status: MeetingPanelStatusFilter) => void
  reviewFilter: MeetingPanelReviewFilter
  onReviewFilterChange: (status: MeetingPanelReviewFilter) => void
  filtersActive: boolean
  onClearFilters: () => void
  onRefresh: () => Promise<void>
}

export function MeetingPanel({
  meetings,
  totalMeetings,
  status,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  reviewFilter,
  onReviewFilterChange,
  filtersActive,
  onClearFilters,
  onRefresh,
}: MeetingPanelProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [refreshError, setRefreshError] = React.useState<string | null>(null)
  const { t } = useTranslation(["dashboard", "common"])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshError(null)

    try {
      await onRefresh()
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : t("meetingPanel.refreshError", { ns: "dashboard" })
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Card className="min-h-[34rem] rounded-[1.8rem] border border-border/70 bg-white/80 py-0 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]" size="sm">
      <CardHeader className="gap-3 p-4">
        <div>
          <CardTitle>{t("meetingPanel.title", { ns: "dashboard" })}</CardTitle>
          <CardDescription>
            {t("meetingPanel.description", {
              ns: "dashboard",
              visible: meetings.length,
              total: totalMeetings,
            })}
          </CardDescription>
        </div>
        <CardAction className="flex items-center gap-2">
          {filtersActive ? (
            <Button onClick={onClearFilters} size="sm" variant="ghost">
              <X className="size-3" />
              {t("actions.clearFilters", { ns: "common" })}
            </Button>
          ) : null}
          <Button
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} />
            {t("actions.refresh", { ns: "common" })}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem]">
          <label className="relative block min-w-0">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-lg border-border bg-background pl-9"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder={t("meetingPanel.searchPlaceholder", {
                ns: "dashboard",
              })}
              value={searchQuery}
            />
          </label>

          <Select
            onValueChange={(value) =>
              onStatusFilterChange(value as MeetingPanelStatusFilter)
            }
            value={statusFilter}
          >
            <SelectTrigger className="w-full rounded-lg border-border bg-background">
              <SelectValue
                placeholder={t("meetingPanel.statusPlaceholder", {
                  ns: "dashboard",
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("meetingPanel.statusOptions.all", { ns: "dashboard" })}
              </SelectItem>
              <SelectItem value="RECORDING">
                {t("meetingPanel.statusOptions.RECORDING", { ns: "dashboard" })}
              </SelectItem>
              <SelectItem value="PROCESSING">
                {t("meetingPanel.statusOptions.PROCESSING", { ns: "dashboard" })}
              </SelectItem>
              <SelectItem value="COMPLETED">
                {t("meetingPanel.statusOptions.COMPLETED", { ns: "dashboard" })}
              </SelectItem>
              <SelectItem value="FAILED">
                {t("meetingPanel.statusOptions.FAILED", { ns: "dashboard" })}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            onValueChange={(value) =>
              onReviewFilterChange(value as MeetingPanelReviewFilter)
            }
            value={reviewFilter}
          >
            <SelectTrigger className="w-full rounded-lg border-border bg-background">
              <SelectValue
                placeholder={t("meetingPanel.reviewPlaceholder", {
                  ns: "dashboard",
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("meetingPanel.reviewOptions.all", { ns: "dashboard" })}
              </SelectItem>
              <SelectItem value="PENDING">
                {t("meetingPanel.reviewOptions.PENDING", { ns: "dashboard" })}
              </SelectItem>
              <SelectItem value="READY">
                {t("meetingPanel.reviewOptions.READY", { ns: "dashboard" })}
              </SelectItem>
              <SelectItem value="APPROVED">
                {t("meetingPanel.reviewOptions.APPROVED", { ns: "dashboard" })}
              </SelectItem>
              <SelectItem value="FAILED">
                {t("meetingPanel.reviewOptions.FAILED", { ns: "dashboard" })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {refreshError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {refreshError}
          </div>
        ) : null}

        {status === "loading" ? (
          <div className="rounded-[1.35rem] border border-dashed border-border/80 bg-background/70 p-8 text-center text-sm text-muted-foreground">
            {t("meetingPanel.loading", { ns: "dashboard" })}
          </div>
        ) : meetings.length === 0 ? (
          <div className="rounded-[1.35rem] border border-dashed border-border/80 bg-background/72 p-10 text-center">
            <div className="dashboard-empty-state-icon">
              <SlidersHorizontal className="size-4" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("meetingPanel.emptyTitle", { ns: "dashboard" })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {filtersActive
                ? t("meetingPanel.emptyWithFilters", { ns: "dashboard" })
                : t("meetingPanel.emptyWithoutFilters", { ns: "dashboard" })}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[25rem] pr-3">
            <div className="space-y-2">
              {meetings.map((meeting) => (
                <Link
                  className="group block rounded-[1.25rem] border border-border/80 bg-background/78 p-3.5 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-primary/24 hover:bg-white/90 dark:bg-background/55 dark:hover:bg-background/72"
                  key={meeting.id}
                  to={buildMeetingDetailRoute(meeting.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <StatusDot status={meeting.artifactReviewStatus} />
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                          {meeting.title ||
                            t("meetingPanel.untitledMeeting", {
                              ns: "dashboard",
                            })}
                        </p>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="size-3.5" />
                        {meeting.projectTitle ||
                          t("meetingPanel.draftProject", { ns: "dashboard" })}{" "}
                        ·{" "}
                        {formatMeetingDate(meeting.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {meeting.totalDurationMs
                        ? t("meetingPanel.hasRecording", { ns: "dashboard" })
                        : t("meetingPanel.newMeeting", { ns: "dashboard" })}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MeetingStatusBadge status={meeting.status} />
                    <ReviewStatusBadge reviewStatus={meeting.artifactReviewStatus} />
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function StatusDot({ status }: { status: MeetingArtifactReviewStatus }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full bg-muted-foreground",
        status === "READY" && "bg-amber",
        status === "APPROVED" && "bg-green",
        status === "FAILED" && "bg-destructive",
        status === "PENDING" && "bg-primary"
      )}
    />
  )
}

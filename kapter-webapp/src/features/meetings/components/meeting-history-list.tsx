import { AlertCircle, CalendarDays, Clock3, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buildMeetingDetailRoute } from "@/routes/routes.constants"

import { formatDuration, formatMeetingDate } from "../lib/formatters"
import type { DashboardMeetingSummary, MeetingsRequestStatus } from "../types"
import { MeetingStatusBadge } from "./meeting-status-badge"
import { ReviewStatusBadge } from "./review-status-badge"

interface MeetingHistoryListProps {
  meetings: DashboardMeetingSummary[]
  status: MeetingsRequestStatus
  errorMessage: string | null
  onRefresh: () => Promise<void>
  filtersActive?: boolean
  onClearFilters?: () => void
  totalMeetings?: number
}

export function MeetingHistoryList({
  meetings,
  status,
  errorMessage,
  onRefresh,
  filtersActive = false,
  onClearFilters,
  totalMeetings,
}: MeetingHistoryListProps) {
  const { t } = useTranslation(["meeting", "common"])

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{t("history.title", { ns: "meeting" })}</CardTitle>
            <StatusBadge tone="neutral">
              {meetings.length}
              {typeof totalMeetings === "number" ? ` / ${totalMeetings}` : ""}
            </StatusBadge>
          </div>
          <CardDescription>
            {t("history.description", { ns: "meeting" })}
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {filtersActive && onClearFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              {t("actions.clearFilters", { ns: "common" })}
            </Button>
          ) : null}

          <Button
            className="dark:border-white/10 dark:bg-white/6 dark:text-slate-50 dark:hover:bg-white/12"
            variant="outline"
            onClick={() => void onRefresh()}
          >
            <RefreshCw />
            {t("actions.refresh", { ns: "common" })}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === "loading" && meetings.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`meeting-skeleton-${index}`}
                className="grid gap-3 rounded-[1.5rem] border border-border/80 bg-muted/35 p-4 md:grid-cols-[minmax(0,1.6fr)_1fr_0.8fr_0.8fr] dark:border-white/10 dark:bg-white/4"
              >
                <div className="h-5 animate-pulse rounded-full bg-muted" />
                <div className="h-5 animate-pulse rounded-full bg-muted" />
                <div className="h-5 animate-pulse rounded-full bg-muted" />
                <div className="h-5 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : null}

        {status === "error" && meetings.length === 0 ? (
          <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/8 px-4 py-4 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {errorMessage || t("history.loadError", { ns: "meeting" })}
          </div>
        ) : null}

        {status !== "loading" && meetings.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/35 p-6 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/4">
            {filtersActive
              ? t("history.emptyFiltered", { ns: "meeting" })
              : t("history.emptyDefault", { ns: "meeting" })}
          </div>
        ) : null}

        {meetings.length > 0 ? (
          <>
            <div className="hidden rounded-[1.5rem] border border-border/80 bg-muted/20 p-3 xl:block dark:border-white/10 dark:bg-white/4">
              <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_0.8fr_0.9fr_0.9fr] gap-4 px-3 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                <span>{t("history.columns.meeting", { ns: "meeting" })}</span>
                <span>{t("history.columns.project", { ns: "meeting" })}</span>
                <span>{t("history.columns.date", { ns: "meeting" })}</span>
                <span>{t("history.columns.duration", { ns: "meeting" })}</span>
                <span>{t("history.columns.review", { ns: "meeting" })}</span>
              </div>
            </div>

            <div className="space-y-3">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="rounded-[1.5rem] border border-border/80 bg-background px-4 py-4 transition-colors hover:bg-muted/20 dark:border-white/10 dark:bg-slate-950/55 dark:hover:bg-white/8"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_1fr_0.8fr_0.9fr_0.9fr] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-medium text-foreground">
                          {meeting.title}
                        </p>
                        <MeetingStatusBadge status={meeting.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4" />
                          {meeting.externalMeetingId ||
                            t("history.missingMeetingId", { ns: "meeting" })}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {meeting.projectTitle ||
                          t("history.draftProject", { ns: "meeting" })}
                      </p>
                      <StatusBadge
                        tone={meeting.projectId ? "success" : "warning"}
                      >
                        {meeting.projectId
                          ? t("history.assignedProject", { ns: "meeting" })
                          : t("history.needsProject", { ns: "meeting" })}
                      </StatusBadge>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {formatMeetingDate(meeting.createdAt)}
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-sm text-foreground">
                      <Clock3 className="size-4 text-muted-foreground" />
                      {formatDuration(meeting.totalDurationMs)}
                    </div>

                    <div className="space-y-3">
                      <ReviewStatusBadge
                        reviewStatus={meeting.artifactReviewStatus}
                      />
                      <div className="xl:flex xl:justify-start">
                        <Button asChild size="sm" variant="outline">
                          <Link to={buildMeetingDetailRoute(meeting.id)}>
                            {t("actions.viewDetails", { ns: "common" })}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {meeting.artifactReviewStatus === "FAILED" ? (
                    <div className="mt-4 rounded-[1.1rem] border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                      <span className="inline-flex items-center gap-1.5">
                        <AlertCircle className="size-3.5" />
                        {t("history.retryExtraction", { ns: "meeting" })}
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {status === "error" && meetings.length > 0 && errorMessage ? (
          <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

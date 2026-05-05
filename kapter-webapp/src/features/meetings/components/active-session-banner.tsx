import * as React from "react"
import { MEETING_STATUS } from "@kapter/contracts/domain"
import {
  ArrowUpRight,
  Clock3,
  LoaderCircle,
  Radio,
  RefreshCw,
} from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { buildMeetingDetailRoute } from "@/routes/routes.constants"

import { formatDuration, formatMeetingTime } from "../lib/formatters"
import type { DashboardMeetingSummary, MeetingsRequestStatus } from "../types"
import { MeetingStatusBadge } from "./meeting-status-badge"
import { ReviewStatusBadge } from "./review-status-badge"

interface ActiveSessionBannerProps {
  activeMeeting: DashboardMeetingSummary | null
  status: MeetingsRequestStatus
  errorMessage: string | null
  onRefresh: () => Promise<void>
}

export function ActiveSessionBanner({
  activeMeeting,
  status,
  errorMessage,
  onRefresh,
}: ActiveSessionBannerProps) {
  const [now, setNow] = React.useState(() => Date.now())
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const { t } = useTranslation(["meeting", "common"])

  React.useEffect(() => {
    if (!activeMeeting || activeMeeting.status !== MEETING_STATUS.RECORDING) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeMeeting])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  const elapsedMs = (() => {
    if (!activeMeeting) {
      return 0
    }

    if (activeMeeting.status !== MEETING_STATUS.RECORDING) {
      return activeMeeting.totalDurationMs
    }

    const startedAtMs = new Date(activeMeeting.createdAt).getTime()
    const liveDurationMs = now - startedAtMs

    return Math.max(liveDurationMs, activeMeeting.totalDurationMs)
  })()

  if (status === "loading" && !activeMeeting) {
    return (
      <Card className="rounded-[1.8rem] border border-border/70 bg-white/80 py-0 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]" size="sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-2 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-60 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!activeMeeting) {
    return (
      <Card className="rounded-[1.8rem] border border-border/70 bg-white/80 py-0 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]" size="sm">
        <CardHeader className="gap-2 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-2 size-2 rounded-full bg-muted-foreground/50" />
            <div>
              <CardTitle className="text-sm">
                {t("activeSession.emptyTitle", { ns: "meeting" })}
              </CardTitle>
              <CardDescription>
                {t("activeSession.emptyDescription", { ns: "meeting" })}
              </CardDescription>
              {status === "error" && errorMessage ? (
                <p className="mt-2 text-xs text-destructive">{errorMessage}</p>
              ) : null}
            </div>
          </div>
          <CardAction>
            <Button
              disabled={isRefreshing}
              onClick={handleRefresh}
              size="sm"
              variant="outline"
            >
              <RefreshCw
                className={cn("size-3", isRefreshing && "animate-spin")}
              />
              {t("actions.refresh", { ns: "common" })}
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    )
  }

  const isRecording = activeMeeting.status === MEETING_STATUS.RECORDING
  const stateLabel = isRecording
    ? t("activeSession.recording", { ns: "meeting" })
    : t("activeSession.processing", { ns: "meeting" })
  const stateDescription = isRecording
    ? t("activeSession.recordingDescription", { ns: "meeting" })
    : t("activeSession.processingDescription", { ns: "meeting" })
  const captureContextLabel =
    activeMeeting.captureContext === "google_meet_room"
      ? t("activeSession.googleMeet", { ns: "meeting" })
      : activeMeeting.captureContext === "generic_tab"
        ? t("activeSession.genericTab", { ns: "meeting" })
        : t("activeSession.unknownCapture", { ns: "meeting" })
  const audioLaneLabel =
    activeMeeting.activeSourceTypes.length > 0
      ? activeMeeting.activeSourceTypes
          .map((sourceType) =>
            sourceType === "self_mic"
              ? t("activeSession.selfMic", { ns: "meeting" })
              : t("activeSession.tabMix", { ns: "meeting" })
          )
          .join(" + ")
      : t("activeSession.noSourceMetadata", { ns: "meeting" })

  return (
    <Card className="overflow-hidden rounded-[1.8rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,247,240,0.72))] py-0 shadow-[0_24px_68px_-50px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,23,42,0.2))] dark:shadow-[0_30px_80px_-54px_rgba(0,0,0,0.78)]" size="sm">
      <CardHeader className="gap-3 p-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                "gap-1.5",
                isRecording
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              )}
              variant="secondary"
            >
              {isRecording ? (
                <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
              ) : (
                <LoaderCircle className="size-3 animate-spin" />
              )}
              {stateLabel}
            </Badge>
            <MeetingStatusBadge status={activeMeeting.status} />
            <ReviewStatusBadge
              reviewStatus={activeMeeting.artifactReviewStatus}
            />
          </div>

          <div>
            <CardTitle className="truncate text-base">
              {activeMeeting.title ||
                t("activeSession.untitledMeeting", { ns: "meeting" })}
            </CardTitle>
            <CardDescription>{stateDescription}</CardDescription>
            <p className="mt-2 text-xs text-muted-foreground">
              {captureContextLabel} · {audioLaneLabel}
              {activeMeeting.degradedWithoutSelfMic
                ? ` · ${t("activeSession.recorderMicUnavailable", {
                    ns: "meeting",
                  })}`
                : ""}
            </p>
          </div>
        </div>

        <CardAction className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={buildMeetingDetailRoute(activeMeeting.id)}>
              {t("actions.viewDetails", { ns: "common" })}
              <ArrowUpRight className="size-3" />
            </Link>
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="sm"
            variant="outline"
          >
            <RefreshCw
              className={cn("size-3", isRefreshing && "animate-spin")}
            />
            {t("actions.refresh", { ns: "common" })}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-3">
        <div className="rounded-[1.2rem] border border-border/80 bg-background/72 p-3 dark:bg-background/55">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {isRecording ? (
              <Radio className="size-3" />
            ) : (
              <Clock3 className="size-3" />
            )}
            {t("activeSession.duration", { ns: "meeting" })}
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {formatDuration(elapsedMs)}
          </p>
        </div>

        <div className="rounded-[1.2rem] border border-border/80 bg-background/72 p-3 dark:bg-background/55">
          <p className="text-xs font-medium text-muted-foreground">
            {t("activeSession.startedAt", { ns: "meeting" })}
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {formatMeetingTime(activeMeeting.createdAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeMeeting.externalMeetingId ||
              t("activeSession.googleMeet", { ns: "meeting" })}
          </p>
        </div>

        <div className="rounded-[1.2rem] border border-border/80 bg-background/72 p-3 dark:bg-background/55">
          <p className="text-xs font-medium text-muted-foreground">
            {t("activeSession.backendSnapshot", { ns: "meeting" })}
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {formatMeetingTime(activeMeeting.updatedAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("activeSession.apiUpdated", { ns: "meeting" })}
          </p>
        </div>
      </CardContent>

      {status === "error" && errorMessage ? (
        <div className="mx-4 mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive dark:border-destructive/30 dark:bg-destructive/16">
          {errorMessage}
        </div>
      ) : null}
    </Card>
  )
}

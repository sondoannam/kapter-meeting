import * as React from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  LaptopMinimalCheck,
  Link2,
  Radio,
  Sparkles,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { AppShellContainer } from "@/components/app-shell-container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getGuidedExtensionConfirmed,
  setGuidedExtensionConfirmed,
} from "@/features/dashboard/lib/dashboard-mode"
import { useExtensionPresence } from "@/features/dashboard/hooks/use-extension-presence"
import { MeetingStatusBadge } from "@/features/meetings/components/meeting-status-badge"
import { ReviewStatusBadge } from "@/features/meetings/components/review-status-badge"
import { formatMeetingDate } from "@/features/meetings/lib/formatters"
import type {
  DashboardMeetingSummary,
  MeetingsRequestStatus,
} from "@/features/meetings/types"
import { ROUTES, buildMeetingDetailRoute } from "@/routes/routes.constants"
import { cn } from "@/lib/utils"

type GuidedDashboardProps = {
  activeMeeting: DashboardMeetingSummary | null
  meetings: DashboardMeetingSummary[]
  meetingsStatus: MeetingsRequestStatus
  onRefreshMeetings: () => Promise<void>
  onSwitchToStandard: () => void
}

type GuidedPrimaryAction =
  | {
      kind: "install"
      title: string
      description: string
      ctaLabel: string
      ctaHref: string
    }
  | {
      kind: "meeting"
      title: string
      description: string
      ctaLabel: string
      meeting: DashboardMeetingSummary
    }
  | {
      kind: "captureSetup"
      title: string
      description: string
      ctaLabel: string
      ctaHref: string
    }
  | {
      kind: "handoff"
      title: string
      description: string
      ctaLabel: string
    }

const STEP_IDS = ["extension", "capture", "review", "handoff"] as const

export function GuidedDashboard({
  activeMeeting,
  meetings,
  meetingsStatus,
  onRefreshMeetings,
  onSwitchToStandard,
}: GuidedDashboardProps) {
  const { t } = useTranslation(["dashboard", "common"])
  const [extensionConfirmed, setExtensionConfirmed] = React.useState(() =>
    getGuidedExtensionConfirmed()
  )
  const { extensionDetected } = useExtensionPresence()
  const extensionDownloadUrl =
    import.meta.env.VITE_EXTENSION_TEST_BUILD_URL?.trim() ||
    `${ROUTES.HOME}#extension-setup`
  const captureReady = extensionDetected || extensionConfirmed
  const sortedMeetings = React.useMemo(
    () =>
      [...meetings].sort(
        (leftMeeting, rightMeeting) =>
          new Date(rightMeeting.createdAt).getTime() -
          new Date(leftMeeting.createdAt).getTime()
      ),
    [meetings]
  )
  const hasApprovedReview = React.useMemo(
    () =>
      sortedMeetings.some(
        (meeting) => meeting.artifactReviewStatus === "APPROVED"
      ),
    [sortedMeetings]
  )
  const readyMeeting = React.useMemo(
    () =>
      sortedMeetings.find(
        (meeting) => meeting.artifactReviewStatus === "READY"
      ) ?? null,
    [sortedMeetings]
  )
  const inProgressMeeting = React.useMemo(
    () =>
      sortedMeetings.find(
        (meeting) =>
          meeting.status === "RECORDING" ||
          meeting.status === "PROCESSING" ||
          meeting.artifactReviewStatus === "PENDING"
      ) ?? null,
    [sortedMeetings]
  )
  const retryMeeting = React.useMemo(
    () =>
      sortedMeetings.find(
        (meeting) =>
          meeting.status === "FAILED" ||
          meeting.artifactReviewStatus === "FAILED"
      ) ?? null,
    [sortedMeetings]
  )
  const latestMeeting = sortedMeetings[0] ?? null
  const currentStep = React.useMemo<
    (typeof STEP_IDS)[number]
  >(() => {
    if (hasApprovedReview) {
      return "handoff"
    }

    if (readyMeeting || retryMeeting || latestMeeting) {
      return "review"
    }

    if (activeMeeting || inProgressMeeting || captureReady) {
      return "capture"
    }

    return "extension"
  }, [
    activeMeeting,
    captureReady,
    hasApprovedReview,
    inProgressMeeting,
    latestMeeting,
    readyMeeting,
    retryMeeting,
  ])

  const primaryAction = React.useMemo<GuidedPrimaryAction>(() => {
    if (readyMeeting) {
      return {
        kind: "meeting",
        title: t("guided.primary.reviewTitle", { ns: "dashboard" }),
        description: t("guided.primary.reviewDescription", {
          ns: "dashboard",
          title:
            readyMeeting.title ||
            t("meetingPanel.untitledMeeting", { ns: "dashboard" }),
        }),
        ctaLabel: t("guided.primary.reviewAction", { ns: "dashboard" }),
        meeting: readyMeeting,
      }
    }

    const captureMeeting = activeMeeting ?? inProgressMeeting

    if (captureMeeting) {
      return {
        kind: "meeting",
        title: t("guided.primary.captureTitle", { ns: "dashboard" }),
        description: t("guided.primary.captureDescription", {
          ns: "dashboard",
          title:
            captureMeeting.title ||
            t("meetingPanel.untitledMeeting", { ns: "dashboard" }),
        }),
        ctaLabel: t("guided.primary.captureAction", { ns: "dashboard" }),
        meeting: captureMeeting,
      }
    }

    if (captureReady) {
      return {
        kind: "captureSetup",
        title: t("guided.primary.captureSetupTitle", { ns: "dashboard" }),
        description: t("guided.primary.captureSetupDescription", {
          ns: "dashboard",
        }),
        ctaLabel: t("guided.primary.captureSetupAction", { ns: "dashboard" }),
        ctaHref: "https://meet.google.com/",
      }
    }

    if (retryMeeting || latestMeeting) {
      const targetMeeting = retryMeeting ?? latestMeeting

      if (targetMeeting) {
        return {
          kind: "meeting",
          title: t("guided.primary.latestTitle", { ns: "dashboard" }),
          description: t("guided.primary.latestDescription", {
            ns: "dashboard",
            title:
              targetMeeting.title ||
              t("meetingPanel.untitledMeeting", { ns: "dashboard" }),
          }),
          ctaLabel: t("guided.primary.latestAction", { ns: "dashboard" }),
          meeting: targetMeeting,
        }
      }
    }

    if (hasApprovedReview) {
      return {
        kind: "handoff",
        title: t("guided.primary.handoffTitle", { ns: "dashboard" }),
        description: t("guided.primary.handoffDescription", {
          ns: "dashboard",
        }),
        ctaLabel: t("guided.switchToStandard", { ns: "dashboard" }),
      }
    }

    return {
      kind: "install",
      title: t("guided.primary.installTitle", { ns: "dashboard" }),
      description: t("guided.primary.installDescription", { ns: "dashboard" }),
      ctaLabel: t("guided.primary.installAction", { ns: "dashboard" }),
      ctaHref: extensionDownloadUrl,
    }
  }, [
    activeMeeting,
    captureReady,
    extensionDownloadUrl,
    hasApprovedReview,
    inProgressMeeting,
    latestMeeting,
    readyMeeting,
    retryMeeting,
    t,
  ])
  const confirmExtensionInstall = React.useCallback(() => {
    setGuidedExtensionConfirmed(true)
    setExtensionConfirmed(true)
  }, [])
  const goBackToInstallStep = React.useCallback(() => {
    setGuidedExtensionConfirmed(false)
    setExtensionConfirmed(false)
  }, [])
  const recentMeetings = React.useMemo(
    () => sortedMeetings.slice(0, 3),
    [sortedMeetings]
  )

  return (
    <AppShellContainer className="space-y-5 py-6" width="narrow">
      <Card
        className="overflow-hidden rounded-[1.85rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,247,240,0.74))] py-0 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.36)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,23,42,0.2))] dark:shadow-[0_30px_84px_-58px_rgba(0,0,0,0.82)]"
        size="sm"
      >
        <CardContent className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div
            aria-hidden="true"
            className="absolute top-0 right-0 h-28 w-28 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative space-y-3">
            <Badge className="w-fit border-primary/18 bg-primary/10 text-primary" variant="outline">
              <Sparkles className="size-3.5" />
              {t("guided.badge", { ns: "dashboard" })}
            </Badge>
            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-primary/80 uppercase">
                {t("guided.eyebrow", { ns: "dashboard" })}
              </p>
              <h1 className="mt-3 font-heading text-2xl leading-tight text-foreground sm:text-3xl">
                {t("guided.title", { ns: "dashboard" })}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                {t("guided.description", { ns: "dashboard" })}
              </p>
            </div>
          </div>

          <div className="relative flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <Button
              onClick={onSwitchToStandard}
              type="button"
              variant="outline"
            >
              <ArrowUpRight />
              {t("guided.switchToStandard", { ns: "dashboard" })}
            </Button>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground lg:text-right">
              {t("guided.standardHint", { ns: "dashboard" })}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-4">
        {STEP_IDS.map((stepId, index) => {
          const isCurrent = stepId === currentStep
          const isComplete = STEP_IDS.indexOf(stepId) < STEP_IDS.indexOf(currentStep)

          return (
            <Card
              className={cn(
                "rounded-[1.55rem] border border-border/70 bg-white/80 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/6 dark:shadow-[0_24px_56px_-44px_rgba(0,0,0,0.72)]",
                isCurrent && "border-primary/35 bg-primary/8",
                isComplete && "border-emerald-500/25 bg-emerald-500/8"
              )}
              key={stepId}
              size="sm"
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={isComplete ? "secondary" : "outline"}>
                    {isComplete ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      t("guided.stepNumber", {
                        ns: "dashboard",
                        value: index + 1,
                      })
                    )}
                  </Badge>
                  {isCurrent ? (
                    <span className="text-xs font-medium text-primary">
                      {t("guided.currentStep", { ns: "dashboard" })}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {t(`guided.steps.${stepId}.title`, { ns: "dashboard" })}
                  </p>
                  <p className="text-xs leading-6 text-muted-foreground">
                    {t(`guided.steps.${stepId}.description`, {
                      ns: "dashboard",
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.9fr)]">
        <Card
          className="rounded-[1.8rem] border border-border/70 bg-white/80 py-0 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]"
          size="sm"
        >
          <CardHeader className="gap-3 p-5">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-primary" />
              <CardTitle>{t("guided.primary.title", { ns: "dashboard" })}</CardTitle>
            </div>
            <CardDescription>
              {t("guided.primary.subtitle", { ns: "dashboard" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-0">
            <div className="rounded-[1.35rem] border border-border/80 bg-background/82 p-4 dark:border-white/10 dark:bg-slate-950/55">
              <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-primary/80 uppercase">
                {primaryAction.kind === "install"
                  ? t("guided.primary.installLabel", { ns: "dashboard" })
                  : primaryAction.kind === "handoff"
                    ? t("guided.primary.handoffLabel", { ns: "dashboard" })
                    : t("guided.primary.meetingLabel", { ns: "dashboard" })}
              </p>
              <h2 className="mt-3 font-heading text-2xl leading-tight text-foreground">
                {primaryAction.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                {primaryAction.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {primaryAction.kind === "install" ? (
                  <>
                    <Button asChild>
                      <a
                        href={primaryAction.ctaHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink />
                        {primaryAction.ctaLabel}
                      </a>
                    </Button>
                    <Button
                      onClick={confirmExtensionInstall}
                      type="button"
                      variant="outline"
                    >
                      <LaptopMinimalCheck />
                      {t("guided.primary.confirmInstallAction", {
                        ns: "dashboard",
                      })}
                    </Button>
                  </>
                ) : primaryAction.kind === "captureSetup" ? (
                  <>
                    <Button asChild>
                      <a
                        href={primaryAction.ctaHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink />
                        {primaryAction.ctaLabel}
                      </a>
                    </Button>
                    {!extensionDetected ? (
                      <Button
                        onClick={goBackToInstallStep}
                        type="button"
                        variant="outline"
                      >
                        <ArrowLeft />
                        {t("guided.primary.backToInstallAction", {
                          ns: "dashboard",
                        })}
                      </Button>
                    ) : null}
                  </>
                ) : primaryAction.kind === "handoff" ? (
                  <Button onClick={onSwitchToStandard} type="button">
                    <ArrowUpRight />
                    {primaryAction.ctaLabel}
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to={buildMeetingDetailRoute(primaryAction.meeting.id)}>
                      <ArrowUpRight />
                      {primaryAction.ctaLabel}
                    </Link>
                  </Button>
                )}

                <Button
                  onClick={() => void onRefreshMeetings()}
                  type="button"
                  variant="outline"
                >
                  {t("actions.refresh", { ns: "common" })}
                </Button>
              </div>
            </div>

            {meetingsStatus === "error" ? (
              <div className="rounded-[1.2rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {t("errorBanner.message", { ns: "dashboard" })}
              </div>
            ) : null}

            {primaryAction.kind === "install" ? (
              <div className="rounded-[1.2rem] border border-border/80 bg-muted/25 px-4 py-4 text-sm leading-7 text-muted-foreground dark:border-white/10 dark:bg-white/4">
                {t("guided.primary.installAdvanceHint", { ns: "dashboard" })}
              </div>
            ) : null}

            {primaryAction.kind === "captureSetup" ? (
              <div className="rounded-[1.2rem] border border-border/80 bg-muted/25 px-4 py-4 text-sm leading-7 text-muted-foreground dark:border-white/10 dark:bg-white/4">
                {extensionDetected ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="font-medium text-foreground">
                        {t("guided.primary.extensionDetectedTitle", {
                          ns: "dashboard",
                        })}
                      </p>
                      <p className="mt-1 text-sm leading-7 text-muted-foreground">
                        {t("guided.primary.extensionDetectedHint", {
                          ns: "dashboard",
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  t("guided.primary.captureSetupBackHint", {
                    ns: "dashboard",
                  })
                )}
              </div>
            ) : null}

            <div className="rounded-[1.2rem] border border-border/80 bg-muted/25 px-4 py-4 dark:border-white/10 dark:bg-white/4">
              <p className="text-sm font-medium text-foreground">
                {t("guided.secondaryTitle", { ns: "dashboard" })}
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {t("guided.secondaryDescription", { ns: "dashboard" })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge className="rounded-full border-border/80 bg-background dark:border-white/10 dark:bg-slate-950/55" variant="outline">
                  <FolderKanban className="size-3.5" />
                  {t("guided.secondaryProject", { ns: "dashboard" })}
                </Badge>
                <Badge className="rounded-full border-border/80 bg-background dark:border-white/10 dark:bg-slate-950/55" variant="outline">
                  <Link2 className="size-3.5" />
                  {t("guided.secondaryNotion", { ns: "dashboard" })}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="rounded-[1.8rem] border border-border/70 bg-white/80 py-0 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]"
          size="sm"
        >
          <CardHeader className="gap-2 p-5">
            <CardTitle>{t("guided.recent.title", { ns: "dashboard" })}</CardTitle>
            <CardDescription>
              {t("guided.recent.description", { ns: "dashboard" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 pt-0">
            {recentMeetings.length > 0 ? (
              recentMeetings.map((meeting) => (
                <div
                  className="rounded-[1.25rem] border border-border/80 bg-background/82 p-4 dark:border-white/10 dark:bg-slate-950/55"
                  key={meeting.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {meeting.title ||
                          t("meetingPanel.untitledMeeting", {
                            ns: "dashboard",
                          })}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        {meeting.projectTitle ||
                          t("meetingPanel.draftProject", { ns: "dashboard" })}{" "}
                        · {formatMeetingDate(meeting.createdAt)}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={buildMeetingDetailRoute(meeting.id)}>
                        {t("actions.viewDetails", { ns: "common" })}
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MeetingStatusBadge status={meeting.status} />
                    <ReviewStatusBadge
                      reviewStatus={meeting.artifactReviewStatus}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm leading-7 text-muted-foreground dark:border-white/10 dark:bg-slate-950/45">
                {t("guided.recent.empty", { ns: "dashboard" })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShellContainer>
  )
}

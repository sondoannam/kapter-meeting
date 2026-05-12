import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"

interface DashboardPageHeaderProps {
  meetingCount: number
  projectCount: number
  onOpenGuidedDashboard?: () => void
  onDismissGuidedCoachmark?: () => void
  showGuidedCoachmark?: boolean
}

export function DashboardPageHeader({
  meetingCount,
  projectCount,
  onOpenGuidedDashboard,
  onDismissGuidedCoachmark,
  showGuidedCoachmark = false,
}: DashboardPageHeaderProps) {
  const { t } = useTranslation(["dashboard", "common"])

  return (
    <Card className="overflow-hidden rounded-[1.85rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,247,240,0.74))] py-0 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.36)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,23,42,0.2))] dark:shadow-[0_30px_84px_-58px_rgba(0,0,0,0.82)]" size="sm">
      <CardContent className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 h-28 w-28 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative">
          <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-primary/80 uppercase">
            {t("pageHeader.eyebrow")}
          </p>
          <h1 className="mt-3 font-heading text-2xl leading-tight text-foreground sm:text-3xl">
            {t("pageHeader.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            {t("pageHeader.description")}
          </p>
        </div>
        <div className="relative flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-primary/18 bg-primary/10 text-primary" variant="outline">
              {t("pageHeader.meetingsCount", { ns: "dashboard", count: meetingCount })}
            </Badge>
            <Badge className="bg-white/72 dark:bg-white/8" variant="secondary">
              {t("pageHeader.projectsCount", { ns: "dashboard", count: projectCount })}
            </Badge>
            {onOpenGuidedDashboard ? (
              <Button
                id="guided-dashboard-switch"
                onClick={onOpenGuidedDashboard}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("modeSwitch.openGuided", { ns: "dashboard" })}
              </Button>
            ) : null}
          </div>

          {showGuidedCoachmark && onOpenGuidedDashboard && onDismissGuidedCoachmark ? (
            <div className="w-full max-w-sm rounded-[1.25rem] border border-primary/20 bg-background/92 px-4 py-3 text-sm shadow-[0_20px_50px_-42px_rgba(15,23,42,0.28)] dark:border-primary/30 dark:bg-slate-950/82 lg:text-right">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {t("coachmark.title", { ns: "dashboard" })}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t("coachmark.description", { ns: "dashboard" })}
                  </p>
                </div>
                <button
                  aria-label={t("actions.close", { ns: "common" })}
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  onClick={onDismissGuidedCoachmark}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                <Button
                  onClick={onOpenGuidedDashboard}
                  size="sm"
                  type="button"
                >
                  {t("modeSwitch.openGuided", { ns: "dashboard" })}
                </Button>
                <Button
                  onClick={onDismissGuidedCoachmark}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {t("coachmark.dismiss", { ns: "dashboard" })}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

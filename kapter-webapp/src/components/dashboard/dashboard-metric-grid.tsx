import type * as React from "react"
import { Activity, CheckCircle2, FolderKanban, ListChecks } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DashboardMetricGridProps {
  metrics: {
    liveCount: number
    reviewCount: number
    approvedCount: number
    projectCount: number
  }
  activeMetricId?: string
  onMetricClick?: (id: string) => void
}

export function DashboardMetricGrid({ 
  metrics, 
  activeMetricId = "all", 
  onMetricClick 
}: DashboardMetricGridProps) {
  const { t } = useTranslation("dashboard")
  const items = [
    {
      id: "live",
      label: t("metrics.live.label"),
      value: metrics.liveCount,
      icon: Activity,
      helper: t("metrics.live.helper"),
    },
    {
      id: "review",
      label: t("metrics.review.label"),
      value: metrics.reviewCount,
      icon: ListChecks,
      helper: t("metrics.review.helper"),
    },
    {
      id: "approved",
      label: t("metrics.approved.label"),
      value: metrics.approvedCount,
      icon: CheckCircle2,
      helper: t("metrics.approved.helper"),
    },
    {
      id: "project",
      label: t("metrics.project.label"),
      value: metrics.projectCount,
      icon: FolderKanban,
      helper: t("metrics.project.helper"),
      interactive: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <DashboardMetricCard
          helper={item.helper}
          icon={item.icon}
          id={item.id}
          isActive={activeMetricId === item.id}
          key={item.id}
          label={item.label}
          interactive={item.interactive ?? true}
          onClick={onMetricClick}
          value={String(item.value)}
        />
      ))}
    </div>
  )
}

function DashboardMetricCard({
  id,
  label,
  value,
  helper,
  icon: Icon,
  isActive,
  interactive = true,
  onClick,
}: {
  id: string
  label: string
  value: string
  helper: string
  icon: React.ComponentType<{ className?: string }>
  isActive?: boolean
  interactive?: boolean
  onClick?: (id: string) => void
}) {
  return (
    <Button
      className={cn(
        "dashboard-metric-card group h-auto w-full justify-between rounded-[1.6rem] border border-border/70 bg-white/82 p-4 text-left shadow-[0_20px_50px_-42px_rgba(15,23,42,0.28)] backdrop-blur transition-all hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/6 dark:shadow-[0_24px_56px_-44px_rgba(0,0,0,0.72)]",
        isActive && "active shadow-[0_24px_58px_-40px_rgba(194,65,12,0.34)]",
        !interactive && "cursor-default hover:translate-y-0"
      )}
      disabled={!interactive}
      onClick={() => onClick?.(id)}
      type="button"
      variant="ghost"
    >
      <span className="min-w-0">
        <span className="dashboard-metric-number block font-heading text-3xl leading-none text-foreground">
          {value}
        </span>
        <span className="mt-1 block text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
          {helper}
        </span>
      </span>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/16 bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
    </Button>
  )
}

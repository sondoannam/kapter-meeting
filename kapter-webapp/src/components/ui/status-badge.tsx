import type * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusBadgeTone =
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "neutral"

const toneClasses: Record<StatusBadgeTone, string> = {
  success:
    "border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/12 dark:text-emerald-200",
  warning:
    "border-amber-500/25 bg-amber-500/12 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/12 dark:text-amber-200",
  info: "border-primary/25 bg-primary/12 text-primary dark:text-orange-200",
  danger:
    "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/35 dark:bg-destructive/16 dark:text-red-200",
  neutral:
    "border-border/80 bg-background text-muted-foreground dark:border-white/10 dark:bg-slate-950/55",
}

interface StatusBadgeProps extends React.ComponentProps<typeof Badge> {
  tone?: StatusBadgeTone
}

export function StatusBadge({
  className,
  tone = "neutral",
  variant,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.14em] uppercase",
        toneClasses[tone],
        className
      )}
      variant={variant ?? "outline"}
      {...props}
    />
  )
}

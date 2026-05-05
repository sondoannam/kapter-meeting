import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { useTranslation } from "react-i18next"

interface DashboardPageHeaderProps {
  meetingCount: number
  projectCount: number
}

export function DashboardPageHeader({
  meetingCount,
  projectCount,
}: DashboardPageHeaderProps) {
  const { t } = useTranslation("dashboard")

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
        <div className="relative flex flex-wrap gap-2">
          <Badge className="border-primary/18 bg-primary/10 text-primary" variant="outline">
            {t("pageHeader.meetingsCount", { count: meetingCount })}
          </Badge>
          <Badge className="bg-white/72 dark:bg-white/8" variant="secondary">
            {t("pageHeader.projectsCount", { count: projectCount })}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

import { ArrowUpRight, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MeetingUploadDialog } from "@/features/meetings/components/meeting-upload-dialog"
import type { DashboardMeetingSummary } from "@/features/meetings/types"
import type { DashboardProjectSummary } from "@/features/projects/types"

type DashboardMeetingUploadCardProps = {
  projects: DashboardProjectSummary[]
  defaultProjectId?: string | null
  isSubmitting: boolean
  onSubmit: (input: {
    file: File
    title?: string
    projectId?: string
  }) => Promise<DashboardMeetingSummary>
  onAccepted: (meeting: DashboardMeetingSummary) => void | Promise<void>
}

export function DashboardMeetingUploadCard({
  projects,
  defaultProjectId,
  isSubmitting,
  onSubmit,
  onAccepted,
}: DashboardMeetingUploadCardProps) {
  const { t } = useTranslation(["dashboard"])

  return (
    <Card className="rounded-[1.8rem] border border-border/70 bg-white/82 py-0 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]" size="sm">
      <CardHeader className="p-5">
        <div className="space-y-1">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {t("uploadCard.eyebrow", { ns: "dashboard" })}
          </p>
          <CardTitle>{t("uploadCard.title", { ns: "dashboard" })}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-0">
        <p className="text-sm leading-7 text-muted-foreground">
          {t("uploadCard.description", { ns: "dashboard" })}
        </p>

        <div className="rounded-[1.25rem] border border-border/80 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4">
          <p className="text-sm font-medium text-foreground">
            {t("uploadCard.workflowTitle", { ns: "dashboard" })}
          </p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {t("uploadCard.workflowDescription", { ns: "dashboard" })}
          </p>
        </div>

        <MeetingUploadDialog
          defaultProjectId={defaultProjectId}
          isSubmitting={isSubmitting}
          onAccepted={onAccepted}
          onSubmit={onSubmit}
          projects={projects}
          trigger={
            <button
              className="flex w-full items-center justify-between rounded-[1.35rem] border border-primary/20 bg-primary/8 px-4 py-4 text-left transition hover:border-primary/35 hover:bg-primary/12"
              type="button"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t("uploadCard.ctaTitle", { ns: "dashboard" })}
                </p>
                <p className="text-xs leading-6 text-muted-foreground">
                  {t("uploadCard.ctaDescription", { ns: "dashboard" })}
                </p>
              </div>
              <div className="flex items-center gap-2 text-primary">
                <Upload className="size-4" />
                <ArrowUpRight className="size-4" />
              </div>
            </button>
          }
        />
      </CardContent>
    </Card>
  )
}

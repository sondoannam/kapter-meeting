import type * as React from "react"
import {
  CheckCircle2,
  FolderKanban,
  PlugZap,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { formatMeetingDateTime } from "@/features/meetings/lib/formatters"
import { cn } from "@/lib/utils"
import type {
  DashboardProjectSummary,
  NotionConnectionStatus,
} from "@/features/projects/types"

interface ProjectPanelProps {
  projects: DashboardProjectSummary[]
  selectedProjectId: string
  onSelectProjectId: (id: string) => void
  notionConnection: NotionConnectionStatus | null
  networkError: boolean
}

export function ProjectPanel({
  projects,
  selectedProjectId,
  onSelectProjectId,
  notionConnection,
  networkError,
}: ProjectPanelProps) {
  const isOnline = !networkError
  const { t } = useTranslation("dashboard")

  return (
    <Card
      className="flex h-full min-h-0 flex-col rounded-[1.8rem] border border-border/70 bg-white/80 py-0 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]"
      size="sm"
    >
      <CardHeader className="p-4">
        <CardTitle>{t("projectPanel.title")}</CardTitle>
        <CardDescription>
          {t("projectPanel.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col space-y-5 pt-0">
        <div className="flex min-h-0 flex-1 flex-col space-y-2">
          <ProjectButton
            count={projects.reduce(
              (sum, project) => sum + project.meetingCount,
              0
            )}
            description={t("projectPanel.allWorkspace")}
            icon={FolderKanban}
            isActive={selectedProjectId === "all"}
            label={t("projectPanel.allProjects")}
            onClick={() => onSelectProjectId("all")}
          />

          {projects.length > 0 ? (
            <ScrollArea className="max-h-[260px] min-h-0 w-full flex-1">
              <div className="w-full space-y-2">
                {projects.map((project) => (
                  <ProjectButton
                    count={project.meetingCount}
                    description={
                      project.notionTaskDatabaseId
                        ? t("projectPanel.notionReady")
                        : project.isDraft
                          ? t("projectPanel.draft")
                          : t("projectPanel.setupNeeded")
                    }
                    icon={FolderKanban}
                    isActive={selectedProjectId === project.id}
                    key={project.id}
                    label={project.title}
                    onClick={() => onSelectProjectId(project.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/72 p-4 text-sm text-muted-foreground">
              {t("projectPanel.emptyProjects")}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("projectPanel.systemStatusTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("projectPanel.systemStatusDescription")}
              </p>
            </div>
            <Badge variant={isOnline ? "secondary" : "destructive"}>
              {isOnline ? t("projectPanel.stable") : t("projectPanel.error")}
            </Badge>
          </div>

          <StatusRow
            icon={PlugZap}
            label={t("projectPanel.extensionLabel")}
            tone="ok"
            value={t("projectPanel.extensionActive")}
          />
          <StatusRow
            icon={CheckCircle2}
            label={t("projectPanel.notionLabel")}
            tone={notionConnection?.connected ? "ok" : "warn"}
            value={
              notionConnection?.connected
                ? t("projectPanel.notionConnected")
                : t("projectPanel.notionPending")
            }
          />
          <StatusRow
            icon={isOnline ? Wifi : WifiOff}
            label={t("projectPanel.networkLabel")}
            tone={isOnline ? "ok" : "err"}
            value={isOnline ? t("projectPanel.stable") : t("projectPanel.error")}
          />
        </div>

        <div className="rounded-[1.25rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,247,240,0.7),rgba(255,255,255,0.6))] p-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("projectPanel.lastSyncTitle")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {notionConnection?.connectedAt
              ? formatMeetingDateTime(notionConnection.connectedAt)
              : t("projectPanel.noData")}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ProjectButton({
  count,
  description,
  icon: Icon,
  isActive,
  label,
  onClick,
}: {
  count: number
  description: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      className={cn(
        "h-auto w-full rounded-[1.25rem] border px-3 py-2.5 text-left shadow-[0_16px_40px_-38px_rgba(15,23,42,0.18)]",
        isActive
          ? "border-primary/28 bg-primary/10 text-primary hover:bg-primary/14"
          : "border-border/80 bg-background/76 text-foreground hover:bg-white/90 dark:bg-background/55 dark:hover:bg-background/72"
      )}
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      <Icon className="size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="max-w-[calc(100%-2rem)] text-wrap">
          <p className="text-sm font-medium break-normal">{label}</p>
        </div>
        <span className="block truncate text-xs font-normal text-muted-foreground">
          {description}
        </span>
      </div>
      <Badge variant="outline">{count}</Badge>
    </Button>
  )
}

function StatusRow({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone: "ok" | "warn" | "err"
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-border/80 bg-background/76 px-3 py-2.5 dark:bg-background/55">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <span className={cn("dashboard-status-value text-sm", tone)}>
        {value}
      </span>
    </div>
  )
}

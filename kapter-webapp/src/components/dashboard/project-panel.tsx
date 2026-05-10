import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  CheckCircle2,
  Ellipsis,
  FilePenLine,
  FolderKanban,
  LoaderCircle,
  PlugZap,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useForm } from "react-hook-form"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatMeetingDateTime } from "@/features/meetings/lib/formatters"
import {
  buildProjectFormSchema,
  emptyProjectFormValues,
  mapProjectDetailToFormValues,
  toProjectMutationInput,
  type ProjectFormValues,
} from "@/features/projects/forms/project-form"
import type {
  DashboardProjectDetail,
  DashboardProjectSummary,
  NotionConnectionStatus,
  ProjectsRequestStatus,
  UpdateProjectInput,
} from "@/features/projects/types"

interface ProjectPanelProps {
  projects: DashboardProjectSummary[]
  selectedProjectId: string
  onSelectProjectId: (id: string) => void
  status: ProjectsRequestStatus
  errorMessage: string | null
  activeProjectUpdateId: string | null
  activeProjectDeleteId: string | null
  notionConnection: NotionConnectionStatus | null
  onDeleteProject: (projectId: string) => Promise<string>
  onGetProjectDetail: (projectId: string) => Promise<DashboardProjectDetail>
  onUpdateProject: (
    projectId: string,
    input: UpdateProjectInput
  ) => Promise<DashboardProjectSummary>
  networkError: boolean
}

export function ProjectPanel({
  projects,
  selectedProjectId,
  onSelectProjectId,
  status,
  errorMessage,
  activeProjectUpdateId,
  activeProjectDeleteId,
  notionConnection,
  onDeleteProject,
  onGetProjectDetail,
  onUpdateProject,
  networkError,
}: ProjectPanelProps) {
  const isOnline = !networkError
  const { t } = useTranslation(["dashboard", "common"])
  const [editingProjectId, setEditingProjectId] = React.useState<string | null>(
    null
  )
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isLoadingProjectDetail, setIsLoadingProjectDetail] =
    React.useState(false)
  const [editProjectError, setEditProjectError] = React.useState<string | null>(
    null
  )
  const [deleteCandidateId, setDeleteCandidateId] = React.useState<
    string | null
  >(null)
  const [deletePhase, setDeletePhase] = React.useState<"review" | "confirm" | null>(
    null
  )
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [openActionMenuId, setOpenActionMenuId] = React.useState<string | null>(
    null
  )
  const projectFormSchema = React.useMemo(
    () =>
      buildProjectFormSchema(
        t("projectsPanel.projectTitleRequired", { ns: "dashboard" })
      ),
    [t]
  )
  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: emptyProjectFormValues,
  })

  const deleteCandidate = React.useMemo(
    () =>
      deleteCandidateId
        ? (projects.find((project) => project.id === deleteCandidateId) ?? null)
        : null,
    [deleteCandidateId, projects]
  )
  const editingProjectSummary = React.useMemo(
    () =>
      editingProjectId
        ? (projects.find((project) => project.id === editingProjectId) ?? null)
        : null,
    [editingProjectId, projects]
  )

  const resetProjectEditState = React.useCallback(() => {
    setEditingProjectId(null)
    setIsEditDialogOpen(false)
    setIsLoadingProjectDetail(false)
    setEditProjectError(null)
    editForm.reset(emptyProjectFormValues)
  }, [editForm])

  const resetDeleteState = React.useCallback(() => {
    setDeleteCandidateId(null)
    setDeletePhase(null)
    setDeleteError(null)
  }, [])

  const handleOpenProjectEditor = async (project: DashboardProjectSummary) => {
    setEditingProjectId(project.id)
    setIsEditDialogOpen(true)
    setIsLoadingProjectDetail(true)
    setEditProjectError(null)

    try {
      const detail = await onGetProjectDetail(project.id)
      editForm.reset(mapProjectDetailToFormValues(detail))
    } catch (error) {
      setEditProjectError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.loadProjectDetailError", { ns: "dashboard" })
      )
    } finally {
      setIsLoadingProjectDetail(false)
    }
  }

  const handleSaveProjectEdit = editForm.handleSubmit(async (values) => {
    if (!editingProjectId) {
      return
    }

    setEditProjectError(null)

    try {
      await onUpdateProject(editingProjectId, toProjectMutationInput(values))
      resetProjectEditState()
    } catch (error) {
      setEditProjectError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.updateProjectError", { ns: "dashboard" })
      )
    }
  })

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) {
      return
    }

    setDeleteError(null)

    try {
      await onDeleteProject(deleteCandidate.id)
      resetDeleteState()

      if (selectedProjectId === deleteCandidate.id) {
        onSelectProjectId("all")
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.deleteProjectError", { ns: "dashboard" })
      )
    }
  }

  const totalMeetingCount = projects.reduce(
    (sum, project) => sum + project.meetingCount,
    0
  )

  return (
    <>
      <Card
        className="flex h-full min-h-0 flex-col rounded-[1.8rem] border border-border/70 bg-white/80 py-0 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]"
        size="sm"
      >
        <CardHeader className="space-y-1 p-4 pb-2">
          <CardTitle>{t("projectPanel.title", { ns: "dashboard" })}</CardTitle>
          <CardDescription>
            {t("projectPanel.description", { ns: "dashboard" })}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 pt-0">
          <div className="flex min-h-0 flex-1 flex-col rounded-[1.35rem] border border-border/80 bg-background/76 p-3 dark:border-white/10 dark:bg-white/3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("projectsPanel.title", { ns: "dashboard" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("projectsPanel.meetingCount", {
                    ns: "dashboard",
                    count: totalMeetingCount,
                  })}
                </p>
              </div>
              <Badge variant="outline">{projects.length + 1}</Badge>
            </div>

            <div className="flex min-h-0 flex-1 flex-col space-y-2">
              <ProjectListRow
                count={totalMeetingCount}
                icon={FolderKanban}
                isActive={selectedProjectId === "all"}
                label={t("projectPanel.allProjects", { ns: "dashboard" })}
                meta={
                  <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {t("projectPanel.allWorkspace", { ns: "dashboard" })}
                  </span>
                }
                onClick={() => onSelectProjectId("all")}
              />

              {status === "loading" && projects.length === 0
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`project-skeleton-${index}`}
                      className="rounded-[1.35rem] border border-border/80 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/4"
                    >
                      <div className="h-5 animate-pulse rounded-full bg-muted" />
                      <div className="mt-3 h-4 animate-pulse rounded-full bg-muted" />
                    </div>
                  ))
                : null}

              {status === "error" && projects.length === 0 ? (
                <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 p-4 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                  {errorMessage ||
                    t("projectsPanel.loadProjectsError", { ns: "dashboard" })}
                </div>
              ) : null}

              {status !== "loading" && projects.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/72 p-4 text-sm leading-6 text-muted-foreground">
                  {t("projectsPanel.emptyProjects", { ns: "dashboard" })}
                </div>
              ) : null}

              {projects.length > 0 ? (
                <ScrollArea className="max-h-[28rem] min-h-0 w-full flex-1">
                  <div className="space-y-2 pr-3">
                    {projects.map((project) => {
                      const projectStatusLabel = project.notionTaskDatabaseId
                        ? t("projectPanel.notionReady", { ns: "dashboard" })
                        : project.isDraft
                          ? t("projectPanel.draft", { ns: "dashboard" })
                          : t("projectPanel.setupNeeded", { ns: "dashboard" })

                      return (
                        <ProjectListRow
                          key={project.id}
                          count={project.meetingCount}
                          icon={FolderKanban}
                          isActive={selectedProjectId === project.id}
                          label={project.title}
                          meta={
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                              <span>{projectStatusLabel}</span>
                              <span>
                                {t("projectsPanel.updatedAt", {
                                  ns: "dashboard",
                                  value: formatMeetingDateTime(
                                    project.updatedAt
                                  ),
                                })}
                              </span>
                            </div>
                          }
                          onClick={() => onSelectProjectId(project.id)}
                          trailing={
                            <Popover
                              open={openActionMenuId === project.id}
                              onOpenChange={(open) => {
                                setOpenActionMenuId(open ? project.id : null)
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  className="h-9 w-9 rounded-xl border-border/80 bg-background/80 hover:bg-muted/60 dark:border-white/10 dark:bg-slate-950/55"
                                  onClick={(event) => event.stopPropagation()}
                                  size="icon"
                                  type="button"
                                  variant="outline"
                                >
                                  <Ellipsis />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-56 p-2">
                                <div className="space-y-1">
                                  <ActionMenuButton
                                    icon={FilePenLine}
                                    label={t("projectsPanel.editProject", {
                                      ns: "dashboard",
                                    })}
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      void handleOpenProjectEditor(project)
                                    }}
                                  />
                                  <ActionMenuButton
                                    destructive
                                    icon={Trash2}
                                    label={t("projectsPanel.deleteProject", {
                                      ns: "dashboard",
                                    })}
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      setDeleteCandidateId(project.id)
                                      setDeletePhase("review")
                                      setDeleteError(null)
                                    }}
                                  />
                                </div>
                              </PopoverContent>
                            </Popover>
                          }
                        />
                      )
                    })}
                  </div>
                </ScrollArea>
              ) : null}

              {status === "error" && projects.length > 0 && errorMessage ? (
                <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/8 p-4 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("projectPanel.systemStatusTitle", { ns: "dashboard" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("projectPanel.systemStatusDescription", {
                    ns: "dashboard",
                  })}
                </p>
              </div>
              <Badge variant={isOnline ? "secondary" : "destructive"}>
                {isOnline
                  ? t("projectPanel.stable", { ns: "dashboard" })
                  : t("projectPanel.error", { ns: "dashboard" })}
              </Badge>
            </div>

            <StatusRow
              icon={PlugZap}
              label={t("projectPanel.extensionLabel", { ns: "dashboard" })}
              tone="ok"
              value={t("projectPanel.extensionActive", { ns: "dashboard" })}
            />
            <StatusRow
              icon={CheckCircle2}
              label={t("projectPanel.notionLabel", { ns: "dashboard" })}
              tone={notionConnection?.connected ? "ok" : "warn"}
              value={
                notionConnection?.connected
                  ? t("projectPanel.notionConnected", { ns: "dashboard" })
                  : t("projectPanel.notionPending", { ns: "dashboard" })
              }
            />
            <StatusRow
              icon={isOnline ? Wifi : WifiOff}
              label={t("projectPanel.networkLabel", { ns: "dashboard" })}
              tone={isOnline ? "ok" : "err"}
              value={
                isOnline
                  ? t("projectPanel.stable", { ns: "dashboard" })
                  : t("projectPanel.error", { ns: "dashboard" })
              }
            />
          </div>

          <div className="rounded-[1.25rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,247,240,0.7),rgba(255,255,255,0.6))] p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-medium text-muted-foreground">
              {t("projectPanel.lastSyncTitle", { ns: "dashboard" })}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {notionConnection?.connectedAt
                ? formatMeetingDateTime(notionConnection.connectedAt)
                : t("projectPanel.noData", { ns: "dashboard" })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetProjectEditState()
            return
          }

          setIsEditDialogOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("projectsPanel.editDialogTitle", { ns: "dashboard" })}
            </DialogTitle>
            <DialogDescription>
              {t("projectsPanel.editDialogDescription", {
                ns: "dashboard",
              })}
            </DialogDescription>
          </DialogHeader>

          {isLoadingProjectDetail ? (
            <div className="flex min-h-56 items-center justify-center rounded-[1.5rem] border border-border/80 bg-muted/20 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/4">
              <LoaderCircle className="mr-2 size-4 animate-spin" />
              {t("projectsPanel.loadingProjectDetail", { ns: "dashboard" })}
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSaveProjectEdit}>
              <div className="grid gap-3 rounded-[1.5rem] border border-border/80 bg-muted/25 p-4 sm:grid-cols-3 dark:border-white/10 dark:bg-white/4">
                <ProjectSignal
                  label={t("projectsPanel.meetingCountSignal", {
                    ns: "dashboard",
                  })}
                  value={String(editingProjectSummary?.meetingCount ?? 0)}
                />
                <ProjectSignal
                  label={t("projectsPanel.lastUpdatedSignal", {
                    ns: "dashboard",
                  })}
                  value={
                    editingProjectSummary
                      ? formatMeetingDateTime(editingProjectSummary.updatedAt)
                      : "-"
                  }
                />
                <ProjectSignal
                  label={t("projectsPanel.destinationSignal", {
                    ns: "dashboard",
                  })}
                  value={
                    editingProjectSummary?.notionTaskDatabaseId
                      ? t("projectsPanel.notionReadyBadge", {
                          ns: "dashboard",
                        })
                      : t("projectsPanel.setupNeeded", { ns: "dashboard" })
                  }
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-foreground">
                  <span className="font-medium">
                    {t("projectsPanel.projectNameLabel", { ns: "dashboard" })}
                  </span>
                  <Input maxLength={120} {...editForm.register("title")} />
                  {editForm.formState.errors.title?.message ? (
                    <p className="text-xs text-destructive">
                      {editForm.formState.errors.title.message}
                    </p>
                  ) : null}
                </label>

                <label className="space-y-2 text-sm text-foreground">
                  <span className="font-medium">
                    {t("projectsPanel.projectDescriptionLabel", {
                      ns: "dashboard",
                    })}
                  </span>
                  <Textarea
                    className="min-h-32"
                    maxLength={800}
                    placeholder={t(
                      "projectsPanel.projectDescriptionPlaceholder",
                      {
                        ns: "dashboard",
                      }
                    )}
                    {...editForm.register("description")}
                  />
                </label>
              </div>

              <div className="grid gap-4">
                <label className="space-y-2 text-sm text-foreground">
                  <span className="font-medium">
                    {t("projectsPanel.contextMarkdownLabel", {
                      ns: "dashboard",
                    })}
                  </span>
                  <Textarea
                    className="min-h-36 font-mono text-xs"
                    maxLength={8000}
                    placeholder={t("projectsPanel.contextMarkdownPlaceholder", {
                      ns: "dashboard",
                    })}
                    {...editForm.register("contextMarkdown")}
                  />
                </label>
              </div>

              {editProjectError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                  {editProjectError}
                </div>
              ) : null}

              <DialogFooter>
                <Button
                  onClick={() => resetProjectEditState()}
                  type="button"
                  variant="outline"
                >
                  {t("actions.cancel", { ns: "common" })}
                </Button>
                <Button
                  disabled={
                    !editingProjectId ||
                    activeProjectUpdateId === editingProjectId
                  }
                  type="submit"
                >
                  {activeProjectUpdateId === editingProjectId ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <FilePenLine />
                  )}
                  {activeProjectUpdateId === editingProjectId
                    ? t("projectsPanel.updatingProject", { ns: "dashboard" })
                    : t("projectsPanel.saveProjectChanges", {
                        ns: "dashboard",
                      })}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteCandidate && deletePhase === "review"}
        onOpenChange={(open) => {
          if (!open) {
            resetDeleteState()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("projectsPanel.deleteDialogTitle", { ns: "dashboard" })}
            </DialogTitle>
            <DialogDescription>
              {t("projectsPanel.deleteDialogDescription", {
                ns: "dashboard",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[1.3rem] border border-destructive/20 bg-destructive/8 px-4 py-4 dark:border-destructive/30 dark:bg-destructive/16">
              <p className="text-[11px] font-medium tracking-[0.12em] text-destructive uppercase">
                {t("projectsPanel.deleteProjectSignal", { ns: "dashboard" })}
              </p>
              <p className="mt-2 text-base font-medium text-foreground">
                {deleteCandidate?.title ?? "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {deleteCandidate?.description ||
                  t("projectsPanel.missingProjectDescription", {
                    ns: "dashboard",
                  })}
              </p>
            </div>

            <div className="rounded-[1.2rem] border border-border/80 bg-muted/25 px-4 py-4 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/4">
              {deleteCandidate?.meetingCount
                ? t("projectsPanel.deleteProjectCascadeHint", {
                    ns: "dashboard",
                    count: deleteCandidate.meetingCount,
                  })
                : t("projectsPanel.deleteProjectConfirmHint", {
                    ns: "dashboard",
                  })}
            </div>

            {deleteError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {deleteError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              onClick={() => resetDeleteState()}
              type="button"
              variant="outline"
            >
              {t("actions.cancel", { ns: "common" })}
            </Button>
            <Button
              disabled={!deleteCandidate}
              onClick={() => setDeletePhase("confirm")}
              type="button"
            >
              <Trash2 />
              {t("actions.continue", { ns: "common" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteCandidate && deletePhase === "confirm"}
        onOpenChange={(open) => {
          if (!open) {
            resetDeleteState()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("projectsPanel.deleteFinalDialogTitle", { ns: "dashboard" })}
            </DialogTitle>
            <DialogDescription>
              {t("projectsPanel.deleteFinalDialogDescription", {
                ns: "dashboard",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[1.2rem] border border-destructive/20 bg-destructive/8 px-4 py-4 text-sm leading-6 text-muted-foreground dark:border-destructive/30 dark:bg-destructive/16">
              {deleteCandidate?.meetingCount
                ? t("projectsPanel.deleteProjectCascadeWarning", {
                    ns: "dashboard",
                    count: deleteCandidate.meetingCount,
                  })
                : t("projectsPanel.deleteProjectFinalHint", {
                    ns: "dashboard",
                  })}
            </div>

            {deleteError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {deleteError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setDeletePhase("review")}
              type="button"
              variant="outline"
            >
              {t("actions.back", { ns: "common" })}
            </Button>
            <Button
              disabled={
                !deleteCandidate || activeProjectDeleteId === deleteCandidate.id
              }
              onClick={() => void handleConfirmDelete()}
              type="button"
              variant="destructive"
            >
              {activeProjectDeleteId === deleteCandidate?.id ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              {activeProjectDeleteId === deleteCandidate?.id
                ? t("projectsPanel.deletingProject", { ns: "dashboard" })
                : t("projectsPanel.deleteProjectConfirm", {
                    ns: "dashboard",
                  })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ProjectListRow({
  count,
  icon: Icon,
  isActive,
  label,
  meta,
  onClick,
  trailing,
}: {
  count: number
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  label: string
  meta: React.ReactNode
  onClick: () => void
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 rounded-[1.25rem] border border-border/80 bg-background/76 px-3 py-2.5 shadow-[0_16px_40px_-38px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-background/55">
      <button
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
        onClick={onClick}
        type="button"
      >
        <div
          className={
            isActive
              ? "mt-0.5 rounded-xl bg-primary/14 p-2 text-primary"
              : "mt-0.5 rounded-xl bg-muted/60 p-2 text-muted-foreground dark:bg-slate-900/55"
          }
        >
          <Icon className="size-4 shrink-0" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium break-normal text-foreground">
              {label}
            </p>
            <Badge variant="outline">{count}</Badge>
          </div>

          {meta}
        </div>
      </button>

      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}

function ActionMenuButton({
  destructive = false,
  icon: Icon,
  label,
  onClick,
}: {
  destructive?: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={
        destructive
          ? "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive transition hover:bg-muted/60"
          : "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted/60"
      }
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </button>
  )
}

function ProjectSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-border/80 bg-background px-4 py-3 dark:border-white/10 dark:bg-slate-950/55">
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
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
  const toneClassName =
    tone === "ok"
      ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
      : tone === "warn"
        ? "bg-amber-500/12 text-amber-600 dark:text-amber-300"
        : "bg-rose-500/12 text-rose-600 dark:text-rose-300"

  return (
    <div className="flex items-center justify-between rounded-[1rem] border border-border/70 bg-background/72 px-3 py-2 dark:border-white/10 dark:bg-white/3">
      <div className="flex items-center gap-2">
        <span className={`rounded-full p-1.5 ${toneClassName}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{value}</span>
    </div>
  )
}

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowUpRight,
  Link2,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  Unplug,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatMeetingDateTime } from "@/features/meetings/lib/formatters"
import {
  buildProjectFormSchema,
  emptyProjectFormValues,
  toProjectMutationInput,
  type ProjectFormValues,
} from "@/features/projects/forms/project-form"
import { cn } from "@/lib/utils"
import type {
  ConfigureProjectNotionDestinationInput,
  CreateProjectInput,
  DashboardProjectSummary,
  NotionConnectionStatus,
  NotionPageSearchResult,
  NotionProjectDestinationMode,
  ProjectsRequestStatus,
} from "@/features/projects/types"

interface DashboardProjectSetupSectionProps {
  projects: DashboardProjectSummary[]
  selectedProjectId: string
  isCreating: boolean
  notionConnection: NotionConnectionStatus | null
  notionStatus: ProjectsRequestStatus
  notionErrorMessage: string | null
  isConnectingNotion: boolean
  activeNotionProjectId: string | null
  onRefreshProjects: () => Promise<void>
  onRefreshNotion: () => Promise<void>
  onCreateProject: (
    input: CreateProjectInput
  ) => Promise<DashboardProjectSummary>
  onConnectNotion: () => Promise<void>
  onSearchNotionPages: (query: string) => Promise<NotionPageSearchResult[]>
  onConfigureProjectNotionDestination: (
    projectId: string,
    input: ConfigureProjectNotionDestinationInput
  ) => Promise<DashboardProjectSummary>
  onClearProjectNotionDestination: (
    projectId: string
  ) => Promise<DashboardProjectSummary>
}

export function DashboardProjectSetupSection({
  projects,
  selectedProjectId,
  isCreating,
  notionConnection,
  notionStatus,
  notionErrorMessage,
  isConnectingNotion,
  activeNotionProjectId,
  onRefreshProjects,
  onRefreshNotion,
  onCreateProject,
  onConnectNotion,
  onSearchNotionPages,
  onConfigureProjectNotionDestination,
  onClearProjectNotionDestination,
}: DashboardProjectSetupSectionProps) {
  const { t } = useTranslation(["dashboard", "common"])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const projectFormSchema = React.useMemo(
    () =>
      buildProjectFormSchema(
        t("projectsPanel.projectTitleRequired", { ns: "dashboard" })
      ),
    [t]
  )
  const createForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: emptyProjectFormValues,
  })

  const selectedProject = React.useMemo(
    () =>
      selectedProjectId !== "all"
        ? (projects.find((project) => project.id === selectedProjectId) ?? null)
        : null,
    [projects, selectedProjectId]
  )

  const resetCreateState = React.useCallback(() => {
    setFormError(null)
    setIsCreateDialogOpen(false)
    createForm.reset(emptyProjectFormValues)
  }, [createForm])

  const handleCreateProject = createForm.handleSubmit(async (values) => {
    setFormError(null)

    try {
      await onCreateProject(
        toProjectMutationInput(values) as CreateProjectInput
      )
      resetCreateState()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.createProjectError", { ns: "dashboard" })
      )
    }
  })

  return (
    <>
      <Card className="gap-3 rounded-[1.8rem] border border-border/70 bg-white/82 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-52px_rgba(0,0,0,0.72)]">
        <CardHeader className="p-5" id="notion-setup-section">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {t("projectSetupAccordion.title", { ns: "dashboard" })}
              </p>
              <CardTitle>
                {t("projectsPanel.title", { ns: "dashboard" })}
              </CardTitle>
              <CardDescription>
                {t("projectsPanel.description", { ns: "dashboard" })}
              </CardDescription>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                className="dark:border-white/10 dark:bg-white/6 dark:text-slate-50 dark:hover:bg-white/12"
                onClick={() => {
                  setIsCreateDialogOpen(true)
                  setFormError(null)
                  createForm.reset(emptyProjectFormValues)
                }}
                size="sm"
              >
                <Sparkles />
                {t("projectsPanel.createProject", { ns: "dashboard" })}
              </Button>
              <Button
                className="dark:border-white/10 dark:bg-white/6 dark:text-slate-50 dark:hover:bg-white/12"
                onClick={() => void onRefreshProjects()}
                size="icon"
                variant="outline"
              >
                <RefreshCw />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-[1.35rem] border border-border/80 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {t("projectsPanel.notionWorkspaceTitle", {
                      ns: "dashboard",
                    })}
                  </p>
                  {notionConnection?.connected ? (
                    <Badge variant="secondary">
                      {t("projectsPanel.connected", { ns: "dashboard" })}
                    </Badge>
                  ) : notionConnection?.oauthConfigured ? (
                    <Badge variant="outline">
                      {t("projectsPanel.setupNeeded", { ns: "dashboard" })}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {t("projectsPanel.unavailable", { ns: "dashboard" })}
                    </Badge>
                  )}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {notionConnection?.connected
                    ? t("projectsPanel.connectedDescription", {
                        ns: "dashboard",
                        workspace:
                          notionConnection.workspace?.name ||
                          t("projectsPanel.notionWorkspaceTitle", {
                            ns: "dashboard",
                          }),
                      })
                    : notionConnection?.oauthConfigured
                      ? t("projectsPanel.oauthDescription", {
                          ns: "dashboard",
                        })
                      : t("projectsPanel.unavailableDescription", {
                          ns: "dashboard",
                        })}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  className="dark:border-white/10 dark:bg-white/6 dark:text-slate-50 dark:hover:bg-white/12"
                  onClick={() => void onRefreshNotion()}
                  size="icon"
                  variant="outline"
                >
                  <RefreshCw />
                </Button>
                <Button
                  disabled={
                    !notionConnection?.oauthConfigured || isConnectingNotion
                  }
                  onClick={() => void onConnectNotion()}
                  size="sm"
                >
                  <Link2 />
                  {isConnectingNotion
                    ? t("projectsPanel.connectingNotion", { ns: "dashboard" })
                    : t("projectsPanel.connectNotion", { ns: "dashboard" })}
                </Button>
              </div>
            </div>

            {notionStatus === "loading" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("projectsPanel.loadingWorkspace", { ns: "dashboard" })}
              </p>
            ) : null}

            {notionErrorMessage ? (
              <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {notionErrorMessage}
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.35rem] border border-border/80 bg-background/78 p-4 dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t("projectsPanel.setupNotion", { ns: "dashboard" })}
                </p>
                {selectedProject ? (
                  <>
                    <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      {t("projectsPanel.selectedProjectLabel", {
                        ns: "dashboard",
                      })}
                    </p>
                    <p className="text-sm text-foreground">
                      {selectedProject.title}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("projectsPanel.noProjectSelectedDescription", {
                      ns: "dashboard",
                    })}
                  </p>
                )}
              </div>

              {selectedProject?.notionTaskDatabaseId ? (
                <Badge variant="secondary">
                  {t("projectsPanel.notionReadyBadge", { ns: "dashboard" })}
                </Badge>
              ) : null}
            </div>

            {!selectedProject ? (
              <div className="mt-4 rounded-[1.2rem] border border-dashed border-border/80 bg-muted/25 px-4 py-4 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/4">
                {t("projectsPanel.noProjectSelectedDescription", {
                  ns: "dashboard",
                })}
              </div>
            ) : !notionConnection?.connected ? (
              <div className="mt-4 rounded-[1.2rem] border border-dashed border-border/80 bg-muted/25 px-4 py-4 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/4">
                {t("projectsPanel.connectWorkspaceFirst", {
                  ns: "dashboard",
                })}
              </div>
            ) : (
              <SelectedProjectDestinationSetup
                key={`${selectedProject.id}:${selectedProject.notionDestinationMode ?? "PROJECT_PAGE"}:${selectedProject.notionProjectPageId ?? "none"}`}
                activeNotionProjectId={activeNotionProjectId}
                onClearProjectNotionDestination={
                  onClearProjectNotionDestination
                }
                onConfigureProjectNotionDestination={
                  onConfigureProjectNotionDestination
                }
                onSearchNotionPages={onSearchNotionPages}
                selectedProject={selectedProject}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetCreateState()
            return
          }

          setIsCreateDialogOpen(true)
          setFormError(null)
          createForm.reset(emptyProjectFormValues)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("projectsPanel.newProjectTitle", { ns: "dashboard" })}
            </DialogTitle>
            <DialogDescription>
              {t("projectsPanel.newProjectDescription", { ns: "dashboard" })}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleCreateProject}>
            <div className="grid gap-4 rounded-[1.5rem] border border-border/80 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/4">
              <label className="space-y-2 text-sm text-foreground">
                <span className="font-medium">
                  {t("projectsPanel.projectNameLabel", { ns: "dashboard" })}
                </span>
                <Input
                  className="h-11 rounded-2xl border-border bg-background px-4 dark:border-white/10 dark:bg-slate-950/50"
                  maxLength={120}
                  placeholder={t("projectsPanel.projectNamePlaceholder", {
                    ns: "dashboard",
                  })}
                  {...createForm.register("title")}
                />
                {createForm.formState.errors.title?.message ? (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.title.message}
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
                  className="min-h-32 rounded-2xl border-border bg-background px-4 py-3 dark:border-white/10 dark:bg-slate-950/50"
                  maxLength={800}
                  placeholder={t(
                    "projectsPanel.projectDescriptionPlaceholder",
                    {
                      ns: "dashboard",
                    }
                  )}
                  {...createForm.register("description")}
                />
              </label>

              <label className="space-y-2 text-sm text-foreground">
                <span className="font-medium">
                  {t("projectsPanel.contextMarkdownLabel", {
                    ns: "dashboard",
                  })}
                </span>
                <Textarea
                  className="min-h-36 rounded-2xl border-border bg-background px-4 py-3 font-mono text-xs dark:border-white/10 dark:bg-slate-950/50"
                  maxLength={8000}
                  placeholder={t("projectsPanel.contextMarkdownPlaceholder", {
                    ns: "dashboard",
                  })}
                  {...createForm.register("contextMarkdown")}
                />
              </label>
            </div>

            {formError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {formError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                onClick={() => resetCreateState()}
                type="button"
                variant="outline"
              >
                {t("actions.cancel", { ns: "common" })}
              </Button>
              <Button disabled={isCreating} type="submit">
                {isCreating
                  ? t("projectsPanel.creatingProject", { ns: "dashboard" })
                  : t("projectsPanel.createProject", { ns: "dashboard" })}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SelectedProjectDestinationSetup({
  selectedProject,
  activeNotionProjectId,
  onSearchNotionPages,
  onConfigureProjectNotionDestination,
  onClearProjectNotionDestination,
}: {
  selectedProject: DashboardProjectSummary
  activeNotionProjectId: string | null
  onSearchNotionPages: (query: string) => Promise<NotionPageSearchResult[]>
  onConfigureProjectNotionDestination: (
    projectId: string,
    input: ConfigureProjectNotionDestinationInput
  ) => Promise<DashboardProjectSummary>
  onClearProjectNotionDestination: (
    projectId: string
  ) => Promise<DashboardProjectSummary>
}) {
  const { t } = useTranslation(["dashboard", "common"])
  const [notionMode, setNotionMode] =
    React.useState<NotionProjectDestinationMode>(
      selectedProject.notionDestinationMode ?? "PROJECT_PAGE"
    )
  const [pageQuery, setPageQuery] = React.useState("")
  const [pageResults, setPageResults] = React.useState<
    NotionPageSearchResult[]
  >([])
  const [selectedPageId, setSelectedPageId] = React.useState<string | null>(
    selectedProject.notionProjectPageId
  )
  const [isSearchingPages, setIsSearchingPages] = React.useState(false)
  const [pageSearchError, setPageSearchError] = React.useState<string | null>(
    null
  )
  const selectedPage = React.useMemo(
    () => pageResults.find((page) => page.id === selectedPageId) ?? null,
    [pageResults, selectedPageId]
  )

  const handleSearchPages = async () => {
    const normalizedQuery = pageQuery.trim()

    setIsSearchingPages(true)
    setPageSearchError(null)

    try {
      const nextPages = await onSearchNotionPages(normalizedQuery)
      setPageResults(nextPages)
      setSelectedPageId((currentSelectedPageId) => {
        if (currentSelectedPageId) {
          const currentSelectionStillAvailable = nextPages.some(
            (page) => page.id === currentSelectedPageId
          )

          if (currentSelectionStillAvailable) {
            return currentSelectedPageId
          }
        }

        return nextPages[0]?.id ?? null
      })
    } catch (error) {
      setPageSearchError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.searchPagesError", { ns: "dashboard" })
      )
    } finally {
      setIsSearchingPages(false)
    }
  }

  const handleSaveProjectDestination = async () => {
    const selectedParentPageId = selectedPage?.id ?? selectedPageId

    if (!selectedParentPageId) {
      setPageSearchError(
        t("projectsPanel.selectPageBeforeSaving", { ns: "dashboard" })
      )
      return
    }

    try {
      await onConfigureProjectNotionDestination(selectedProject.id, {
        parentPageId: selectedParentPageId,
        mode: notionMode,
      })
      setPageSearchError(null)
    } catch (error) {
      setPageSearchError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.saveDestinationError", { ns: "dashboard" })
      )
    }
  }

  const handleClearProjectDestination = async () => {
    try {
      await onClearProjectNotionDestination(selectedProject.id)
      setSelectedPageId(null)
      setPageResults([])
      setPageSearchError(null)
    } catch (error) {
      setPageSearchError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.clearDestinationError", { ns: "dashboard" })
      )
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">
          {t("projectsPanel.destinationModeTitle", { ns: "dashboard" })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("projectsPanel.destinationModeDescription", {
            ns: "dashboard",
          })}
        </p>

        <Select
          onValueChange={(value) =>
            setNotionMode(value as NotionProjectDestinationMode)
          }
          value={notionMode}
        >
          <SelectTrigger className="mt-3 h-11 w-full rounded-2xl border-border bg-background px-4 dark:border-white/10 dark:bg-slate-950/45">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PROJECT_PAGE">
              {t("projectsPanel.createDedicatedPageTitle", {
                ns: "dashboard",
              })}
            </SelectItem>
            <SelectItem value="EXISTING_PAGE">
              {t("projectsPanel.useExistingPageTitle", {
                ns: "dashboard",
              })}
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="mt-3 rounded-[1.1rem] border border-border/80 bg-background px-4 py-3 text-xs leading-5 text-muted-foreground dark:border-white/10 dark:bg-slate-950/45">
          {notionMode === "PROJECT_PAGE"
            ? t("projectsPanel.createDedicatedPageDescription", {
                ns: "dashboard",
              })
            : t("projectsPanel.useExistingPageDescription", {
                ns: "dashboard",
              })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 space-y-2 text-sm text-foreground">
            <span className="font-medium">
              {t("projectsPanel.searchSharedPageLabel", {
                ns: "dashboard",
              })}
            </span>
            <Input
              className="h-11 rounded-2xl border-border bg-background px-4 dark:border-white/10 dark:bg-slate-950/50"
              onChange={(event) => setPageQuery(event.target.value)}
              placeholder={t("projectsPanel.searchSharedPagePlaceholder", {
                ns: "dashboard",
              })}
              value={pageQuery}
            />
          </label>

          <Button
            disabled={isSearchingPages}
            onClick={() => void handleSearchPages()}
            type="button"
            variant="outline"
          >
            <Search />
            {isSearchingPages
              ? t("projectsPanel.searching", { ns: "dashboard" })
              : t("actions.search", { ns: "common" })}
          </Button>
        </div>

        {pageResults.length > 0 ? (
          <ScrollArea className="max-h-56 w-full">
            <div className="space-y-2 pr-3">
              {pageResults.map((page) => {
                const isSelected = page.id === selectedPageId

                return (
                  <Button
                    key={page.id}
                    className={cn(
                      "h-auto w-full justify-between rounded-[1rem] px-4 py-3 text-left",
                      isSelected
                        ? "border-primary/45 bg-primary/10 text-foreground hover:bg-primary/15"
                        : "border-border bg-background text-foreground hover:border-primary/30 hover:bg-muted/30 dark:border-white/10 dark:bg-slate-950/45"
                    )}
                    onClick={() => setSelectedPageId(page.id)}
                    type="button"
                    variant="outline"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {page.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {page.lastEditedTime
                          ? t("projectsPanel.lastEditedAt", {
                              ns: "dashboard",
                              value: formatMeetingDateTime(page.lastEditedTime),
                            })
                          : t("projectsPanel.unknownLastEdited", {
                              ns: "dashboard",
                            })}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      {t("projectsPanel.open", { ns: "dashboard" })}
                      <ArrowUpRight className="size-3" />
                    </span>
                    {isSelected ? (
                      <span className="text-xs font-medium text-primary">
                        {t("projectsPanel.selected", {
                          ns: "dashboard",
                        })}
                      </span>
                    ) : null}
                  </Button>
                )
              })}
            </div>
          </ScrollArea>
        ) : null}

        {pageSearchError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
            {pageSearchError}
          </div>
        ) : null}

        {selectedPageId ? (
          <div className="rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/45">
            <p className="font-medium text-foreground">
              {t("projectsPanel.selectedPageTitle", {
                ns: "dashboard",
              })}
            </p>
            <p className="mt-1">
              {selectedPage?.title ??
                t("projectsPanel.savedPageFallback", {
                  ns: "dashboard",
                })}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          disabled={
            !selectedPageId || activeNotionProjectId === selectedProject.id
          }
          onClick={() => void handleSaveProjectDestination()}
          type="button"
        >
          {activeNotionProjectId === selectedProject.id ? (
            <LoaderCircle className="animate-spin" />
          ) : null}
          {activeNotionProjectId === selectedProject.id
            ? t("projectsPanel.savingDestination", { ns: "dashboard" })
            : t("projectsPanel.saveDestination", { ns: "dashboard" })}
        </Button>

        {selectedProject.notionTaskDatabaseId ? (
          <Button
            onClick={() => void handleClearProjectDestination()}
            type="button"
            variant="outline"
          >
            <Unplug />
            {t("projectsPanel.clearDestination", {
              ns: "dashboard",
            })}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

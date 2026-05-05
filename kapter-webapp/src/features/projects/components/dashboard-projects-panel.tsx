import * as React from "react"
import {
  ArrowUpRight,
  FolderKanban,
  Link2,
  RefreshCw,
  Search,
  Sparkles,
  Unplug,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatMeetingDateTime } from "@/features/meetings/lib/formatters"

import type {
  ConfigureProjectNotionDestinationInput,
  CreateProjectInput,
  DashboardProjectSummary,
  NotionConnectionStatus,
  NotionPageSearchResult,
  NotionProjectDestinationMode,
  ProjectsRequestStatus,
} from "../types"

interface DashboardProjectsPanelProps {
  projects: DashboardProjectSummary[]
  status: ProjectsRequestStatus
  errorMessage: string | null
  isCreating: boolean
  notionConnection: NotionConnectionStatus | null
  notionStatus: ProjectsRequestStatus
  notionErrorMessage: string | null
  isConnectingNotion: boolean
  activeNotionProjectId: string | null
  onRefresh: () => Promise<void>
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

export function DashboardProjectsPanel({
  projects,
  status,
  errorMessage,
  isCreating,
  notionConnection,
  notionStatus,
  notionErrorMessage,
  isConnectingNotion,
  activeNotionProjectId,
  onRefresh,
  onRefreshNotion,
  onCreateProject,
  onConnectNotion,
  onSearchNotionPages,
  onConfigureProjectNotionDestination,
  onClearProjectNotionDestination,
}: DashboardProjectsPanelProps) {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [expandedProjectId, setExpandedProjectId] = React.useState<
    string | null
  >(null)
  const [notionMode, setNotionMode] =
    React.useState<NotionProjectDestinationMode>("PROJECT_PAGE")
  const [pageQuery, setPageQuery] = React.useState("")
  const [pageResults, setPageResults] = React.useState<
    NotionPageSearchResult[]
  >([])
  const [selectedPageId, setSelectedPageId] = React.useState<string | null>(
    null
  )
  const [isSearchingPages, setIsSearchingPages] = React.useState(false)
  const [pageSearchError, setPageSearchError] = React.useState<string | null>(
    null
  )
  const { t } = useTranslation(["dashboard", "common"])

  const selectedPage = React.useMemo(
    () => pageResults.find((page) => page.id === selectedPageId) ?? null,
    [pageResults, selectedPageId]
  )

  const resetNotionSetupState = React.useCallback(() => {
    setNotionMode("PROJECT_PAGE")
    setPageQuery("")
    setPageResults([])
    setSelectedPageId(null)
    setPageSearchError(null)
  }, [])

  const handleToggleProjectSetup = (project: DashboardProjectSummary) => {
    if (expandedProjectId === project.id) {
      setExpandedProjectId(null)
      resetNotionSetupState()
      return
    }

    setExpandedProjectId(project.id)
    setNotionMode(project.notionDestinationMode ?? "PROJECT_PAGE")
    setPageQuery("")
    setPageResults([])
    setSelectedPageId(project.notionProjectPageId)
    setPageSearchError(null)
  }

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

  const handleSaveProjectDestination = async (projectId: string) => {
    const selectedParentPageId = selectedPage?.id ?? selectedPageId

    if (!selectedParentPageId) {
      setPageSearchError(
        t("projectsPanel.selectPageBeforeSaving", { ns: "dashboard" })
      )
      return
    }

    try {
      await onConfigureProjectNotionDestination(projectId, {
        parentPageId: selectedParentPageId,
        mode: notionMode,
      })
      setExpandedProjectId(null)
      resetNotionSetupState()
    } catch (error) {
      setPageSearchError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.saveDestinationError", { ns: "dashboard" })
      )
    }
  }

  const handleClearProjectDestination = async (projectId: string) => {
    try {
      await onClearProjectNotionDestination(projectId)
      if (expandedProjectId === projectId) {
        setExpandedProjectId(null)
        resetNotionSetupState()
      }
    } catch (error) {
      setPageSearchError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.clearDestinationError", { ns: "dashboard" })
      )
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      setFormError(t("projectsPanel.projectTitleRequired", { ns: "dashboard" }))
      return
    }

    setFormError(null)

    try {
      await onCreateProject({
        title: normalizedTitle,
        description,
        initialDescription: description,
      })
      setTitle("")
      setDescription("")
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : t("projectsPanel.createProjectError", { ns: "dashboard" })
      )
    }
  }

  return (
    <Card className="border-border/70 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle>{t("projectsPanel.title", { ns: "dashboard" })}</CardTitle>
          <CardDescription>
            {t("projectsPanel.description", { ns: "dashboard" })}
          </CardDescription>
        </div>

        <Button
          className="dark:border-white/10 dark:bg-white/6 dark:text-slate-50 dark:hover:bg-white/12"
          variant="outline"
          onClick={() => void onRefresh()}
        >
          <RefreshCw />
          {t("actions.refresh", { ns: "common" })}
        </Button>
      </CardHeader>

      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        <div className="lg:col-span-2">
          <div className="rounded-[1.5rem] border border-border/80 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {t("projectsPanel.notionWorkspaceTitle", {
                      ns: "dashboard",
                    })}
                  </p>
                  {notionConnection?.connected ? (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] text-emerald-700 uppercase dark:text-emerald-200">
                      {t("projectsPanel.connected", { ns: "dashboard" })}
                    </span>
                  ) : notionConnection?.oauthConfigured ? (
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] text-amber-700 uppercase dark:text-amber-200">
                      {t("projectsPanel.setupNeeded", { ns: "dashboard" })}
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase dark:border-white/10 dark:bg-slate-950/55">
                      {t("projectsPanel.unavailable", { ns: "dashboard" })}
                    </span>
                  )}
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
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

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="dark:border-white/10 dark:bg-white/6 dark:text-slate-50 dark:hover:bg-white/12"
                  onClick={() => void onRefreshNotion()}
                  variant="outline"
                >
                  <RefreshCw />
                  {t("projectsPanel.refreshStatus", { ns: "dashboard" })}
                </Button>

                <Button
                  disabled={
                    !notionConnection?.oauthConfigured || isConnectingNotion
                  }
                  onClick={() => void onConnectNotion()}
                >
                  <Link2 />
                  {isConnectingNotion
                    ? t("projectsPanel.connectingNotion", { ns: "dashboard" })
                    : t("projectsPanel.connectNotion", { ns: "dashboard" })}
                </Button>
              </div>
            </div>

            {notionStatus === "loading" ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("projectsPanel.loadingWorkspace", { ns: "dashboard" })}
              </p>
            ) : null}

            {notionErrorMessage ? (
              <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
                {notionErrorMessage}
              </div>
            ) : null}
          </div>
        </div>

        <form
          className="rounded-[1.5rem] border border-border/80 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/4"
          onSubmit={handleSubmit}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary dark:bg-primary/18">
              <Sparkles className="size-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">
                {t("projectsPanel.newProjectTitle", { ns: "dashboard" })}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("projectsPanel.newProjectDescription", { ns: "dashboard" })}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block space-y-2 text-sm text-foreground">
              <span className="font-medium">
                {t("projectsPanel.projectNameLabel", { ns: "dashboard" })}
              </span>
              <input
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground transition outline-none focus:border-primary/60 focus:ring-3 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-950/50"
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("projectsPanel.projectNamePlaceholder", {
                  ns: "dashboard",
                })}
                value={title}
              />
            </label>

            <label className="block space-y-2 text-sm text-foreground">
              <span className="font-medium">
                {t("projectsPanel.projectDescriptionLabel", {
                  ns: "dashboard",
                })}
              </span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground transition outline-none focus:border-primary/60 focus:ring-3 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-950/50"
                maxLength={800}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("projectsPanel.projectDescriptionPlaceholder", {
                  ns: "dashboard",
                })}
                value={description}
              />
            </label>
          </div>

          {formError ? (
            <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
              {formError}
            </div>
          ) : null}

          <Button className="mt-4 w-full" disabled={isCreating} type="submit">
            {isCreating
              ? t("projectsPanel.creatingProject", { ns: "dashboard" })
              : t("projectsPanel.createProject", { ns: "dashboard" })}
          </Button>
        </form>

        <div className="space-y-3">
          {status === "loading" && projects.length === 0
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`project-skeleton-${index}`}
                  className="rounded-[1.5rem] border border-border/80 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/4"
                >
                  <div className="h-5 animate-pulse rounded-full bg-muted" />
                  <div className="mt-3 h-4 animate-pulse rounded-full bg-muted" />
                  <div className="mt-2 h-4 animate-pulse rounded-full bg-muted" />
                </div>
              ))
            : null}

          {status === "error" && projects.length === 0 ? (
            <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/8 px-4 py-4 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
              {errorMessage ||
                t("projectsPanel.loadProjectsError", { ns: "dashboard" })}
            </div>
          ) : null}

          {status !== "loading" && projects.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/35 p-6 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/4">
              {t("projectsPanel.emptyProjects", { ns: "dashboard" })}
            </div>
          ) : null}

          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-[1.5rem] border border-border/80 bg-background px-4 py-4 dark:border-white/10 dark:bg-slate-950/55"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-medium text-foreground">
                      {project.title}
                    </p>
                    {project.isDraft ? (
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] text-amber-700 uppercase dark:text-amber-200">
                        {t("projectsPanel.draftBadge", { ns: "dashboard" })}
                      </span>
                    ) : null}
                    {project.notionTaskDatabaseId ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] text-emerald-700 uppercase dark:text-emerald-200">
                        {t("projectsPanel.notionReadyBadge", {
                          ns: "dashboard",
                        })}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {project.description ||
                      t("projectsPanel.missingProjectDescription", {
                        ns: "dashboard",
                      })}
                  </p>
                </div>

                <div className="rounded-2xl bg-primary/10 p-2 text-primary dark:bg-primary/18">
                  <FolderKanban className="size-4" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs tracking-[0.08em] text-muted-foreground uppercase">
                <span>
                  {t("projectsPanel.meetingCount", {
                    ns: "dashboard",
                    count: project.meetingCount,
                  })}
                </span>
                <span>
                  {t("projectsPanel.updatedAt", {
                    ns: "dashboard",
                    value: formatMeetingDateTime(project.updatedAt),
                  })}
                </span>
                {project.notionTaskDatabaseId ? (
                  <span>
                    {project.notionDestinationMode === "EXISTING_PAGE"
                      ? t("projectsPanel.existingPage", { ns: "dashboard" })
                      : t("projectsPanel.dedicatedPage", { ns: "dashboard" })}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  disabled={!notionConnection?.connected}
                  onClick={() => handleToggleProjectSetup(project)}
                  type="button"
                  variant="outline"
                >
                  <Link2 />
                  {project.notionTaskDatabaseId
                    ? t("projectsPanel.editNotion", { ns: "dashboard" })
                    : t("projectsPanel.setupNotion", { ns: "dashboard" })}
                </Button>

                {project.notionTaskDatabaseId ? (
                  <Button
                    disabled={activeNotionProjectId === project.id}
                    onClick={() =>
                      void handleClearProjectDestination(project.id)
                    }
                    type="button"
                    variant="outline"
                    >
                      <Unplug />
                      {activeNotionProjectId === project.id
                        ? t("projectsPanel.clearingDestination", {
                            ns: "dashboard",
                          })
                        : t("projectsPanel.clearDestination", {
                            ns: "dashboard",
                          })}
                  </Button>
                ) : null}
              </div>

              {expandedProjectId === project.id ? (
                <div className="mt-4 rounded-[1.25rem] border border-border/80 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4">
                  {!notionConnection?.connected ? (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t("projectsPanel.connectWorkspaceFirst", {
                        ns: "dashboard",
                      })}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {t("projectsPanel.destinationModeTitle", {
                            ns: "dashboard",
                          })}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("projectsPanel.destinationModeDescription", {
                            ns: "dashboard",
                          })}
                        </p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            className={`rounded-[1.1rem] border px-4 py-3 text-left transition ${
                              notionMode === "PROJECT_PAGE"
                                ? "border-primary/45 bg-primary/10 text-foreground"
                                : "border-border bg-background text-muted-foreground dark:border-white/10 dark:bg-slate-950/45"
                            }`}
                            onClick={() => setNotionMode("PROJECT_PAGE")}
                            type="button"
                          >
                            <p className="text-sm font-medium">
                              {t("projectsPanel.createDedicatedPageTitle", {
                                ns: "dashboard",
                              })}
                            </p>
                            <p className="mt-1 text-xs leading-5">
                              {t(
                                "projectsPanel.createDedicatedPageDescription",
                                {
                                  ns: "dashboard",
                                }
                              )}
                            </p>
                          </button>

                          <button
                            className={`rounded-[1.1rem] border px-4 py-3 text-left transition ${
                              notionMode === "EXISTING_PAGE"
                                ? "border-primary/45 bg-primary/10 text-foreground"
                                : "border-border bg-background text-muted-foreground dark:border-white/10 dark:bg-slate-950/45"
                            }`}
                            onClick={() => setNotionMode("EXISTING_PAGE")}
                            type="button"
                          >
                            <p className="text-sm font-medium">
                              {t("projectsPanel.useExistingPageTitle", {
                                ns: "dashboard",
                              })}
                            </p>
                            <p className="mt-1 text-xs leading-5">
                              {t(
                                "projectsPanel.useExistingPageDescription",
                                {
                                  ns: "dashboard",
                                }
                              )}
                            </p>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="min-w-0 flex-1 space-y-2 text-sm text-foreground">
                            <span className="font-medium">
                              {t("projectsPanel.searchSharedPageLabel", {
                                ns: "dashboard",
                              })}
                            </span>
                            <div className="flex gap-2">
                              <input
                                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground transition outline-none focus:border-primary/60 focus:ring-3 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-950/50"
                                onChange={(event) =>
                                  setPageQuery(event.target.value)
                                }
                                placeholder={t(
                                  "projectsPanel.searchSharedPagePlaceholder",
                                  {
                                    ns: "dashboard",
                                  }
                                )}
                                value={pageQuery}
                              />
                            </div>
                          </label>

                          <Button
                            disabled={isSearchingPages}
                            onClick={() => void handleSearchPages()}
                            type="button"
                            variant="outline"
                          >
                            <Search />
                            {isSearchingPages
                              ? t("projectsPanel.searching", {
                                  ns: "dashboard",
                                })
                              : t("actions.search", { ns: "common" })}
                          </Button>
                        </div>

                        {pageResults.length > 0 ? (
                          <div className="space-y-2">
                            {pageResults.map((page) => {
                              const isSelected = page.id === selectedPageId

                              return (
                                <button
                                  key={page.id}
                                  className={`flex w-full items-center justify-between gap-4 rounded-[1rem] border px-4 py-3 text-left transition ${
                                    isSelected
                                      ? "border-primary/45 bg-primary/10"
                                      : "border-border bg-background hover:border-primary/30 hover:bg-muted/30 dark:border-white/10 dark:bg-slate-950/45"
                                  }`}
                                  onClick={() => setSelectedPageId(page.id)}
                                  type="button"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      {page.title}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {page.lastEditedTime
                                        ? t("projectsPanel.lastEditedAt", {
                                            ns: "dashboard",
                                            value: formatMeetingDateTime(
                                              page.lastEditedTime
                                            ),
                                          })
                                        : t("projectsPanel.unknownLastEdited", {
                                            ns: "dashboard",
                                          })}
                                    </p>
                                  </div>

                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                    {t("projectsPanel.open", {
                                      ns: "dashboard",
                                    })}
                                    <ArrowUpRight className="size-3" />
                                  </span>
                                  {isSelected ? (
                                    <span className="text-xs font-medium text-primary">
                                      {t("projectsPanel.selected", {
                                        ns: "dashboard",
                                      })}
                                    </span>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
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

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          disabled={
                            !selectedPageId ||
                            activeNotionProjectId === project.id
                          }
                          onClick={() =>
                            void handleSaveProjectDestination(project.id)
                          }
                          type="button"
                        >
                          {activeNotionProjectId === project.id
                            ? t("projectsPanel.savingDestination", {
                                ns: "dashboard",
                              })
                            : t("projectsPanel.saveDestination", {
                                ns: "dashboard",
                              })}
                        </Button>

                        <Button
                          onClick={() => handleToggleProjectSetup(project)}
                          type="button"
                          variant="outline"
                        >
                          {t("actions.cancel", { ns: "common" })}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}

          {status === "error" && projects.length > 0 && errorMessage ? (
            <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:border-destructive/30 dark:bg-destructive/16 dark:text-red-200">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

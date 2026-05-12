import * as React from "react"
import { useSearchParams } from "react-router"

import { AppShellContainer } from "@/components/app-shell-container"
import { GuidedDashboard } from "@/components/dashboard/guided-dashboard"
import { useActiveMeeting } from "@/features/meetings/hooks/use-active-meeting"
import { useDashboardMeetingHistory } from "@/features/meetings/context/dashboard-meeting-history"
import { useProjects } from "@/features/projects/hooks/use-projects"
import { DashboardMetricGrid } from "@/components/dashboard/dashboard-metric-grid"
import { DashboardNotionCallbackBanner } from "@/components/dashboard/dashboard-notion-callback-banner"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { DashboardProjectSetupSection } from "@/components/dashboard/dashboard-project-setup-section"
import { ErrorBanner } from "@/components/dashboard/error-banner"
import { MeetingPanel } from "@/components/dashboard/meeting-panel"
import { ProjectPanel } from "@/components/dashboard/project-panel"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ActiveSessionBanner } from "@/features/meetings/components/active-session-banner"
import { useDashboardMode } from "@/features/dashboard/hooks/use-dashboard-mode"

import type { DashboardMeetingSummary } from "@/features/meetings/types"
import { scrollToSection } from "@/lib/utils"

type MeetingStatusFilter = "all" | DashboardMeetingSummary["status"]
type MeetingReviewFilter =
  | "all"
  | DashboardMeetingSummary["artifactReviewStatus"]

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sidebarStatus = searchParams.get("sidebar_status")
  const {
    activeMeeting,
    status: activeMeetingStatus,
    errorMessage: activeMeetingError,
    refresh: refreshActiveMeeting,
  } = useActiveMeeting()
  const {
    meetings,
    status: historyStatus,
    activeMeetingDeleteId,
    deleteMeeting,
    refresh: refreshMeetingHistory,
  } = useDashboardMeetingHistory()
  const {
    projects,
    status: projectsStatus,
    errorMessage: projectsErrorMessage,
    isCreating,
    activeProjectUpdateId,
    activeProjectDeleteId,
    refresh: refreshProjects,
    createProject,
    getProjectDetail,
    updateProject,
    deleteProject,
    notionConnection,
    notionStatus,
    notionErrorMessage,
    isConnectingNotion,
    activeNotionProjectId,
    refreshNotionConnection,
    connectNotion,
    searchNotionPages,
    configureProjectNotionDestination,
    clearProjectNotionDestination,
  } = useProjects()
  const notionCallbackStatus = searchParams.get("notion_status")
  const notionCallbackReason = searchParams.get("reason")
  const [selectedProjectId, setSelectedProjectId] = React.useState<
    string | "all"
  >("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] =
    React.useState<MeetingStatusFilter>("all")
  const [reviewFilter, setReviewFilter] =
    React.useState<MeetingReviewFilter>("all")
  const [activeMetricId, setActiveMetricId] = React.useState("all")
  const sidebarMetricId = React.useMemo(() => {
    switch (sidebarStatus) {
      case "processing":
        return "live"
      case "review":
        return "review"
      case "approved":
        return "approved"
      default:
        return null
    }
  }, [sidebarStatus])
  const effectiveMetricId = sidebarMetricId ?? activeMetricId
  const hasApprovedReview = React.useMemo(
    () =>
      meetings.some((meeting) => meeting.artifactReviewStatus === "APPROVED"),
    [meetings]
  )
  const {
    coachmarkDismissed,
    dismissCoachmark,
    hasStoredMode,
    mode: dashboardMode,
    setMode: setDashboardMode,
  } = useDashboardMode(hasApprovedReview)
  const shouldForceStandardMode =
    sidebarMetricId !== null || notionCallbackStatus !== null
  const effectiveDashboardMode = shouldForceStandardMode
    ? "standard"
    : dashboardMode

  const activeMeetingKey = activeMeeting
    ? `${activeMeeting.id}:${activeMeeting.status}`
    : "idle"
  const previousActiveMeetingKey = React.useRef(activeMeetingKey)

  React.useEffect(() => {
    if (previousActiveMeetingKey.current === activeMeetingKey) {
      return
    }

    previousActiveMeetingKey.current = activeMeetingKey
    void refreshMeetingHistory()
  }, [activeMeetingKey, refreshMeetingHistory])

  React.useEffect(() => {
    if (!notionCallbackStatus) {
      return
    }

    void refreshNotionConnection()
  }, [notionCallbackStatus, refreshNotionConnection])

  const dismissNotionCallbackBanner = React.useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams)

    nextSearchParams.delete("notion_status")
    nextSearchParams.delete("reason")
    setSearchParams(nextSearchParams, { replace: true })
  }, [searchParams, setSearchParams])

  const clearSidebarStatusParam = React.useCallback(() => {
    if (!searchParams.has("sidebar_status")) {
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete("sidebar_status")
    setSearchParams(nextSearchParams, { replace: true })
  }, [searchParams, setSearchParams])

  const effectiveSelectedProjectId = React.useMemo(() => {
    if (selectedProjectId === "all") {
      return "all"
    }

    return projects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : "all"
  }, [projects, selectedProjectId])

  const filteredMeetings = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return meetings.filter((meeting) => {
      if (
        effectiveMetricId === "live" &&
        meeting.status !== "RECORDING" &&
        meeting.status !== "PROCESSING"
      ) {
        return false
      }

      if (
        effectiveMetricId === "review" &&
        meeting.artifactReviewStatus !== "READY"
      ) {
        return false
      }

      if (
        effectiveMetricId === "approved" &&
        meeting.artifactReviewStatus !== "APPROVED"
      ) {
        return false
      }

      if (
        effectiveSelectedProjectId !== "all" &&
        meeting.projectId !== effectiveSelectedProjectId
      ) {
        return false
      }

      if (statusFilter !== "all" && meeting.status !== statusFilter) {
        return false
      }

      if (
        reviewFilter !== "all" &&
        meeting.artifactReviewStatus !== reviewFilter
      ) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        meeting.title,
        meeting.externalMeetingId,
        meeting.projectTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [
    effectiveMetricId,
    effectiveSelectedProjectId,
    meetings,
    reviewFilter,
    searchQuery,
    statusFilter,
  ])

  const dashboardMetrics = React.useMemo(() => {
    const liveCount = meetings.filter(
      (meeting) =>
        meeting.status === "RECORDING" || meeting.status === "PROCESSING"
    ).length

    const reviewCount = meetings.filter(
      (meeting) => meeting.artifactReviewStatus === "READY"
    ).length

    const approvedCount = meetings.filter(
      (meeting) => meeting.artifactReviewStatus === "APPROVED"
    ).length

    return {
      liveCount,
      reviewCount,
      approvedCount,
      projectCount: projects.length,
    }
  }, [meetings, projects.length])

  const clearFilters = React.useCallback(() => {
    setSelectedProjectId("all")
    setSearchQuery("")
    setStatusFilter("all")
    setReviewFilter("all")
    setActiveMetricId("all")
    clearSidebarStatusParam()
  }, [clearSidebarStatusParam])

  const handleMetricClick = (id: string) => {
    clearSidebarStatusParam()
    setActiveMetricId((prev) => (prev === id ? "all" : id))
    setStatusFilter("all")
    setReviewFilter("all")
  }

  const handleStatusFilterChange = (value: MeetingStatusFilter) => {
    clearSidebarStatusParam()
    setActiveMetricId("all")
    setStatusFilter(value)
  }

  const handleReviewFilterChange = (value: MeetingReviewFilter) => {
    clearSidebarStatusParam()
    setActiveMetricId("all")
    setReviewFilter(value)
  }

  const hasActiveFilters =
    effectiveMetricId !== "all" ||
    effectiveSelectedProjectId !== "all" ||
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    reviewFilter !== "all"
  const showGuidedCoachmark =
    effectiveDashboardMode === "standard" &&
    dashboardMode === "standard" &&
    !hasApprovedReview &&
    !coachmarkDismissed

  const openGuidedDashboard = React.useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams)

    nextSearchParams.delete("sidebar_status")
    nextSearchParams.delete("notion_status")
    nextSearchParams.delete("reason")

    setSearchParams(nextSearchParams, { replace: true })
    setDashboardMode("guided")
  }, [searchParams, setDashboardMode, setSearchParams])

  const openStandardDashboard = React.useCallback(() => {
    dismissCoachmark()
    setDashboardMode("standard")
  }, [dismissCoachmark, setDashboardMode])

  if (
    !shouldForceStandardMode &&
    !hasStoredMode &&
    historyStatus === "loading"
  ) {
    return (
      <AppShellContainer className="space-y-5 py-6">
        <Card
          className="rounded-[1.85rem] border border-border/70 bg-white/82 py-0 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.36)] dark:border-white/10 dark:bg-white/5"
          size="sm"
        >
          <CardContent className="space-y-4 p-5 sm:p-6">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="grid gap-3 lg:grid-cols-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          </CardContent>
        </Card>
      </AppShellContainer>
    )
  }

  if (effectiveDashboardMode === "guided") {
    return (
      <GuidedDashboard
        activeMeeting={activeMeeting}
        meetings={meetings}
        meetingsStatus={historyStatus}
        onRefreshMeetings={refreshMeetingHistory}
        onSwitchToStandard={openStandardDashboard}
      />
    )
  }

  return (
    <AppShellContainer className="space-y-5 py-6">
      <DashboardPageHeader
        meetingCount={meetings.length}
        onDismissGuidedCoachmark={dismissCoachmark}
        onOpenGuidedDashboard={openGuidedDashboard}
        projectCount={projects.length}
        showGuidedCoachmark={showGuidedCoachmark}
      />

      {historyStatus === "error" && (
        <ErrorBanner onRetry={() => void refreshMeetingHistory()} />
      )}

      <DashboardMetricGrid
        metrics={dashboardMetrics}
        activeMetricId={effectiveMetricId}
        onMetricClick={handleMetricClick}
      />

      {notionCallbackStatus ? (
        <DashboardNotionCallbackBanner
          onDismiss={dismissNotionCallbackBanner}
          reason={notionCallbackReason}
          status={notionCallbackStatus}
        />
      ) : null}

      <DashboardProjectSetupSection
        activeNotionProjectId={activeNotionProjectId}
        isConnectingNotion={isConnectingNotion}
        isCreating={isCreating}
        notionConnection={notionConnection}
        notionErrorMessage={notionErrorMessage}
        notionStatus={notionStatus}
        onClearProjectNotionDestination={clearProjectNotionDestination}
        onConfigureProjectNotionDestination={configureProjectNotionDestination}
        onConnectNotion={connectNotion}
        onCreateProject={createProject}
        onRefreshNotion={refreshNotionConnection}
        onRefreshProjects={refreshProjects}
        onSearchNotionPages={searchNotionPages}
        projects={projects}
        selectedProjectId={effectiveSelectedProjectId}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <ActiveSessionBanner
            activeMeeting={activeMeeting}
            status={activeMeetingStatus}
            errorMessage={activeMeetingError}
            onRefresh={refreshActiveMeeting}
          />

          <MeetingPanel
            activeMeetingDeleteId={activeMeetingDeleteId}
            filtersActive={hasActiveFilters}
            meetings={filteredMeetings}
            onClearFilters={clearFilters}
            onDeleteMeeting={deleteMeeting}
            onRefresh={refreshMeetingHistory}
            onReviewFilterChange={handleReviewFilterChange}
            onSearchQueryChange={setSearchQuery}
            onStatusFilterChange={handleStatusFilterChange}
            reviewFilter={reviewFilter}
            searchQuery={searchQuery}
            status={historyStatus}
            statusFilter={statusFilter}
            totalMeetings={meetings.length}
          />
        </div>

        <ProjectPanel
          activeProjectDeleteId={activeProjectDeleteId}
          activeProjectUpdateId={activeProjectUpdateId}
          errorMessage={projectsErrorMessage}
          networkError={historyStatus === "error"}
          notionConnection={notionConnection}
          onDeleteProject={async (projectId) => {
            const deletedProjectId = await deleteProject(projectId)
            await Promise.all([refreshMeetingHistory(), refreshActiveMeeting()])
            return deletedProjectId
          }}
          onGetProjectDetail={getProjectDetail}
          onSelectProjectId={(projectId) => {
            setActiveMetricId("all")
            setSelectedProjectId(projectId)
            scrollToSection("notion-setup-section")
          }}
          onUpdateProject={updateProject}
          projects={projects}
          selectedProjectId={effectiveSelectedProjectId}
          status={projectsStatus}
        />
      </div>
    </AppShellContainer>
  )
}

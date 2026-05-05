import * as React from "react"
import { CalendarDays, FolderKanban, ListFilter, Search } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MeetingHistoryList } from "@/features/meetings/components/meeting-history-list"

import type {
  DashboardMeetingSummary,
  MeetingsRequestStatus,
} from "@/features/meetings/types"
import type { DashboardProjectSummary } from "@/features/projects/types"

type MeetingStatusFilter = "all" | DashboardMeetingSummary["status"]
type MeetingReviewFilter =
  | "all"
  | DashboardMeetingSummary["artifactReviewStatus"]

const dashboardDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
})

function formatDashboardDate(value: Date) {
  return dashboardDateFormatter.format(value)
}

function getProjectStatus(project: DashboardProjectSummary) {
  if (project.notionTaskDatabaseId) {
    return {
      label: "Notion sẵn sàng",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    }
  }

  if (project.isDraft) {
    return {
      label: "Bản nháp",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200",
    }
  }

  return {
    label: "Cần thiết lập",
    className: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  }
}

interface DashboardWorkspaceProps {
  projects: DashboardProjectSummary[]
  meetings: DashboardMeetingSummary[]
  filteredMeetings: DashboardMeetingSummary[]
  effectiveSelectedProjectId: string | "all"
  searchQuery: string
  statusFilter: MeetingStatusFilter
  reviewFilter: MeetingReviewFilter
  createdAfter: Date | undefined
  hasActiveFilters: boolean
  historyStatus: MeetingsRequestStatus
  historyError: string | null
  onSelectProjectId: (projectId: string | "all") => void
  onSearchQueryChange: (value: string) => void
  onStatusFilterChange: (value: MeetingStatusFilter) => void
  onReviewFilterChange: (value: MeetingReviewFilter) => void
  onCreatedAfterChange: (value: Date | undefined) => void
  onClearFilters: () => void
  onRefreshProjects: () => Promise<void>
  onRefreshMeetingHistory: () => Promise<void>
}

export function DashboardWorkspace({
  projects,
  meetings,
  filteredMeetings,
  effectiveSelectedProjectId,
  searchQuery,
  statusFilter,
  reviewFilter,
  createdAfter,
  hasActiveFilters,
  historyStatus,
  historyError,
  onSelectProjectId,
  onSearchQueryChange,
  onStatusFilterChange,
  onReviewFilterChange,
  onCreatedAfterChange,
  onClearFilters,
  onRefreshProjects,
  onRefreshMeetingHistory,
}: DashboardWorkspaceProps) {
  const projectOptions = React.useMemo(
    () => [
      {
        id: "all",
        title: "Tất cả dự án",
        description: "Xem tất cả cuộc họp trong không gian làm việc.",
        meetingCount: meetings.length,
        notionTaskDatabaseId: null,
        notionDestinationMode: null,
        notionProjectPageId: null,
        isDraft: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...projects,
    ],
    [meetings.length, projects]
  )

  const selectedProject = React.useMemo(() => {
    if (effectiveSelectedProjectId === "all") {
      return null
    }

    return (
      projects.find((project) => project.id === effectiveSelectedProjectId) ??
      null
    )
  }, [effectiveSelectedProjectId, projects])

  return (
    <div className="rounded-[2rem] border border-border/70 bg-background/90 p-3 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.4)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.84))] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.85)]">
      <ResizablePanelGroup className="min-h-[48rem]" orientation="horizontal">
        <ResizablePanel className="min-w-0" defaultSize={34} minSize={22}>
          <div className="flex h-full flex-col gap-4 p-3">
            <div className="rounded-[1.75rem] border border-border/80 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    Bộ lọc dự án
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    Lọc cuộc họp theo dự án
                  </p>
                </div>
                <Button
                  onClick={() => void onRefreshProjects()}
                  size="sm"
                  variant="outline"
                >
                  Làm mới
                </Button>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Chọn một dự án để thu hẹp danh sách, hoặc giữ ở chế độ tổng quan để xem tất cả.
              </p>
            </div>

            <ScrollArea className="min-h-0 grow rounded-[1.75rem] border border-border/80 bg-muted/20 dark:border-white/10 dark:bg-white/3">
              <div className="space-y-3 p-3">
                {projectOptions.map((project) => {
                  const isActive = project.id === effectiveSelectedProjectId
                  const projectState = getProjectStatus(project)

                  return (
                    <button
                      className={[
                        "w-full cursor-pointer rounded-[1.5rem] border px-4 py-4 text-left transition duration-200",
                        isActive
                          ? "border-primary/40 bg-primary/10 shadow-sm dark:border-primary/50 dark:bg-primary/14"
                          : "border-border/80 bg-background hover:bg-muted/20 dark:border-white/10 dark:bg-slate-950/55 dark:hover:bg-white/8",
                      ].join(" ")}
                      key={project.id}
                      onClick={() => onSelectProjectId(project.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {project.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {project.description ||
                              (project.id === "all"
                                ? project.description
                                : "Chưa có mô tả dự án.")}
                          </p>
                        </div>
                        <Badge
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${projectState.className}`}
                        >
                          {projectState.label}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <FolderKanban className="size-3.5" />
                          {project.meetingCount} cuộc họp
                        </span>
                        <span>
                          {project.id === "all"
                            ? "Tất cả"
                            : project.notionTaskDatabaseId
                              ? "Sẵn sàng đồng bộ"
                              : "Chưa thiết lập"}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>

            {selectedProject ? (
              <div className="rounded-[1.75rem] border border-border/80 bg-background px-4 py-4 dark:border-white/10 dark:bg-slate-950/55">
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Dự án đang chọn
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {selectedProject.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selectedProject.description ||
                    "Dự án này chưa có mô tả. Hãy thêm mô tả để dễ xem xét hơn."}
                </p>
                <Separator className="my-4" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge className="rounded-full border border-border/80 bg-muted/35 px-2.5 py-1 text-[11px] dark:border-white/10 dark:bg-white/6">
                    {selectedProject.meetingCount} cuộc họp
                  </Badge>
                  <Badge className="rounded-full border border-border/80 bg-muted/35 px-2.5 py-1 text-[11px] dark:border-white/10 dark:bg-white/6">
                    Cập nhật{" "}
                    {formatDashboardDate(new Date(selectedProject.updatedAt))}
                  </Badge>
                </div>
              </div>
            ) : null}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel className="min-w-0" defaultSize={66} minSize={50}>
          <div className="flex h-full flex-col gap-5 p-3">
            <div className="rounded-[1.75rem] border border-border/80 bg-muted/25 p-4 dark:border-white/10 dark:bg-white/4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    Danh sách cuộc họp
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">
                    {selectedProject
                      ? `Hàng đợi: ${selectedProject.title}`
                      : "Xem lại cuộc họp tất cả dự án"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Tìm kiếm theo tên hoặc dự án, lọc theo trạng thái, sau đó mở chi tiết để xem bản ghi và đồng bộ sang Notion.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-border/80 bg-background px-3 py-1 text-[11px] tracking-[0.14em] text-muted-foreground uppercase dark:border-white/10 dark:bg-slate-950/55">
                    {historyStatus === "loading" ? "Đang tải" : "Dữ liệu mới nhất"}
                  </Badge>
                  {hasActiveFilters ? (
                    <Button
                      onClick={onClearFilters}
                      size="sm"
                      variant="outline"
                    >
                      Xóa bộ lọc
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.9fr))]">
                <label className="flex min-w-0 items-center gap-3 rounded-[1.35rem] border border-border/80 bg-background px-3 py-2.5 dark:border-white/10 dark:bg-slate-950/55">
                  <Search className="size-4 text-muted-foreground" />
                  <Input
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                    onChange={(event) =>
                      onSearchQueryChange(event.target.value)
                    }
                    placeholder="Tìm theo tên, dự án..."
                    value={searchQuery}
                  />
                </label>

                <Select
                  onValueChange={(value) =>
                    onStatusFilterChange(value as MeetingStatusFilter)
                  }
                  value={statusFilter}
                >
                  <SelectTrigger className="w-full justify-between rounded-[1.35rem] border border-border/80 bg-background dark:border-white/10 dark:bg-slate-950/55">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="RECORDING">Đang ghi âm</SelectItem>
                    <SelectItem value="PROCESSING">Đang xử lý</SelectItem>
                    <SelectItem value="COMPLETED">Hoàn thành</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  onValueChange={(value) =>
                    onReviewFilterChange(value as MeetingReviewFilter)
                  }
                  value={reviewFilter}
                >
                  <SelectTrigger className="w-full justify-between rounded-[1.35rem] border border-border/80 bg-background dark:border-white/10 dark:bg-slate-950/55">
                    <SelectValue placeholder="Trạng thái duyệt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="PENDING">Chờ trích xuất</SelectItem>
                    <SelectItem value="READY">Chờ duyệt</SelectItem>
                    <SelectItem value="FAILED">Trích xuất lỗi</SelectItem>
                    <SelectItem value="APPROVED">Đã duyệt</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      className="justify-start rounded-[1.35rem] border border-border/80 bg-background text-left font-normal dark:border-white/10 dark:bg-slate-950/55"
                      variant="outline"
                    >
                      <CalendarDays className="size-4 text-muted-foreground" />
                      {createdAfter
                        ? `Tạo sau ${formatDashboardDate(createdAfter)}`
                        : "Tạo sau ngày"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      onSelect={onCreatedAfterChange}
                      selected={createdAfter}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Accordion
                className="mt-4 border-border/80 bg-background/60 dark:border-white/10 dark:bg-slate-950/40"
                collapsible
                type="single"
              >
                <AccordionItem value="advanced-filters">
                  <AccordionTrigger className="items-center px-4 py-3 hover:no-underline">
                    <span className="inline-flex items-center gap-2">
                      <ListFilter className="size-4 text-muted-foreground" />
                      Ghi chú bộ lọc nâng cao
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
                        <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                          Phạm vi hiện tại
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          {selectedProject
                            ? `Chỉ xem cuộc họp của: ${selectedProject.title}.`
                            : "Đang xem tất cả dự án trong không gian làm việc."}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
                        <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                          Trạng thái bộ lọc
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          {hasActiveFilters
                            ? "Bộ lọc đang thu hẹp danh sách cuộc họp."
                            : "Chưa áp dụng bộ lọc. Đang hiển thị toàn bộ danh sách."}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10 dark:bg-white/4">
                        <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                          Bước tiếp theo
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          Mở chi tiết cuộc họp để xem bản ghi, phê duyệt và đồng bộ sang Notion.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <MeetingHistoryList
              meetings={filteredMeetings}
              status={historyStatus}
              errorMessage={historyError}
              onRefresh={onRefreshMeetingHistory}
              filtersActive={hasActiveFilters}
              onClearFilters={onClearFilters}
              totalMeetings={meetings.length}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

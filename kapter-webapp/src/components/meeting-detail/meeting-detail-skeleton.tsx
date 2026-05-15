import { AppShellContainer } from "@/components/app-shell-container"
import { Skeleton } from "@/components/ui/skeleton"

export function MeetingDetailSkeleton() {
  return (
    <AppShellContainer className="flex min-h-[calc(100svh-6rem)] flex-col gap-4 py-5">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Overview card */}
      <div className="rounded-[1.85rem] border border-border/70 bg-white/82 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>

      {/* Workflow rail */}
      <Skeleton className="h-10 w-full" />

      {/* Review panel */}
      <Skeleton className="h-64 w-full" />

      {/* Bottom 2-col grid */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>

      {/* Transcript section */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-[24rem] w-full xl:h-[28rem]" />
      </div>
    </AppShellContainer>
  )
}

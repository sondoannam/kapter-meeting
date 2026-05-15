import { AppShellContainer } from "@/components/app-shell-container"
import { Skeleton } from "@/components/ui/skeleton"

export function VoiceProfilesSkeleton() {
  return (
    <AppShellContainer className="space-y-5 py-6">
      {/* Header card */}
      <div className="rounded-[1.85rem] border border-border/70 bg-white/82 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>

      {/* Profile cards grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-[1.85rem] border border-border/70 bg-white/82 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6"
          >
            {/* Card header */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-14" />
              </div>
            </div>

            {/* Metric tiles */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        ))}
      </div>
    </AppShellContainer>
  )
}

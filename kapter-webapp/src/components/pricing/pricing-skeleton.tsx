import { Skeleton } from "@/components/ui/skeleton"

export function PricingSkeleton() {
  return (
    <div className="relative overflow-x-clip pb-16">
      {/* Hero section */}
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 pt-12 pb-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.42fr)] lg:items-end">
        <div className="max-w-3xl space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-12 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-3/4 max-w-lg" />
        </div>

        {/* Quota card */}
        <div className="rounded-[1.85rem] border border-border/70 bg-white/82 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="mb-4 flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[1.85rem] border border-border/70 bg-white/82 p-6 dark:border-white/10 dark:bg-white/5"
            >
              {/* Plan header */}
              <div className="mb-4 space-y-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>

              {/* Price */}
              <div className="mb-6 space-y-2">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>

              {/* Features */}
              <div className="mb-6 space-y-3">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex gap-3">
                    <Skeleton className="mt-0.5 h-4 w-4 shrink-0" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>

              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA strip */}
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-5 rounded-2xl border border-border/70 bg-white/72 p-6 dark:bg-white/5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <Skeleton className="size-12 shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </section>
    </div>
  )
}

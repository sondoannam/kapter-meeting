import { AppDemoIcon } from "@/components/ui/app-demo-icon"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

interface AppLoadingScreenProps {
  className?: string
  description?: string
  fullscreen?: boolean
  eyebrow?: string
  title?: string
  steps?: string[]
}

export function AppLoadingScreen({
  className,
  fullscreen = false,
  description,
  eyebrow,
  title,
  steps,
}: AppLoadingScreenProps) {
  const { t } = useTranslation("common")
  const resolvedEyebrow = eyebrow ?? t("loading.eyebrow")
  const resolvedTitle = title ?? t("loading.title")
  const resolvedDescription = description ?? t("loading.description")
  const resolvedSteps =
    steps ??
    (t("loading.steps", { returnObjects: true }) as string[])
  const defaultSignals = [
    {
      label: t("loading.signals.authBridge.label"),
      value: t("loading.signals.authBridge.value"),
    },
    {
      label: t("loading.signals.meetingGraph.label"),
      value: t("loading.signals.meetingGraph.value"),
    },
    {
      label: t("loading.signals.reviewRail.label"),
      value: t("loading.signals.reviewRail.value"),
    },
  ]

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "app-loading-screen relative isolate overflow-hidden",
        fullscreen
          ? "min-h-svh"
          : "min-h-[calc(100svh-8rem)] rounded-[2rem] border border-border/70 bg-background/92 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-[rgba(15,23,42,0.8)]",
        className
      )}
      role="status"
    >
      <div className="app-loading-aurora absolute inset-0" />
      <div className="app-loading-grid absolute inset-0 opacity-70" />
      <div className="app-loading-noise absolute inset-0 opacity-70" />

      <div className="min-h-inherit relative mx-auto flex w-full max-w-[min(86rem,100vw-2rem)] flex-col justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(21rem,30rem)] lg:gap-14">
          <div className="space-y-7">
            <div className="inline-flex min-h-11 items-center gap-3 rounded-full border border-primary/20 bg-background/80 px-4 py-2 text-[0.7rem] font-semibold tracking-[0.28em] text-muted-foreground uppercase shadow-[0_10px_40px_-28px_rgba(249,115,22,0.8)] backdrop-blur dark:bg-background/30">
              <span className="app-loading-ping size-2 rounded-full bg-primary" />
              {resolvedEyebrow}
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <AppDemoIcon />
                <div className="space-y-1">
                  <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
                    {t("loading.controlRoomLabel")}
                  </p>
                  <p className="font-heading text-lg text-foreground">
                    {t("loading.commandSurfaceLabel")}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl font-heading text-4xl leading-none tracking-[-0.04em] text-balance text-foreground sm:text-5xl xl:text-6xl">
                  {resolvedTitle}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {resolvedDescription}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {defaultSignals.map((signal, index) => (
                <div
                  className="app-loading-signal-card rounded-[1.4rem] border border-border/70 px-4 py-4 backdrop-blur dark:border-white/10"
                  key={signal.label}
                  style={{ animationDelay: `${index * 140}ms` }}
                >
                  <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                    {signal.label}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    {signal.value}
                  </p>
                </div>
              ))}
            </div>

            <ul className="grid gap-3">
              {resolvedSteps.map((step, index) => (
                <li
                  className="app-loading-step-card flex items-start gap-4 rounded-[1.35rem] border border-border/70 px-4 py-4 backdrop-blur dark:border-white/10"
                  key={step}
                >
                  <span
                    aria-hidden="true"
                    className="app-loading-step-dot mt-1.5 size-2.5 rounded-full bg-primary"
                    style={{ animationDelay: `${index * 160}ms` }}
                  />
                  <div className="space-y-2">
                    <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                      {t("loading.stageLabel", { index: index + 1 })}
                    </p>
                    <p className="text-sm leading-6 text-foreground/88 sm:text-[0.95rem]">
                      {step}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto flex w-full max-w-[30rem] justify-center">
            <div className="app-loading-orbit-shell relative aspect-square w-full max-w-[28rem] rounded-[2rem] border border-border/70 dark:border-white/10">
              <div className="app-loading-orbit app-loading-orbit-outer absolute inset-4 rounded-full border border-primary/22" />
              <div className="app-loading-orbit app-loading-orbit-middle absolute inset-[18%] rounded-full border border-foreground/12" />
              <div className="app-loading-orbit app-loading-orbit-inner absolute inset-[31%] rounded-full border border-primary/30" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="app-loading-core relative flex size-36 flex-col items-center justify-center rounded-full border border-primary/22 bg-background/88 text-center shadow-[0_24px_90px_-48px_rgba(249,115,22,0.95)] backdrop-blur sm:size-40 dark:bg-background/56">
                  <div className="app-loading-core-glow absolute inset-3 rounded-full" />
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <AppDemoIcon />
                    <div className="space-y-1">
                      <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                        {t("loading.liveSyncLabel")}
                      </p>
                      <p className="font-heading text-lg text-foreground">
                        {t("loading.bringingPanelsOnline")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="app-loading-floating-card app-loading-floating-card-top absolute top-8 left-4 w-44 rounded-[1.25rem] border border-border/70 px-4 py-3 backdrop-blur sm:w-48 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                    {t("loading.transcriptBusLabel")}
                  </p>
                  <span className="app-loading-ping size-2 rounded-full bg-primary" />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 rounded-full bg-foreground/8">
                    <div className="app-loading-progress h-full w-[72%] rounded-full bg-primary/90" />
                  </div>
                  <p className="text-sm text-foreground/86">
                    {t("loading.transcriptBusValue")}
                  </p>
                </div>
              </div>

              <div className="app-loading-floating-card app-loading-floating-card-right absolute right-3 bottom-10 w-48 rounded-[1.25rem] border border-border/70 px-4 py-3 backdrop-blur sm:w-52 dark:border-white/10">
                <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                  {t("loading.reviewEngineLabel")}
                </p>
                <div className="mt-4 grid gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      className="h-9 rounded-2xl bg-foreground/7 p-2"
                      key={index}
                    >
                      <div
                        className="app-loading-progress h-full rounded-xl bg-primary/20"
                        style={{ animationDelay: `${index * 120}ms` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="app-loading-floating-card app-loading-floating-card-left absolute bottom-7 left-2 w-40 rounded-[1.25rem] border border-border/70 px-4 py-3 backdrop-blur sm:w-44 dark:border-white/10">
                <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                  {t("loading.deliveryMeshLabel")}
                </p>
                <div className="mt-4 flex gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <span
                      className="app-loading-bar block h-14 flex-1 rounded-full bg-primary/16"
                      key={index}
                      style={{ animationDelay: `${index * 130}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { SignInButton, useAuth } from "@clerk/react-router"
import { useTranslation } from "react-i18next"
import {
  ArrowRight,
  BadgeCheck,
  // Clock3,
  Link2,
  Mic,
  Play,
  Radar,
  Sparkles,
} from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ROUTES } from "@/routes/routes.constants"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"

interface DesignTargetCopy {
  value: string
  label: string
  detail: string
}

interface ShowcaseTranscriptLine {
  speaker: string
  time: string
  content: string
}

interface ShowcaseConfidenceItem {
  task: string
  owner: string
  confidence: string
}

export function Landing() {
  const { t } = useTranslation(["landing", "common"])
  const { isLoaded, userId } = useAuth()
  const isSignedIn = isLoaded && Boolean(userId)

  const designTargets = t("hero.metrics", {
    ns: "landing",
    returnObjects: true,
  }) as DesignTargetCopy[]

  const transcriptLines = t("showcase.transcript.lines", {
    ns: "landing",
    returnObjects: true,
  }) as ShowcaseTranscriptLine[]

  const confidenceItems = t("showcase.confidence.items", {
    ns: "landing",
    returnObjects: true,
  }) as ShowcaseConfidenceItem[]

  const reviewGateItems = t("showcase.reviewGate.items", {
    ns: "landing",
    returnObjects: true,
  }) as string[]

  // const finalSteps = t("finalCta.steps", {
  //   ns: "landing",
  //   returnObjects: true,
  // }) as string[]

  return (
    <div className="relative h-full min-h-[calc(100svh-80px)] w-full overflow-x-hidden overflow-y-auto pt-6 pb-10">
      <section className="relative z-10 w-full">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 lg:grid-cols-[45fr_55fr] lg:items-center">
          {/* LEFT COLUMN: HERO TEXT & CTAs */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-xs font-semibold tracking-[0.22em] text-primary uppercase shadow-[0_16px_45px_-36px_rgba(194,65,12,0.9)] backdrop-blur dark:bg-slate-900/80">
              <Sparkles className="size-3.5" />
              {t("hero.eyebrow", { ns: "landing" })}
            </div>

            <h1 className="mt-6 font-heading text-5xl leading-[1.1] text-balance text-foreground sm:text-6xl xl:text-[4rem]">
              {t("hero.title", { ns: "landing" })}
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
              {t("hero.description", { ns: "landing" })}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {isSignedIn ? (
                <Button
                  asChild
                  className="shadow-[0_22px_40px_-28px_rgba(194,65,12,0.8)]"
                  size="lg"
                >
                  <Link to={ROUTES.DASHBOARD}>
                    {t("actions.openDashboard", { ns: "common" })}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <SignInButton>
                  <Button
                    className="shadow-[0_22px_40px_-28px_rgba(194,65,12,0.8)]"
                    size="lg"
                  >
                    {t("hero.ctas.primary", { ns: "landing" })}
                    <ArrowRight className="size-4" />
                  </Button>
                </SignInButton>
              )}

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    className="cursor-pointer border-border bg-white/70 text-slate-950 hover:bg-white/82 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    size="lg"
                    variant="outline"
                  >
                    <Play className="mr-2 size-4" />
                    {t("hero.ctas.secondary", { ns: "landing" })}
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-6xl border-none bg-transparent p-0 shadow-2xl sm:max-w-6xl">
                  <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <iframe
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full border-0"
                      src="https://drive.google.com/file/d/15QsJOulZdlO6UcTaYtU5I9nuX75OPIpg/preview"
                      title="Video Demonstration"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-12 flex flex-wrap gap-4 md:gap-8">
              {designTargets?.map((target) => (
                <div
                  key={`${target.value}-${target.label}`}
                  className="flex flex-col gap-1"
                >
                  <p className="font-heading text-3xl text-slate-950 dark:text-slate-50">
                    {target.value}
                  </p>
                  <p className="max-w-[120px] text-sm leading-tight font-medium text-slate-600 dark:text-slate-400">
                    {target.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: BENTO BOX */}
          <div className="relative lg:pt-0">
            <div
              aria-hidden
              className="absolute inset-x-10 top-1/2 h-64 -translate-y-1/2 rounded-full bg-primary/15 blur-[80px]"
            />

            <div className="landing-grid landing-noise relative overflow-hidden rounded-[2.25rem] border border-primary/15 bg-[linear-gradient(180deg,rgba(255,250,244,0.96),rgba(255,255,255,0.9))] p-4 shadow-[0_38px_90px_-58px_rgba(15,23,42,0.48)] sm:p-6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(15,23,42,0.6))]">
              {/* Mobile Carousel Wrapper */}
              <div className="flex snap-x snap-mandatory overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(13rem,0.9fr)] lg:gap-4 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                {/* CARD 1: TRANSCRIPT */}
                <article className="drift-card mr-4 min-w-[280px] shrink-0 snap-center rounded-[1.8rem] border border-slate-950/8 bg-slate-950 px-5 py-5 text-white shadow-[0_26px_70px_-42px_rgba(15,23,42,0.95)] lg:col-span-1 lg:row-span-2 lg:mr-0 dark:border-white/10 dark:bg-slate-950/90">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-white/55 uppercase">
                        {t("showcase.transcript.eyebrow", { ns: "landing" })}
                      </p>
                      <h2 className="mt-2 font-heading text-xl text-white">
                        {t("showcase.transcript.title", { ns: "landing" })}
                      </h2>
                    </div>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-white">
                      <Mic className="size-4" />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {transcriptLines?.map((line, index) => (
                      <div
                        className={cn(
                          "rounded-[1.2rem] border border-white/10 p-3",
                          index === transcriptLines.length - 1
                            ? "bg-[linear-gradient(135deg,rgba(251,146,60,0.16),rgba(255,255,255,0.05))]"
                            : "bg-white/6"
                        )}
                        key={`${line.speaker}-${line.time}`}
                      >
                        <div className="flex items-center justify-between gap-3 text-xs text-white/60">
                          <span>{line.speaker}</span>
                          <span>{line.time}</span>
                        </div>
                        <p className="mt-2 text-sm leading-snug text-white/90">
                          {line.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>

                {/* CARD 2: AI ANALYSIS */}
                <article className="drift-card mr-4 min-w-[280px] shrink-0 snap-center rounded-[1.8rem] border border-border/70 bg-white/86 p-5 backdrop-blur lg:col-span-1 lg:mr-0 dark:border-white/10 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-slate-500 uppercase dark:text-slate-400">
                        {t("showcase.confidence.eyebrow", { ns: "landing" })}
                      </p>
                      <h2 className="mt-2 font-heading text-lg text-slate-950 dark:text-slate-50">
                        {t("showcase.confidence.title", { ns: "landing" })}
                      </h2>
                    </div>
                    <Radar className="size-5 shrink-0 text-primary" />
                  </div>

                  <div className="mt-5 space-y-4">
                    {confidenceItems?.map((item) => (
                      <div className="space-y-2" key={item.task}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-slate-900 dark:text-slate-200">
                            {item.task}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                            {item.owner}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted dark:bg-slate-800">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: item.confidence }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                {/* CARD 3: SYNC TO NOTION */}
                <article className="drift-card min-w-[280px] shrink-0 snap-center rounded-[1.8rem] border border-primary/16 bg-[#fff4ea] p-5 shadow-[0_20px_50px_-40px_rgba(194,65,12,0.7)] lg:col-span-1 dark:border-primary/30 dark:bg-[rgba(251,146,60,0.1)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-primary/80 uppercase">
                        {t("showcase.reviewGate.eyebrow", { ns: "landing" })}
                      </p>
                      <h2 className="mt-2 font-heading text-lg text-slate-950 dark:text-slate-50">
                        {t("showcase.reviewGate.title", { ns: "landing" })}
                      </h2>
                    </div>
                    <BadgeCheck className="size-5 shrink-0 text-primary" />
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    {reviewGateItems?.slice(0, 2).map((item) => (
                      <div className="flex items-start gap-3" key={item}>
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                        <p className="leading-tight">{item}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-primary/10 pt-4">
                    <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-[0.1em] text-primary uppercase">
                      <Link2 className="size-3.5" />
                      Notion Sync
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* <section className="mx-auto w-full max-w-7xl px-6 pt-10 pb-24">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-900/10 bg-slate-950 px-8 py-10 text-white shadow-[0_40px_100px_-54px_rgba(15,23,42,0.75)] sm:px-10 sm:py-12">
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_right,_rgba(251,146,60,0.28),_transparent_44%)]"
          />

          <div className="relative max-w-3xl">
            <SectionEyebrow>
              {t("finalCta.eyebrow", { ns: "landing" })}
            </SectionEyebrow>
            <h2 className="mt-4 font-heading text-4xl leading-tight text-balance text-white sm:text-5xl">
              {t("finalCta.title", { ns: "landing" })}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72">
              {t("finalCta.description", { ns: "landing" })}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {isSignedIn ? (
                <Button
                  asChild
                  className="bg-primary text-primary-foreground hover:bg-primary/85"
                  size="lg"
                >
                  <Link to={ROUTES.DASHBOARD}>
                    {t("finalCta.signedInCta", { ns: "landing" })}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <SignInButton>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/85"
                    size="lg"
                  >
                    {t("actions.signInAndStart", { ns: "common" })}
                    <ArrowRight className="size-4" />
                  </Button>
                </SignInButton>
              )}

              <Button
                asChild
                className="border-white/15 bg-white/6 text-white hover:bg-white/10"
                size="lg"
                variant="outline"
              >
                <a href="#extension-setup">
                  {t("finalCta.secondaryCta", { ns: "landing" })}
                </a>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-4 text-sm text-white/65">
              {finalSteps.map((item) => (
                <div className="flex items-center gap-2" key={item}>
                  <Clock3 className="size-4 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section> */}
    </div>
  )
}

// function SectionEyebrow({ children }: { children: React.ReactNode }) {
//   return (
//     <p className="text-[0.72rem] font-semibold tracking-[0.3em] text-primary/80 uppercase">
//       {children}
//     </p>
//   )
// }

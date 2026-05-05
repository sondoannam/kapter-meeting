import * as React from "react"

import type { LucideIcon } from "lucide-react"
import { SignInButton, useAuth } from "@clerk/react-router"
import { Trans, useTranslation } from "react-i18next"
import {
  ArrowRight,
  BadgeCheck,
  BotMessageSquare,
  Clock3,
  FileText,
  Link2,
  MessageSquareText,
  Mic,
  Radar,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ROUTES } from "@/routes/routes.constants"

interface DesignTargetCopy {
  value: string
  label: string
  detail: string
}

interface WorkflowStepCopy {
  step: string
  title: string
  description: string
}

interface SignalCardCopy {
  title: string
  description: string
}

interface ProductBoundaryCopy {
  label: string
  value: string
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

interface ShowcaseHandoffItem {
  title: string
  description: string
}

const workflowPresentation: Array<{
  icon: LucideIcon
  className: string
}> = [
  {
    icon: Mic,
    className: "lg:col-span-5",
  },
  {
    icon: Radar,
    className: "lg:col-span-7",
  },
  {
    icon: BotMessageSquare,
    className: "lg:col-span-7",
  },
  {
    icon: Workflow,
    className: "lg:col-span-5",
  },
]

const signalCardIcons = [Users, MessageSquareText, BadgeCheck] as const

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.72rem] font-semibold tracking-[0.3em] text-primary/80 uppercase">
      {children}
    </p>
  )
}

function WorkflowCard({
  className,
  description,
  eyebrow,
  icon: Icon,
  title,
}: {
  className?: string
  description: string
  eyebrow: string
  icon: LucideIcon
  title: string
}) {
  return (
    <article
      className={cn(
        "rounded-[2rem] border border-border/70 bg-white/82 p-6 shadow-[0_20px_70px_-48px_rgba(15,23,42,0.35)] backdrop-blur",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-[0.72rem] font-semibold tracking-[0.28em] text-slate-500 uppercase">
          {eyebrow}
        </span>
        <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>

      <h3 className="mt-8 max-w-sm font-heading text-2xl leading-tight text-slate-950">
        {title}
      </h3>
      <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">
        {description}
      </p>
    </article>
  )
}

export function Landing() {
  const { t } = useTranslation(["landing", "common"])
  const { isLoaded, userId } = useAuth()
  const isSignedIn = isLoaded && Boolean(userId)

  const extensionTestBuildUrl =
    import.meta.env.VITE_EXTENSION_TEST_BUILD_URL?.trim() || ""
  const hasExtensionTestBuildUrl = extensionTestBuildUrl.length > 0

  const operatingSignals = t("hero.signals", {
    ns: "landing",
    returnObjects: true,
  }) as string[]
  const designTargets = t("hero.metrics", {
    ns: "landing",
    returnObjects: true,
  }) as DesignTargetCopy[]
  const workflowSteps = (
    t("workflow.steps", {
      ns: "landing",
      returnObjects: true,
    }) as WorkflowStepCopy[]
  ).map((step, index) => ({
    ...step,
    className: workflowPresentation[index]?.className,
    icon: workflowPresentation[index]?.icon ?? Mic,
  }))
  const signalCards = (
    t("signalsSection.cards", {
      ns: "landing",
      returnObjects: true,
    }) as SignalCardCopy[]
  ).map((card, index) => ({
    ...card,
    icon: signalCardIcons[index] ?? Users,
  }))
  const productBoundaries = t("fitSection.boundaries", {
    ns: "landing",
    returnObjects: true,
  }) as ProductBoundaryCopy[]
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
  const handoffItems = t("showcase.handoff.items", {
    ns: "landing",
    returnObjects: true,
  }) as ShowcaseHandoffItem[]
  const fitChips = t("fitSection.chips", {
    ns: "landing",
    returnObjects: true,
  }) as string[]
  const extensionInstallSteps = t(
    hasExtensionTestBuildUrl
      ? "extensionSetup.stepsWithDownload"
      : "extensionSetup.stepsWithoutDownload",
    {
      ns: "landing",
      returnObjects: true,
    }
  ) as string[]
  const finalSteps = t("finalCta.steps", {
    ns: "landing",
    returnObjects: true,
  }) as string[]

  return (
    <div className="relative overflow-x-clip pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(15,23,42,0.08),_transparent_32%)]"
      />

      <section className="relative">
        <div className="mx-auto grid w-full max-w-7xl gap-16 px-6 pt-10 pb-18 lg:grid-cols-[minmax(0,1.02fr)_minmax(24rem,0.98fr)] lg:pt-18">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-xs font-semibold tracking-[0.22em] text-primary uppercase shadow-[0_16px_45px_-36px_rgba(194,65,12,0.9)] backdrop-blur">
              <Sparkles className="size-3.5" />
              {t("hero.eyebrow", { ns: "landing" })}
            </div>

            <h1 className="mt-6 max-w-3xl font-heading text-5xl leading-[0.94] text-balance text-foreground sm:text-6xl lg:text-7xl">
              {t("hero.title", { ns: "landing" })}
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
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
                    {t("actions.signInWithClerk", { ns: "common" })}
                    <ArrowRight className="size-4" />
                  </Button>
                </SignInButton>
              )}

              <Button
                asChild
                className="border-white/12 bg-white/70 text-slate-950 hover:bg-white/82 dark:bg-slate-800 dark:text-white"
                size="lg"
                variant="outline"
              >
                <a href="#workflow">
                  {t("actions.viewWorkflow", { ns: "common" })}
                </a>
              </Button>

              <Button
                asChild
                className="border-white/12 bg-white/70 text-slate-950 hover:bg-white/82 dark:bg-slate-800 dark:text-white"
                size="lg"
                variant="outline"
              >
                <a href="#extension-setup">
                  {t("hero.ctas.extensionTesting", { ns: "landing" })}
                </a>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {operatingSignals.map((signal) => (
                <span
                  className="rounded-full border border-slate-900/8 bg-white/72 px-4 py-2 text-sm text-slate-900 shadow-[0_16px_45px_-38px_rgba(15,23,42,0.35)] backdrop-blur"
                  key={signal}
                >
                  {signal}
                </span>
              ))}
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {designTargets.map((target) => (
                <article
                  className="rounded-[1.75rem] border border-border/70 bg-white/76 p-5 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.35)] backdrop-blur"
                  key={`${target.value}-${target.label}`}
                >
                  <p className="text-[0.68rem] font-semibold tracking-[0.26em] text-slate-500 uppercase">
                    {t("hero.metricsLabel", { ns: "landing" })}
                  </p>
                  <p className="mt-5 font-heading text-4xl text-slate-950">
                    {target.value}
                  </p>
                  <p className="mt-3 text-sm font-medium text-slate-900">
                    {target.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {target.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative lg:pt-8">
            <div
              aria-hidden
              className="absolute inset-x-10 top-12 h-48 rounded-full bg-primary/18 blur-3xl"
            />

            <div className="landing-grid landing-noise relative overflow-hidden rounded-[2.25rem] border border-primary/15 bg-[linear-gradient(180deg,rgba(255,250,244,0.96),rgba(255,255,255,0.9))] p-4 shadow-[0_38px_90px_-58px_rgba(15,23,42,0.48)] sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(15rem,0.82fr)]">
                <article className="drift-card rounded-[1.8rem] border border-slate-950/8 bg-slate-950 px-5 py-5 text-white shadow-[0_26px_70px_-42px_rgba(15,23,42,0.95)] lg:row-span-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-white/55 uppercase">
                        {t("showcase.transcript.eyebrow", { ns: "landing" })}
                      </p>
                      <h2 className="mt-3 font-heading text-2xl text-white">
                        {t("showcase.transcript.title", { ns: "landing" })}
                      </h2>
                    </div>
                    <div className="flex size-11 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-white">
                      <Mic className="size-5" />
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {transcriptLines.map((line, index) => (
                      <div
                        className={cn(
                          "rounded-[1.4rem] border border-white/10 p-4",
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
                        <p className="mt-3 text-sm leading-6 text-white/90">
                          {line.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="drift-card rounded-[1.8rem] border border-border/70 bg-white/86 p-5 backdrop-blur">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-slate-500 uppercase">
                        {t("showcase.confidence.eyebrow", { ns: "landing" })}
                      </p>
                      <h2 className="mt-3 font-heading text-xl text-slate-950">
                        {t("showcase.confidence.title", { ns: "landing" })}
                      </h2>
                    </div>
                    <Radar className="size-5 text-primary" />
                  </div>

                  <div className="mt-6 space-y-4">
                    {confidenceItems.map((item) => (
                      <div className="space-y-2" key={item.task}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-900">
                            {item.task}
                          </span>
                          <span className="text-slate-500">{item.owner}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: item.confidence }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="drift-card rounded-[1.8rem] border border-primary/16 bg-[#fff4ea] p-5 shadow-[0_20px_50px_-40px_rgba(194,65,12,0.7)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-primary/75 uppercase">
                        {t("showcase.reviewGate.eyebrow", { ns: "landing" })}
                      </p>
                      <h2 className="mt-3 font-heading text-xl text-slate-950">
                        {t("showcase.reviewGate.title", { ns: "landing" })}
                      </h2>
                    </div>
                    <BadgeCheck className="size-5 text-primary" />
                  </div>

                  <div className="mt-5 space-y-3 text-sm text-slate-600">
                    {reviewGateItems.map((item) => (
                      <div className="flex gap-3" key={item}>
                        <span className="mt-1 size-2.5 shrink-0 rounded-full bg-primary" />
                        <p className="leading-6">{item}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="drift-card rounded-[1.8rem] border border-border/70 bg-white/90 p-5 lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-slate-500 uppercase">
                        {t("showcase.handoff.eyebrow", { ns: "landing" })}
                      </p>
                      <h2 className="mt-3 font-heading text-2xl text-slate-950">
                        {t("showcase.handoff.title", { ns: "landing" })}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                      <Link2 className="size-3.5" />
                      {t("showcase.handoff.badge", { ns: "landing" })}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {handoffItems.map((item) => (
                      <div
                        className="rounded-[1.4rem] border border-border/70 bg-background/80 p-4"
                        key={item.title}
                      >
                        <p className="font-medium text-slate-900 dark:text-slate-50">
                          {item.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-8" id="workflow">
        <div className="max-w-2xl">
          <SectionEyebrow>
            {t("workflow.eyebrow", { ns: "landing" })}
          </SectionEyebrow>
          <h2 className="mt-4 font-heading text-4xl leading-tight text-balance text-foreground sm:text-5xl">
            {t("workflow.title", { ns: "landing" })}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            {t("workflow.description", { ns: "landing" })}
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          {workflowSteps.map((step) => (
            <WorkflowCard
              className={step.className}
              description={step.description}
              eyebrow={t("workflow.stepLabel", {
                ns: "landing",
                step: step.step,
              })}
              icon={step.icon}
              key={step.step}
              title={step.title}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-10" id="signals">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="max-w-xl">
            <SectionEyebrow>
              {t("signalsSection.eyebrow", { ns: "landing" })}
            </SectionEyebrow>
            <h2 className="mt-4 font-heading text-4xl leading-tight text-balance text-slate-950 sm:text-5xl dark:text-slate-50">
              {t("signalsSection.title", { ns: "landing" })}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {t("signalsSection.description", { ns: "landing" })}
            </p>

            <div className="mt-8 rounded-[2rem] border border-border/70 bg-white/78 p-6 shadow-[0_20px_70px_-50px_rgba(15,23,42,0.35)]">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {t("signalsSection.callout.title", { ns: "landing" })}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t("signalsSection.callout.description", {
                      ns: "landing",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {signalCards.map(({ description, icon: Icon, title }) => (
              <article
                className="rounded-[2rem] border border-border/70 bg-white/80 p-6 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.33)] backdrop-blur"
                key={title}
              >
                <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-6 font-heading text-2xl leading-tight text-slate-950">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-10" id="fit">
        <div className="grid gap-8 rounded-[2.5rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,247,240,0.92))] p-8 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.38)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:p-10">
          <div className="max-w-xl">
            <SectionEyebrow>
              {t("fitSection.eyebrow", { ns: "landing" })}
            </SectionEyebrow>
            <h2 className="mt-4 font-heading text-4xl leading-tight text-balance text-slate-950 sm:text-5xl">
              {t("fitSection.title", { ns: "landing" })}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {t("fitSection.description", { ns: "landing" })}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {fitChips.map((chip) => (
                <span
                  className="rounded-full border border-primary/18 bg-primary/8 px-4 py-2 text-sm text-slate-900"
                  key={chip}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {productBoundaries.map((item) => (
              <article
                className="rounded-[1.9rem] border border-border/70 bg-white/80 p-5 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.3)]"
                key={item.label}
              >
                <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-slate-500 uppercase">
                  {item.label}
                </p>
                <h3 className="mt-4 font-heading text-2xl text-slate-950">
                  {item.value}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-7xl px-6 py-10"
        id="extension-setup"
      >
        <div className="grid gap-8 rounded-[2.5rem] border border-border/70 bg-white/80 p-8 shadow-[0_30px_90px_-62px_rgba(15,23,42,0.35)] backdrop-blur lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:p-10 dark:border-white/10 dark:bg-[rgba(15,23,42,0.72)]">
          <div className="max-w-xl">
            <SectionEyebrow>
              {t("extensionSetup.eyebrow", { ns: "landing" })}
            </SectionEyebrow>
            <h2 className="mt-4 font-heading text-4xl leading-tight text-balance text-slate-950 sm:text-5xl dark:text-slate-50">
              {t("extensionSetup.title", { ns: "landing" })}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              {t("extensionSetup.description", { ns: "landing" })}
            </p>

            <div className="mt-7 space-y-4">
              {hasExtensionTestBuildUrl ? (
                <Button asChild className="w-full sm:w-auto" size="lg">
                  <a
                    href={extensionTestBuildUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t("extensionSetup.downloadCta", { ns: "landing" })}
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-primary/35 bg-primary/8 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-primary/45 dark:bg-primary/12 dark:text-slate-200">
                  <Trans
                    components={{
                      code: (
                        <code className="mx-1 rounded bg-black/8 px-1.5 py-0.5 text-xs dark:bg-white/15" />
                      ),
                    }}
                    i18nKey="extensionSetup.missingDownload"
                    ns="landing"
                  />
                </div>
              )}

              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t("extensionSetup.afterDownload", { ns: "landing" })}
              </p>
            </div>
          </div>

          <div className="space-y-5 rounded-[2rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,247,240,0.9),rgba(255,255,255,0.92))] p-6 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.68),rgba(15,23,42,0.48))]">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
              {t("extensionSetup.stepsHeading", { ns: "landing" })}
            </p>
            <ol className="space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {extensionInstallSteps.map((step, index) => (
                <li
                  className="flex gap-3 rounded-2xl border border-border/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                  key={step}
                >
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 dark:border-white/10 dark:bg-slate-950/70">
              <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
                {t("extensionSetup.localBuildHeading", { ns: "landing" })}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-border/70 bg-slate-950 px-3 py-2 text-xs leading-6 text-slate-100 dark:border-white/10">
                <code>{`cd kapter-extension\npnpm dev`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pt-10 pb-24">
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
      </section>
    </div>
  )
}

import { SignInButton, useAuth } from "@clerk/react-router"
import { ArrowRight, Check, Gauge, RefreshCw, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PricingSkeleton } from "@/components/pricing/pricing-skeleton"
import { useBillingStatus } from "@/features/billing/hooks/use-billing-status"
import { ROUTES } from "@/routes/routes.constants"
import { cn } from "@/lib/utils"

function getDisplayLocale(language: string | undefined) {
  return language?.toLowerCase().startsWith("en") ? "en-US" : "vi-VN"
}

function formatNumber(value: number, locale: string) {
  return value.toLocaleString(locale)
}

function formatMinutes(seconds: number, locale: string) {
  return formatNumber(Math.max(0, Math.floor(seconds / 60)), locale)
}

function formatQuota(
  usedSeconds: number,
  quotaMinutes: number,
  locale: string,
  minutesUnit: string
) {
  return `${formatMinutes(usedSeconds, locale)} / ${formatNumber(
    quotaMinutes,
    locale
  )} ${minutesUnit}`
}

function localizeBillingErrorMessage(
  errorMessage: string | null,
  translate: (key: string) => string
) {
  switch (errorMessage) {
    case "Unable to mint a Clerk session token for billing.":
      return translate("errors.sessionToken")
    case "Unable to load subscription plans.":
      return translate("errors.loadPlans")
    case "Unable to load the subscription status.":
      return translate("errors.loadStatus")
    case "Unable to load billing.":
      return translate("errors.loadBilling")
    case "Network Error":
      return translate("errors.network")
    default:
      return errorMessage
  }
}

export function PricingPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { i18n, t } = useTranslation(["pricing", "common"])
  const { errorMessage, plans, quota, refresh, status } = useBillingStatus()
  const displayLocale = getDisplayLocale(i18n.resolvedLanguage ?? i18n.language)
  const billingErrorMessage = localizeBillingErrorMessage(errorMessage, (key) =>
    t(key, { ns: "pricing" })
  )
  const activeTier = quota?.tier ?? "FREE"
  const usagePercent = quota
    ? Math.min(
        100,
        Math.round(
          (quota.usedSeconds / Math.max(1, quota.monthlyQuotaMinutes * 60)) *
            100
        )
      )
    : 0

  if (status === "loading" && plans.length === 0) {
    return <PricingSkeleton />
  }

  return (
    <div className="relative overflow-x-clip pb-16">
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 pt-12 pb-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.42fr)] lg:items-end">
        <div className="max-w-3xl">
          <Badge className="border-primary/25 bg-primary/10 text-primary">
            {t("hero.badge", { ns: "pricing" })}
          </Badge>
          <h1 className="mt-5 font-heading text-4xl leading-tight text-foreground sm:text-5xl">
            {t("hero.title", { ns: "pricing" })}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("hero.description", { ns: "pricing" })}
          </p>
        </div>

        <Card className="border-primary/20 bg-white/82 shadow-[0_26px_80px_-58px_rgba(15,23,42,0.5)] dark:bg-white/6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="size-5 text-primary" />
              {t("quota.title", { ns: "pricing" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quota ? (
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("quota.usedLabel", { ns: "pricing" })}
                    </p>
                    <p className="mt-1 font-heading text-3xl">
                      {formatQuota(
                        quota.usedSeconds,
                        quota.monthlyQuotaMinutes,
                        displayLocale,
                        t("quota.minutesUnit", { ns: "pricing" })
                      )}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      quota.canRecord
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-500/12 text-red-700 dark:text-red-300"
                    )}
                  >
                    {quota.canRecord
                      ? t("quota.canRecord", { ns: "pricing" })
                      : t("quota.exhausted", { ns: "pricing" })}
                  </Badge>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("quota.remainingHint", {
                    date: new Date(quota.periodEnd).toLocaleDateString(
                      displayLocale
                    ),
                    minutes: formatMinutes(
                      quota.remainingSeconds,
                      displayLocale
                    ),
                    ns: "pricing",
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {t("quota.signedOut", { ns: "pricing" })}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-6">
        {status === "error" ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <span>{billingErrorMessage}</span>
            <Button onClick={refresh} size="sm" variant="outline">
              <RefreshCw className="size-4" />
              {t("actions.retry", { ns: "common" })}
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isActive = isSignedIn && plan.tier === activeTier
            const translatedFeatures = t(`plans.${plan.tier}.features`, {
              defaultValue: plan.features,
              ns: "pricing",
              returnObjects: true,
            }) as unknown
            const planFeatures = Array.isArray(translatedFeatures)
              ? (translatedFeatures as string[])
              : plan.features

            return (
              <Card
                className={cn(
                  "relative overflow-hidden border-border/70 bg-white/82 shadow-[0_24px_72px_-58px_rgba(15,23,42,0.42)] dark:bg-white/6",
                  plan.featured && "border-primary/40",
                  isActive && "ring-2 ring-primary/35"
                )}
                key={plan.tier}
              >
                {plan.featured ? (
                  <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
                ) : null}
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="font-heading text-2xl">
                      {t(`plans.${plan.tier}.name`, {
                        defaultValue: plan.name,
                        ns: "pricing",
                      })}
                    </CardTitle>
                    {isActive ? (
                      <Badge className="bg-primary/10 text-primary">
                        {t("planCard.currentPlan", { ns: "pricing" })}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t(`plans.${plan.tier}.description`, {
                      defaultValue: plan.description,
                      ns: "pricing",
                    })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="font-heading text-4xl">
                      ${plan.priceMonthlyUsd}
                      <span className="ml-1 text-sm font-medium text-muted-foreground">
                        {t("planCard.priceSuffix", { ns: "pricing" })}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("planCard.quotaLine", {
                        minutes: formatNumber(
                          plan.monthlyQuotaMinutes,
                          displayLocale
                        ),
                        ns: "pricing",
                      })}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {planFeatures.map((feature) => (
                      <div className="flex gap-3 text-sm" key={feature}>
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {isSignedIn ? (
                    <Button
                      className="w-full"
                      disabled={isActive || plan.tier !== "FREE"}
                      variant={plan.featured ? "default" : "outline"}
                    >
                      {isActive
                        ? t("planCard.activeButton", { ns: "pricing" })
                        : plan.tier === "FREE"
                          ? t("planCard.freeButton", { ns: "pricing" })
                          : t("planCard.billingButton", { ns: "pricing" })}
                    </Button>
                  ) : isLoaded ? (
                    <SignInButton>
                      <Button className="w-full">
                        {t("planCard.signInButton", { ns: "pricing" })}
                        <ArrowRight className="size-4" />
                      </Button>
                    </SignInButton>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-5 rounded-2xl border border-border/70 bg-white/72 p-6 dark:bg-white/5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h2 className="font-heading text-xl">
              {t("quotaProtection.title", { ns: "pricing" })}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("quotaProtection.description", { ns: "pricing" })}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to={ROUTES.DASHBOARD}>
              {t("quotaProtection.dashboardLink", { ns: "pricing" })}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

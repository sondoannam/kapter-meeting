import { SignInButton, useAuth } from "@clerk/react-router"
import { ArrowRight, Check, Gauge, RefreshCw, ShieldCheck } from "lucide-react"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBillingStatus } from "@/features/billing/hooks/use-billing-status"
import { ROUTES } from "@/routes/routes.constants"
import { cn } from "@/lib/utils"

function formatMinutes(seconds: number) {
  return Math.max(0, Math.floor(seconds / 60)).toLocaleString("vi-VN")
}

function formatQuota(usedSeconds: number, quotaMinutes: number) {
  return `${formatMinutes(usedSeconds)} / ${quotaMinutes.toLocaleString(
    "vi-VN"
  )} phút`
}

export function PricingPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { errorMessage, plans, quota, refresh, status } = useBillingStatus()
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

  return (
    <div className="relative overflow-x-clip pb-16">
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 pt-12 pb-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.42fr)] lg:items-end">
        <div className="max-w-3xl">
          <Badge className="border-primary/25 bg-primary/10 text-primary">
            Subscription
          </Badge>
          <h1 className="mt-5 font-heading text-4xl leading-tight text-foreground sm:text-5xl">
            Chọn gói ghi âm phù hợp cho nhịp họp của đội.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Kapter tính quota theo số phút ghi âm đã hoàn tất trong tháng. Khi
            hết quota, Extension sẽ chặn phiên ghi mới trước khi mở recorder.
          </p>
        </div>

        <Card className="border-primary/20 bg-white/82 shadow-[0_26px_80px_-58px_rgba(15,23,42,0.5)] dark:bg-white/6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="size-5 text-primary" />
              Quota tháng này
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quota ? (
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Đã dùng</p>
                    <p className="mt-1 font-heading text-3xl">
                      {formatQuota(
                        quota.usedSeconds,
                        quota.monthlyQuotaMinutes
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
                    {quota.canRecord ? "Còn quota" : "Hết quota"}
                  </Badge>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Còn {formatMinutes(quota.remainingSeconds)} phút trước ngày{" "}
                  {new Date(quota.periodEnd).toLocaleDateString("vi-VN")}.
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Đăng nhập để xem quota còn lại và trạng thái gói hiện tại.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-6">
        {status === "error" ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <span>{errorMessage}</span>
            <Button onClick={refresh} size="sm" variant="outline">
              <RefreshCw className="size-4" />
              Thử lại
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isActive = isSignedIn && plan.tier === activeTier

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
                      {plan.name}
                    </CardTitle>
                    {isActive ? (
                      <Badge className="bg-primary/10 text-primary">
                        Gói hiện tại
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {plan.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="font-heading text-4xl">
                      ${plan.priceMonthlyUsd}
                      <span className="ml-1 text-sm font-medium text-muted-foreground">
                        / tháng
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.monthlyQuotaMinutes.toLocaleString("vi-VN")} phút
                      ghi âm mỗi tháng
                    </p>
                  </div>

                  <div className="space-y-3">
                    {plan.features.map((feature) => (
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
                        ? "Đang sử dụng"
                        : plan.tier === "FREE"
                          ? "Gói mặc định"
                          : "Checkout sẽ nối ở bước billing"}
                    </Button>
                  ) : isLoaded ? (
                    <SignInButton>
                      <Button className="w-full">
                        Đăng nhập để bắt đầu
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
            <h2 className="font-heading text-xl">Guard đã nằm ở Backend</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Extension sẽ kiểm tra quota trước khi bắt đầu, nhưng Backend vẫn
              là lớp chặn cuối cùng tại sự kiện stream:start.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to={ROUTES.DASHBOARD}>Về Dashboard</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

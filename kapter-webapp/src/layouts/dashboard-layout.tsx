import { useAuth } from "@clerk/react-router"
import { Navigate, Outlet } from "react-router"

import { ROUTES } from "@/routes/routes.constants"
import { AppLoadingScreen } from "@/components/app-loading-screen"
import { AppShellContainer } from "@/components/app-shell-container"
import { DashboardTopNav } from "@/components/dashboard/dashboard-topnav"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { useTranslation } from "react-i18next"

export default function DashboardLayout() {
  const { userId, isLoaded } = useAuth()
  const { t } = useTranslation("dashboard")

  if (!isLoaded) {
    return (
      <AppLoadingScreen
        description={t("layoutLoading.description")}
        fullscreen
        title={t("layoutLoading.title")}
      />
    )
  }

  if (!userId) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return (
    <div className="relative min-h-svh overflow-x-clip bg-background text-tx dark:text-dk-tx">
      {/* <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.16),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(15,23,42,0.08),_transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.16),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.06),_transparent_28%)]"
      /> */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(194,65,12,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(194,65,12,0.07)_1px,transparent_1px)] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.9),transparent_82%)] [background-size:3rem_3rem] opacity-60 dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]"
      />

      <DashboardTopNav />
      <div className="flex min-h-[calc(100svh-5.25rem)]">
        <DashboardSidebar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <AppShellContainer className="relative py-6 lg:py-8">
            <Outlet />
          </AppShellContainer>
        </main>
      </div>
    </div>
  )
}

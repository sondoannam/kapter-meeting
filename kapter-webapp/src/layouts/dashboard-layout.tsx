import * as React from "react"
import { useAuth } from "@clerk/react-router"
import { Navigate, Outlet, useLocation } from "react-router"
import { useTranslation } from "react-i18next"

import { ROUTES } from "@/routes/routes.constants"
import { AppLoadingScreen } from "@/components/app-loading-screen"
import { DashboardTopNav } from "@/components/dashboard/dashboard-topnav"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { DashboardMeetingHistoryProvider } from "@/features/meetings/context/dashboard-meeting-history-context"

export default function DashboardLayout() {
  const { userId, isLoaded } = useAuth()
  const { t } = useTranslation("dashboard")
  const { pathname } = useLocation()

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
    <DashboardMeetingHistoryProvider key={pathname}>
      <SidebarProvider
        defaultOpen
        style={
          {
            "--header-height": "4.5rem",
            "--sidebar-width": "17.5rem",
            "--sidebar-width-icon": "4.25rem",
          } as React.CSSProperties
        }
      >
        <DashboardSidebar />
        <SidebarInset className="min-h-svh bg-background text-tx dark:text-dk-tx">
          <div className="relative flex min-h-svh flex-col overflow-x-clip">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(194,65,12,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(194,65,12,0.07)_1px,transparent_1px)] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.9),transparent_82%)] [background-size:3rem_3rem] opacity-60 dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]"
            />

            <DashboardTopNav />
            <main className="relative min-h-0 flex-1">
              <Outlet />
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DashboardMeetingHistoryProvider>
  )
}

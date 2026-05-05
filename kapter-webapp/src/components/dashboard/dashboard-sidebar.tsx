import { useClerk } from "@clerk/react-router"
import { useTranslation } from "react-i18next"
import {
  Check,
  ExternalLink,
  LayoutGrid,
  LogOut,
  RefreshCw,
} from "lucide-react"
import { Link, NavLink, useLocation, useSearchParams } from "react-router"

import { useStats } from "@/features/dashboard/hooks/use-stats"
import { ROUTES } from "@/routes/routes.constants"
import { cn } from "@/lib/utils"

export function DashboardSidebar() {
  const { t } = useTranslation("dashboardShell")
  const { signOut } = useClerk()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const stats = useStats()
  const activeSidebarStatus = searchParams.get("sidebar_status")
  const isOverviewActive =
    pathname === ROUTES.DASHBOARD && activeSidebarStatus === null

  const statuses = [
    {
      id: "processing",
      label: t("sidebar.statuses.processing"),
      icon: RefreshCw,
      count: stats.statuses.processingCount,
    },
    {
      id: "review",
      label: t("sidebar.statuses.review"),
      icon: LayoutGrid,
      count: stats.statuses.reviewCount,
    },
    {
      id: "approved",
      label: t("sidebar.statuses.approved"),
      icon: Check,
      count: stats.statuses.approvedCount,
    },
  ]

  return (
    <aside className="sticky top-[5.25rem] hidden h-[calc(100svh-5.25rem)] shrink-0 flex-col overflow-hidden border-r border-border bg-bg sm:flex sm:w-14 lg:w-[200px] dark:border-dk-border dark:bg-dk-bg">
      <div className="flex min-h-0 flex-1 flex-col gap-6 px-2 py-4">
        <div className="shrink-0 space-y-1">
          <h3 className="hidden px-2 text-[10px] font-bold tracking-[0.06em] text-tx3 uppercase lg:block dark:text-dk-tx3">
            {t("sidebar.navigationHeading")}
          </h3>
          <NavLink
            className={cn(
              "dashboard-sidebar-item flex w-full items-center justify-center gap-2 whitespace-nowrap px-2 py-1.5 text-sm lg:justify-start",
              isOverviewActive && "active",
            )}
            to={ROUTES.DASHBOARD}
          >
            <LayoutGrid className="size-4 shrink-0" />
            <span className="hidden lg:inline">{t("sidebar.overview")}</span>
          </NavLink>
        </div>

        <div className="flex-1 space-y-1">
          <h3 className="hidden px-2 text-[10px] font-bold tracking-[0.06em] text-tx3 uppercase lg:block dark:text-dk-tx3">
            {t("sidebar.statusHeading")}
          </h3>
          {statuses.map((item) => (
            <NavLink
              key={item.id}
              className={cn(
                "dashboard-sidebar-item group flex w-full items-center justify-center whitespace-nowrap px-2 py-1.5 text-sm lg:justify-between",
                pathname === ROUTES.DASHBOARD &&
                  activeSidebarStatus === item.id &&
                  "active",
              )}
              title={item.label}
              to={`${ROUTES.DASHBOARD}?sidebar_status=${item.id}`}
            >
              <div className="flex items-center gap-2">
                <item.icon className="size-4 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </div>
              <span className="dashboard-sidebar-badge hidden rounded-full px-1.5 py-0.5 text-[10px] font-medium lg:inline-block">
                {item.count}
              </span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-2 dark:border-dk-border">
        <h3 className="hidden px-2 py-1 text-[10px] font-bold tracking-[0.06em] text-tx3 uppercase lg:block dark:text-dk-tx3">
          {t("sidebar.accountHeading")}
        </h3>
        <Link
          className="dashboard-sidebar-item flex w-full items-center justify-center gap-2 whitespace-nowrap px-2 py-1.5 text-sm lg:justify-start"
          title={t("sidebar.installExtensionTitle")}
          to={`${ROUTES.HOME}#extension-setup`}
        >
          <ExternalLink className="size-4 shrink-0" />
          <span className="hidden lg:inline">
            {t("sidebar.installExtension")}
          </span>
        </Link>
        <button
          onClick={() => signOut()}
          className="dashboard-sidebar-item flex w-full items-center justify-center gap-2 whitespace-nowrap px-2 py-1.5 text-sm lg:justify-start"
          title={t("sidebar.signOut")}
          type="button"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="hidden lg:inline">{t("sidebar.signOut")}</span>
        </button>
      </div>
    </aside>
  )
}

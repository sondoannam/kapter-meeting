import * as React from "react"
import { useClerk } from "@clerk/react-router"
import {
  Check,
  CreditCard,
  ExternalLink,
  Home,
  LayoutGrid,
  LogOut,
  RefreshCw,
} from "lucide-react"
import { Link, useLocation, useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"

import { useDashboardMeetingHistory } from "@/features/meetings/context/dashboard-meeting-history"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { ROUTES } from "@/routes/routes.constants"
import { cn } from "@/lib/utils"

type DashboardSidebarStatusId = "processing" | "review" | "approved"

export function DashboardSidebar() {
  const { t } = useTranslation(["dashboardShell", "common"])
  const { signOut } = useClerk()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { meetings } = useDashboardMeetingHistory()
  const activeSidebarStatus = searchParams.get("sidebar_status")
  const { open } = useSidebar()

  const statusCounts = React.useMemo(
    () =>
      meetings.reduce(
        (counts, meeting) => {
          if (
            meeting.status === "RECORDING" ||
            meeting.status === "PROCESSING"
          ) {
            counts.processing += 1
            return counts
          }

          if (meeting.artifactReviewStatus === "READY") {
            counts.review += 1
          }

          if (meeting.artifactReviewStatus === "APPROVED") {
            counts.approved += 1
          }

          return counts
        },
        {
          processing: 0,
          review: 0,
          approved: 0,
        }
      ),
    [meetings]
  )
  const isDashboardDetail =
    pathname.startsWith(`${ROUTES.DASHBOARD}/`) &&
    pathname !== ROUTES.DASHBOARD_PRICING
  const isOverviewActive =
    (pathname === ROUTES.DASHBOARD && activeSidebarStatus === null) ||
    isDashboardDetail

  const statusItems: Array<{
    id: DashboardSidebarStatusId
    label: string
    icon: typeof RefreshCw
    count: number
  }> = [
    {
      id: "processing",
      label: t("sidebar.statuses.processing"),
      icon: RefreshCw,
      count: statusCounts.processing,
    },
    {
      id: "review",
      label: t("sidebar.statuses.review"),
      icon: LayoutGrid,
      count: statusCounts.review,
    },
    {
      id: "approved",
      label: t("sidebar.statuses.approved"),
      icon: Check,
      count: statusCounts.approved,
    },
  ]
  const secondaryItems = [
    {
      id: "landing",
      label: t("sidebar.landing"),
      icon: Home,
      to: ROUTES.HOME,
      isActive: pathname === ROUTES.HOME,
    },
    {
      id: "pricing",
      label: t("sidebar.pricing"),
      icon: CreditCard,
      to: ROUTES.DASHBOARD_PRICING,
      isActive: pathname === ROUTES.DASHBOARD_PRICING,
    },
    {
      id: "install-extension",
      label: t("sidebar.installExtension"),
      icon: ExternalLink,
      to: `${ROUTES.HOME}#extension-setup`,
      isActive: false,
    },
  ]

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="h-[calc(100svh-var(--header-height))] border-r-0"
    >
      <SidebarHeader className="border-b border-sidebar-border/70 pb-4">
        <SidebarMenu>
          <SidebarMenuItem className={cn(!open && "flex justify-center")}>
            <SidebarMenuButton
              asChild
              className={cn(
                "h-auto rounded-xl py-3",
                !open && "size-9 rounded-full"
              )}
              isActive={pathname.startsWith(ROUTES.DASHBOARD)}
              size="lg"
              tooltip={t("appName", { ns: "common" })}
            >
              <Link to={ROUTES.DASHBOARD}>
                <div
                  className={cn(
                    "flex size-9 items-center justify-center overflow-hidden rounded-2xl border border-sidebar-primary/20 bg-sidebar-primary/10",
                    !open && "rounded-full"
                  )}
                >
                  <img
                    alt=""
                    className="h-full w-auto"
                    src="/kapter-mark.svg"
                  />
                </div>
                <div
                  className={cn(
                    "grid min-w-0 flex-1 text-left text-sm leading-tight",
                    !open && "hidden"
                  )}
                >
                  <span className="truncate font-heading text-base">
                    {t("appName", { ns: "common" })}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {t("brandTagline")}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-primary/8 px-3 py-3 text-sm group-data-[collapsible=icon]:hidden">
          <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-sidebar-primary uppercase">
            {t("reviewBadge")}
          </p>
          <p className="mt-2 text-sm leading-6 text-sidebar-foreground/78">
            {t("workspaceSummary")}
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.workspaceHeading")}</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem className={cn(!open && "flex justify-center")}>
              <SidebarMenuButton
                asChild
                isActive={isOverviewActive}
                tooltip={t("sidebar.overview")}
              >
                <Link to={ROUTES.DASHBOARD}>
                  <LayoutGrid />
                  <span>{t("sidebar.overview")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.reviewHeading")}</SidebarGroupLabel>
          <SidebarMenu>
            {statusItems.map((item) => (
              <SidebarMenuItem
                key={item.id}
                className={cn(!open && "flex justify-center")}
              >
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === ROUTES.DASHBOARD &&
                    activeSidebarStatus === item.id
                  }
                  tooltip={item.label}
                >
                  <Link to={`${ROUTES.DASHBOARD}?sidebar_status=${item.id}`}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuBadge
                  className={cn(
                    "rounded-md bg-sidebar-primary/10 px-1.5 text-sidebar-primary",
                    item.count === 0 &&
                      "bg-transparent text-sidebar-foreground/50"
                  )}
                >
                  {item.count}
                </SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>{t("sidebar.resourceHeading")}</SidebarGroupLabel>
          <SidebarMenu>
            {secondaryItems.map((item) => (
              <SidebarMenuItem
                key={item.id}
                className={cn(!open && "flex justify-center")}
              >
                <SidebarMenuButton
                  asChild
                  isActive={item.isActive}
                  tooltip={item.label}
                >
                  <Link to={item.to}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="pt-3">
        <SidebarMenu>
          <SidebarMenuItem className={cn(!open && "flex justify-center")}>
            <SidebarMenuButton
              className="text-sidebar-foreground/78"
              onClick={() => signOut()}
              tooltip={t("sidebar.signOut")}
              type="button"
            >
              <LogOut />
              <span>{t("sidebar.signOut")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-3 text-xs text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
          {t("sidebar.shortcutHint")}
        </p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

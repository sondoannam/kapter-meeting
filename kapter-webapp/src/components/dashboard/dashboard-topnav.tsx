import { UserButton } from "@clerk/react-router"
import { useTranslation } from "react-i18next"

// import { AppDemoIcon } from "@/components/ui/app-demo-icon"
import { AppShellContainer } from "@/components/app-shell-container"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function DashboardTopNav() {
  const { t } = useTranslation(["common", "dashboardShell"])

  return (
    <header className="sticky top-0 z-40 h-(--header-height) border-b border-border/60 bg-background/80 backdrop-blur-xl dark:border-white/10 dark:bg-background/84">
      <AppShellContainer
        width="full"
        className="flex h-full items-center justify-between gap-4 py-0"
      >
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1 rounded-xl border border-border/70 bg-background/80 shadow-sm hover:bg-muted/70 dark:border-white/10 dark:bg-slate-950/60" />
          <div className="hidden h-6 w-px bg-border/70 md:block dark:bg-white/10" />

          <span className="hidden rounded-full border border-primary/18 bg-primary/8 px-4 py-2 text-[0.68rem] font-semibold tracking-[0.22em] text-primary uppercase xl:inline-flex">
            {t("reviewBadge", { ns: "dashboardShell" })}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-9 w-9 rounded-full",
              },
            }}
          />
        </div>
      </AppShellContainer>
    </header>
  )
}

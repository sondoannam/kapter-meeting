import { Link } from "react-router"
import { UserButton } from "@clerk/react-router"
import { useTranslation } from "react-i18next"

import { AppDemoIcon } from "@/components/ui/app-demo-icon"
import { AppShellContainer } from "@/components/app-shell-container"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { ROUTES } from "@/routes/routes.constants"

export function DashboardTopNav() {
  const { t } = useTranslation(["common", "dashboardShell"])

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/72 backdrop-blur-xl dark:border-white/10 dark:bg-background/78">
      <AppShellContainer className="flex min-h-[5.25rem] items-center justify-between gap-4 py-4">
        <Link
          className="group flex min-w-0 items-center gap-3"
          to={ROUTES.HOME}
        >
          <AppDemoIcon />

          <div className="space-y-1 text-wrap">
            <p className="font-heading text-lg leading-none text-tx dark:text-dk-tx">
              {t("appName", { ns: "common" })}
            </p>
            <p className="text-[0.68rem] font-medium tracking-[0.26em] text-tx2 uppercase dark:text-dk-tx2">
              {t("brandTagline", { ns: "dashboardShell" })}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-primary/18 bg-primary/8 px-4 py-2 text-[0.68rem] font-semibold tracking-[0.22em] text-primary uppercase lg:inline-flex">
            {t("reviewBadge", { ns: "dashboardShell" })}
          </span>
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

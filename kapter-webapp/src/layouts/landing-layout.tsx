import { Link, Outlet } from "react-router"
import { SignInButton, UserButton, useAuth } from "@clerk/react-router"
import { useTranslation } from "react-i18next"

import { AppShellContainer } from "@/components/app-shell-container"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/routes/routes.constants"
import { AppDemoIcon } from "@/components/ui/app-demo-icon"

export default function LandingLayout() {
  const { t } = useTranslation(["landing", "common"])
  const { isLoaded, userId } = useAuth()
  const isSignedIn = isLoaded && Boolean(userId)
  const currentYear = new Date().getFullYear()
  const footerChips = t("layout.footer.chips", {
    ns: "landing",
    returnObjects: true,
  }) as string[]

  return (
    <div className="h-svh overflow-hidden bg-background text-tx dark:text-dk-tx flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur-xl dark:border-dk-border dark:bg-dk-surface/90">
        <AppShellContainer className="flex items-center justify-between gap-4 py-4">
          <Link
            className="group flex min-w-0 items-center gap-3"
            to={ROUTES.HOME}
          >
            <AppDemoIcon />

            <div className="w-[240px] space-y-1 text-wrap">
              <p className="font-heading text-lg leading-none text-tx dark:text-dk-tx">
                {t("appName", { ns: "common" })}
              </p>
              <p className="text-[0.68rem] font-medium tracking-[0.26em] text-tx2 uppercase dark:text-dk-tx2">
                {t("layout.brandTagline", { ns: "landing" })}
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-tx2 md:flex dark:text-dk-tx2">
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />

            {isSignedIn ? (
              <Button
                asChild
                className="border-border bg-surface text-tx hover:bg-surface2 dark:border-dk-border dark:bg-dk-surface dark:text-dk-tx"
                size="sm"
                variant="outline"
              >
                <Link to={ROUTES.DASHBOARD}>
                  {t("actions.openDashboardCapitalized", { ns: "common" })}
                </Link>
              </Button>
            ) : isLoaded ? (
              <SignInButton>
                <Button
                  className="border-border bg-surface text-tx hover:bg-surface2 dark:border-dk-border dark:bg-dk-surface dark:text-dk-tx"
                  size="sm"
                  variant="outline"
                >
                  {t("actions.signIn", { ns: "common" })}
                </Button>
              </SignInButton>
            ) : null}

            {isSignedIn ? <UserButton signInUrl={ROUTES.DASHBOARD} /> : null}
          </div>
        </AppShellContainer>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>


    </div>
  )
}

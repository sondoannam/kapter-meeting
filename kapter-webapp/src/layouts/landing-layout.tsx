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
    <div className="min-h-svh bg-background text-tx dark:text-dk-tx">
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
            <a
              className="transition-colors hover:text-tx dark:hover:text-dk-tx"
              href="#workflow"
            >
              {t("layout.nav.workflow", { ns: "landing" })}
            </a>
            <a
              className="transition-colors hover:text-tx dark:hover:text-dk-tx"
              href="#signals"
            >
              {t("layout.nav.signals", { ns: "landing" })}
            </a>
            <a
              className="transition-colors hover:text-tx dark:hover:text-dk-tx"
              href="#fit"
            >
              {t("layout.nav.fit", { ns: "landing" })}
            </a>
            <a
              className="transition-colors hover:text-tx dark:hover:text-dk-tx"
              href="#extension-setup"
            >
              {t("layout.nav.extensionSetup", { ns: "landing" })}
            </a>
            <Link
              className="transition-colors hover:text-tx dark:hover:text-dk-tx"
              to={ROUTES.PRICING}
            >
              Pricing
            </Link>
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

      <main>
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-7xl px-6 pb-12">
        <div className="grid gap-8 rounded-[2rem] border border-border/70 bg-white/68 px-6 py-8 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.35)] backdrop-blur lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end dark:border-white/10 dark:bg-white/4 dark:shadow-[0_28px_80px_-56px_rgba(0,0,0,0.82)]">
          <div>
            <div className="flex items-center gap-3">
              <AppDemoIcon />
              <div>
                <p className="font-heading text-xl text-slate-950 dark:text-slate-50">
                  {t("appName", { ns: "common" })}
                </p>
                <p className="text-[0.68rem] font-medium tracking-[0.26em] text-slate-500 uppercase dark:text-slate-400">
                  {t("layout.brandTagline", { ns: "landing" })}
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              {t("layout.footer.summary", { ns: "landing" })}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
              {footerChips.map((item) => (
                <span
                  className="rounded-full border border-slate-900/8 bg-white/72 px-3 py-2 text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-slate-500 uppercase dark:text-slate-400">
                {t("layout.footer.discoverHeading", { ns: "landing" })}
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <a
                  className="block text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-50"
                  href="#workflow"
                >
                  {t("layout.nav.workflow", { ns: "landing" })}
                </a>
                <a
                  className="block text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-50"
                  href="#signals"
                >
                  {t("layout.nav.signals", { ns: "landing" })}
                </a>
                <a
                  className="block text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-50"
                  href="#fit"
                >
                  {t("layout.nav.fit", { ns: "landing" })}
                </a>
                <a
                  className="block text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-50"
                  href="#extension-setup"
                >
                  {t("layout.nav.extensionSetup", { ns: "landing" })}
                </a>
              </div>
            </div>

            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-slate-500 uppercase dark:text-slate-400">
                {t("layout.footer.accessHeading", { ns: "landing" })}
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <p>{t("layout.footer.access.dashboard", { ns: "landing" })}</p>
                <p>{t("layout.footer.access.clerk", { ns: "landing" })}</p>
                <p className="text-slate-500 dark:text-slate-400">
                  {t("layout.footer.access.copyright", {
                    ns: "landing",
                    year: currentYear,
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

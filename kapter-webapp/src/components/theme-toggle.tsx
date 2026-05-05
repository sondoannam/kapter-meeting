import { MoonStar, SunMedium } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  className?: string
}

const OPTIONS = [
  {
    value: "light",
    icon: SunMedium,
  },
  {
    value: "dark",
    icon: MoonStar,
  },
] as const

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { t } = useTranslation("common")
  const { theme, setTheme } = useTheme()
  const activeIndex = OPTIONS.findIndex((option) => option.value === theme)

  return (
    <div
      aria-label={t("themeToggle.groupLabel")}
      className={cn(
        "relative grid min-h-11 grid-cols-2 items-center rounded-full border border-slate-900/8 bg-white/80 p-1 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/6 dark:shadow-[0_18px_44px_-30px_rgba(0,0,0,0.7)]",
        className
      )}
      role="group"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-slate-950 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.8)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-white",
          activeIndex === 1 ? "translate-x-full" : "translate-x-0"
        )}
      />

      {OPTIONS.map(({ icon: Icon, value }) => {
        const isActive = theme === value
        // const translatedLabel =
        //   value === "light" ? t("themeToggle.light") : t("themeToggle.dark")

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              "relative z-10 inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-[color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isActive
                ? "text-white dark:text-slate-950"
                : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50"
            )}
            key={value}
            onClick={() => {
              setTheme(value)
            }}
            type="button"
          >
            <Icon className="size-4" />
            {/* <span className="hidden sm:inline">{translatedLabel}</span>
            <span className="sr-only">
              {t("themeToggle.useMode", { mode: translatedLabel })}
            </span> */}
          </button>
        )
      })}
    </div>
  )
}

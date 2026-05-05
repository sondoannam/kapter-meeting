import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

interface DashboardNotionCallbackBannerProps {
  status: string
  reason: string | null
  onDismiss: () => void
}

export function DashboardNotionCallbackBanner({
  status,
  reason,
  onDismiss,
}: DashboardNotionCallbackBannerProps) {
  const { t } = useTranslation(["dashboard", "common"])

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background px-5 py-4 shadow-sm shadow-foreground/5 dark:border-white/10 dark:bg-slate-950/65">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {status === "connected"
              ? t("notionCallbackBanner.connectedTitle", { ns: "dashboard" })
              : t("notionCallbackBanner.attentionTitle", { ns: "dashboard" })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "connected"
              ? t("notionCallbackBanner.connectedDescription", {
                  ns: "dashboard",
                })
              : reason ||
                t("notionCallbackBanner.fallbackDescription", {
                  ns: "dashboard",
                })}
          </p>
        </div>

        <Button onClick={onDismiss} variant="outline">
          {t("actions.close", { ns: "common" })}
        </Button>
      </div>
    </div>
  )
}

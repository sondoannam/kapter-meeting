import * as React from "react"
import { AlertTriangle, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

interface ErrorBannerProps {
  onRetry: () => void
}

export function ErrorBanner({ onRetry }: ErrorBannerProps) {
  const [isVisible, setIsVisible] = React.useState(true)
  const { t } = useTranslation(["dashboard", "common"])

  if (!isVisible) return null

  return (
    <div className="flex items-center justify-between rounded-xl border border-amber/20 bg-amber-bg px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-4 text-amber" />
        <span className="text-sm font-medium text-amber">
          {t("errorBanner.message", { ns: "dashboard" })}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={onRetry}
          size="sm"
          variant="outline"
        >
          {t("actions.retry", { ns: "common" })}
        </Button>
        <Button
          onClick={() => setIsVisible(false)}
          aria-label={t("actions.close", { ns: "common" })}
          size="icon-sm"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}

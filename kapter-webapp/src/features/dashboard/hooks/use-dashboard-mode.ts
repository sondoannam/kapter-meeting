import * as React from "react"

import {
  getGuidedCoachmarkDismissed,
  getStoredDashboardMode,
  resolveDashboardMode,
  setGuidedCoachmarkDismissed,
  setStoredDashboardMode,
  type DashboardMode,
  DASHBOARD_MODE_STORAGE_KEY,
  GUIDED_COACHMARK_STORAGE_KEY,
} from "@/features/dashboard/lib/dashboard-mode"

export function useDashboardMode(hasApprovedReview: boolean) {
  const [storedMode, setStoredMode] = React.useState<DashboardMode | null>(() =>
    getStoredDashboardMode()
  )
  const [coachmarkDismissed, setCoachmarkDismissedState] =
    React.useState<boolean>(() => getGuidedCoachmarkDismissed())

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return
      }

      if (event.key === DASHBOARD_MODE_STORAGE_KEY) {
        setStoredMode(getStoredDashboardMode())
      }

      if (event.key === GUIDED_COACHMARK_STORAGE_KEY) {
        setCoachmarkDismissedState(getGuidedCoachmarkDismissed())
      }
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  const mode = React.useMemo(
    () => storedMode ?? resolveDashboardMode(hasApprovedReview),
    [hasApprovedReview, storedMode]
  )

  const setMode = React.useCallback((nextMode: DashboardMode) => {
    setStoredDashboardMode(nextMode)
    setStoredMode(nextMode)
  }, [])

  const dismissCoachmark = React.useCallback(() => {
    setGuidedCoachmarkDismissed(true)
    setCoachmarkDismissedState(true)
  }, [])

  return {
    mode,
    hasStoredMode: storedMode !== null,
    coachmarkDismissed,
    setMode,
    dismissCoachmark,
  }
}

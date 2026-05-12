export type DashboardMode = "guided" | "standard"

export const DASHBOARD_MODE_STORAGE_KEY = "kapter.dashboard.mode"
export const GUIDED_COACHMARK_STORAGE_KEY =
  "kapter.dashboard.guidedCoachmarkDismissed"
export const GUIDED_EXTENSION_CONFIRMED_STORAGE_KEY =
  "kapter.dashboard.guidedExtensionConfirmed"

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage
}

function isDashboardMode(value: string | null): value is DashboardMode {
  return value === "guided" || value === "standard"
}

export function getStoredDashboardMode(): DashboardMode | null {
  if (!canUseStorage()) {
    return null
  }

  const value = window.localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY)

  return isDashboardMode(value) ? value : null
}

export function setStoredDashboardMode(mode: DashboardMode) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, mode)
}

export function getGuidedCoachmarkDismissed() {
  if (!canUseStorage()) {
    return false
  }

  return window.localStorage.getItem(GUIDED_COACHMARK_STORAGE_KEY) === "true"
}

export function setGuidedCoachmarkDismissed(dismissed: boolean) {
  if (!canUseStorage()) {
    return
  }

  if (!dismissed) {
    window.localStorage.removeItem(GUIDED_COACHMARK_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(GUIDED_COACHMARK_STORAGE_KEY, "true")
}

export function getGuidedExtensionConfirmed() {
  if (!canUseStorage()) {
    return false
  }

  return window.localStorage.getItem(GUIDED_EXTENSION_CONFIRMED_STORAGE_KEY) === "true"
}

export function setGuidedExtensionConfirmed(confirmed: boolean) {
  if (!canUseStorage()) {
    return
  }

  if (!confirmed) {
    window.localStorage.removeItem(GUIDED_EXTENSION_CONFIRMED_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(GUIDED_EXTENSION_CONFIRMED_STORAGE_KEY, "true")
}

export function resolveDashboardMode(hasApprovedReview: boolean) {
  const storedMode = getStoredDashboardMode()

  if (storedMode) {
    return storedMode
  }

  return hasApprovedReview ? "standard" : "guided"
}

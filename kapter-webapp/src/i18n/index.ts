import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import commonEn from "@/locales/en/common.json"
import dashboardEn from "@/locales/en/dashboard.json"
import dashboardShellEn from "@/locales/en/dashboardShell.json"
import extensionBridgeEn from "@/locales/en/extensionBridge.json"
import landingEn from "@/locales/en/landing.json"
import meetingEn from "@/locales/en/meeting.json"
import voiceProfilesEn from "@/locales/en/voiceProfiles.json"
import commonVi from "@/locales/vi/common.json"
import dashboardVi from "@/locales/vi/dashboard.json"
import dashboardShellVi from "@/locales/vi/dashboardShell.json"
import extensionBridgeVi from "@/locales/vi/extensionBridge.json"
import landingVi from "@/locales/vi/landing.json"
import meetingVi from "@/locales/vi/meeting.json"
import voiceProfilesVi from "@/locales/vi/voiceProfiles.json"

const LOCALE_STORAGE_KEY = "kapter.locale"

export const supportedLanguages = ["vi", "en"] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

function isSupportedLanguage(
  value: string | null | undefined
): value is SupportedLanguage {
  if (!value) {
    return false
  }

  return supportedLanguages.includes(value as SupportedLanguage)
}

function matchSupportedLanguage(
  value: string | null | undefined
): SupportedLanguage | null {
  if (!value) {
    return null
  }

  const normalizedValue = value.toLowerCase()

  if (normalizedValue.startsWith("vi")) {
    return "vi"
  }

  if (normalizedValue.startsWith("en")) {
    return "en"
  }

  return null
}

function detectInitialLanguage(): SupportedLanguage {
  const persistedLanguage = window.localStorage.getItem(LOCALE_STORAGE_KEY)

  if (isSupportedLanguage(persistedLanguage)) {
    return persistedLanguage
  }

  const browserLanguages = [
    ...window.navigator.languages,
    window.navigator.language,
  ]

  for (const language of browserLanguages) {
    const matchedLanguage = matchSupportedLanguage(language)

    if (matchedLanguage) {
      return matchedLanguage
    }
  }

  return "vi"
}

const resources = {
  vi: {
    common: commonVi,
    dashboard: dashboardVi,
    dashboardShell: dashboardShellVi,
    extensionBridge: extensionBridgeVi,
    landing: landingVi,
    meeting: meetingVi,
    voiceProfiles: voiceProfilesVi,
  },
  en: {
    common: commonEn,
    dashboard: dashboardEn,
    dashboardShell: dashboardShellEn,
    extensionBridge: extensionBridgeEn,
    landing: landingEn,
    meeting: meetingEn,
    voiceProfiles: voiceProfilesEn,
  },
} as const

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: detectInitialLanguage(),
    fallbackLng: "vi",
    supportedLngs: [...supportedLanguages],
    load: "languageOnly",
    ns: [
      "common",
      "landing",
      "dashboardShell",
      "dashboard",
      "meeting",
      "extensionBridge",
      "voiceProfiles",
    ],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })

  i18n.on("languageChanged", (language) => {
    const resolvedLanguage = matchSupportedLanguage(language) ?? "vi"

    window.localStorage.setItem(LOCALE_STORAGE_KEY, resolvedLanguage)
    document.documentElement.lang = resolvedLanguage
  })

  document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language
}

export { LOCALE_STORAGE_KEY }
export default i18n

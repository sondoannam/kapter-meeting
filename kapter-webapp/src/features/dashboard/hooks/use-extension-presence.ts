import * as React from "react"

import {
  createExtensionPresenceRequestId,
  EXTENSION_PRESENCE_REQUEST_MESSAGE_TYPE,
  EXTENSION_PRESENCE_REQUEST_TIMEOUT_MS,
  isExtensionPresenceResponseMessage,
} from "@/features/dashboard/lib/extension-presence-bridge"

export function useExtensionPresence() {
  const [extensionDetected, setExtensionDetected] = React.useState(false)
  const activeProbeCleanupRef = React.useRef<(() => void) | null>(null)

  const detectExtensionPresence = React.useCallback(() => {
    if (typeof window === "undefined") {
      return () => undefined
    }

    activeProbeCleanupRef.current?.()

    const requestId = createExtensionPresenceRequestId()
    let settled = false

    const cleanup = () => {
      settled = true
      if (activeProbeCleanupRef.current === cleanup) {
        activeProbeCleanupRef.current = null
      }
      window.clearTimeout(timeoutId)
      window.removeEventListener("message", handleMessage)
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return
      }

      if (!isExtensionPresenceResponseMessage(event.data)) {
        return
      }

      if (event.data.payload.requestId !== requestId) {
        return
      }

      settled = true
      activeProbeCleanupRef.current = null
      window.clearTimeout(timeoutId)
      window.removeEventListener("message", handleMessage)
      setExtensionDetected(true)
    }

    window.addEventListener("message", handleMessage)

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return
      }

      window.removeEventListener("message", handleMessage)
    }, EXTENSION_PRESENCE_REQUEST_TIMEOUT_MS)

    window.postMessage(
      {
        source: "kapter-webapp",
        type: EXTENSION_PRESENCE_REQUEST_MESSAGE_TYPE,
        payload: { requestId },
      },
      window.location.origin
    )

    return cleanup
  }, [])

  React.useEffect(() => {
    const cleanup = detectExtensionPresence()
    activeProbeCleanupRef.current = cleanup

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return
      }

      activeProbeCleanupRef.current = detectExtensionPresence()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cleanup()
      activeProbeCleanupRef.current = null
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [detectExtensionPresence])

  return {
    extensionDetected,
  }
}

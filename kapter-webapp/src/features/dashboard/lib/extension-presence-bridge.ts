export const EXTENSION_PRESENCE_REQUEST_MESSAGE_TYPE =
  "KAPTER_EXTENSION_PRESENCE_REQUEST"
export const EXTENSION_PRESENCE_RESPONSE_MESSAGE_TYPE =
  "KAPTER_EXTENSION_PRESENCE_RESPONSE"
export const EXTENSION_PRESENCE_REQUEST_TIMEOUT_MS = 1_000

export interface ExtensionPresenceResponseMessage {
  source: "kapter-extension"
  type: typeof EXTENSION_PRESENCE_RESPONSE_MESSAGE_TYPE
  payload: {
    requestId: string
  }
}

export function createExtensionPresenceRequestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }

  return `presence-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function isExtensionPresenceResponseMessage(
  value: unknown
): value is ExtensionPresenceResponseMessage {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<ExtensionPresenceResponseMessage>

  return (
    candidate.source === "kapter-extension" &&
    candidate.type === EXTENSION_PRESENCE_RESPONSE_MESSAGE_TYPE &&
    !!candidate.payload &&
    typeof candidate.payload.requestId === "string"
  )
}

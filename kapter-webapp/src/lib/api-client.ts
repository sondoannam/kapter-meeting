import axios from "axios"

function normalizeBackendBaseUrl() {
  const configuredBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    import.meta.env.VITE_BACKEND_URL?.trim()
  const normalizedBaseUrl = configuredBaseUrl || "http://localhost:3001"

  return normalizedBaseUrl.endsWith("/")
    ? normalizedBaseUrl.slice(0, -1)
    : normalizedBaseUrl
}

export const apiClient = axios.create({
  baseURL: normalizeBackendBaseUrl(),
  headers: {
    Accept: "application/json",
  },
})

export function createAuthHeaders(sessionToken: string) {
  return {
    Authorization: `Bearer ${sessionToken}`,
  }
}

function getResponseMessage(data: unknown) {
  if (typeof data === "string") {
    return data
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    Array.isArray(data.message)
  ) {
    return data.message.join(", ")
  }

  return null
}

export function toApiErrorMessage(error: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(error)) {
    const responseMessage = getResponseMessage(error.response?.data)
    const statusCode = error.response?.status
    const baseMessage = responseMessage || error.message || fallbackMessage

    return statusCode ? `${baseMessage} (${statusCode})` : baseMessage
  }

  return error instanceof Error ? error.message : fallbackMessage
}

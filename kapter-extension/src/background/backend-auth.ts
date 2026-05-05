export interface BackendCurrentUserSummary {
  id: string;
  clerkId: string | null;
  email: string;
  name: string | null;
  imageUrl: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendCurrentUserResponse {
  auth: {
    clerkUserId: string;
    sessionId: string | null;
    authorizedParty: string | null;
  };
  user: BackendCurrentUserSummary | null;
}

type FetchLike = typeof fetch;

const RAW_API_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL?.trim() ||
  "http://localhost:3001";

export function getBackendApiBaseUrl(): string {
  try {
    const url = new URL(RAW_API_URL);
    return url.toString().endsWith("/")
      ? url.toString().slice(0, -1)
      : url.toString();
  } catch {
    return "http://localhost:3001";
  }
}

async function extractErrorMessage(response: Response): Promise<string | null> {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    const payload = JSON.parse(responseText) as {
      message?: unknown;
      error?: unknown;
    };

    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (Array.isArray(payload.message)) {
      return payload.message.find((item) => typeof item === "string") ?? null;
    }

    if (typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    return responseText;
  }

  return responseText;
}

export async function syncBackendSession(
  sessionToken: string,
  fetchImpl: FetchLike = fetch,
  apiBaseUrl = getBackendApiBaseUrl(),
): Promise<BackendCurrentUserResponse> {
  let response: Response;

  try {
    response = await fetchImpl(new URL("/api/auth/me", `${apiBaseUrl}/`), {
      method: "GET",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        accept: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Backend auth preflight failed: ${message}`);
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(
      message
        ? `Backend auth preflight failed: ${message}`
        : `Backend auth preflight failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as BackendCurrentUserResponse;

  if (!payload.user) {
    throw new Error(
      "Backend auth preflight completed without a synced local user.",
    );
  }

  return payload;
}

import type { QuotaSnapshot } from "@kapter/contracts";

import { getBackendApiBaseUrl } from "./backend-auth";

interface BackendQuotaResponse {
  quota: QuotaSnapshot;
}

type FetchLike = typeof fetch;

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

export async function fetchBillingQuota(
  sessionToken: string,
  fetchImpl: FetchLike = fetch,
  apiBaseUrl = getBackendApiBaseUrl(),
): Promise<QuotaSnapshot> {
  let response: Response;

  try {
    response = await fetchImpl(new URL("/api/billing/me", `${apiBaseUrl}/`), {
      method: "GET",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        accept: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load quota: ${message}`);
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(
      message
        ? `Unable to load quota: ${message}`
        : `Unable to load quota with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as BackendQuotaResponse;

  return payload.quota;
}

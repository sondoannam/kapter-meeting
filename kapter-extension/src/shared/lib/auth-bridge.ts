export const EXTENSION_BRIDGE_PATH = "/extension-bridge";
export const BRIDGE_TOKEN_MESSAGE_TYPE = "KAPTER_EXTENSION_TOKEN_BRIDGE_RESULT";
export const BRIDGE_ACK_MESSAGE_TYPE = "KAPTER_EXTENSION_TOKEN_BRIDGE_ACK";
export const BRIDGE_SILENT_TOKEN_REQUEST = "KAPTER_EXTENSION_SILENT_TOKEN_REQUEST";
export const BRIDGE_PRESENCE_REQUEST_MESSAGE_TYPE =
  "KAPTER_EXTENSION_PRESENCE_REQUEST";
export const BRIDGE_PRESENCE_RESPONSE_MESSAGE_TYPE =
  "KAPTER_EXTENSION_PRESENCE_RESPONSE";
export const BRIDGE_REQUEST_MAX_AGE_MS = 5 * 60_000;
export const AUTH_EXPIRING_SOON_THRESHOLD_MS = 5 * 60_000; // 5 minutes

export interface ExtensionAuthState {
  status: "disconnected" | "pending" | "connected";
  requestId: string | null;
  sessionToken: string | null;
  userId: string | null;
  expiresAt: number | null;
  updatedAt: number | null;
  lastError: string | null;
}

export const DEFAULT_AUTH_STATE: ExtensionAuthState = {
  status: "disconnected",
  requestId: null,
  sessionToken: null,
  userId: null,
  expiresAt: null,
  updatedAt: null,
  lastError: null,
};

const RAW_WEBAPP_URL = import.meta.env.VITE_WEBAPP_URL?.trim();

export function buildDisconnectedAuthState(
  overrides: Partial<Pick<ExtensionAuthState, "lastError" | "updatedAt">> = {},
): ExtensionAuthState {
  return {
    ...DEFAULT_AUTH_STATE,
    lastError: overrides.lastError ?? null,
    updatedAt: overrides.updatedAt ?? Date.now(),
  };
}

export function normalizeAuthState(
  value?: Partial<ExtensionAuthState>,
): ExtensionAuthState {
  return {
    ...DEFAULT_AUTH_STATE,
    ...value,
  };
}

export function getConfiguredWebappUrl(): string {
  if (!RAW_WEBAPP_URL) {
    throw new Error(
      "Missing VITE_WEBAPP_URL. Set it to the Kapter webapp origin before using the auth bridge.",
    );
  }

  return RAW_WEBAPP_URL.endsWith("/")
    ? RAW_WEBAPP_URL.slice(0, -1)
    : RAW_WEBAPP_URL;
}

export function buildExtensionBridgeUrl(requestId: string): string {
  const url = new URL(EXTENSION_BRIDGE_PATH, `${getConfiguredWebappUrl()}/`);
  url.searchParams.set("requestId", requestId);
  return url.toString();
}

export function isBridgePageLocation(url: string): boolean {
  try {
    const candidate = new URL(url);
    const webappUrl = new URL(getConfiguredWebappUrl());

    return (
      candidate.origin === webappUrl.origin &&
      candidate.pathname === EXTENSION_BRIDGE_PATH
    );
  } catch {
    return false;
  }
}

function decodeBase64UrlSegment(segment: string): string | null {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  try {
    return atob(`${normalized}${padding}`);
  } catch {
    return null;
  }
}

export function readJwtExpiration(token: string): number | null {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  const decoded = decodeBase64UrlSegment(payload);

  if (!decoded) {
    return null;
  }

  try {
    const claims = JSON.parse(decoded) as { exp?: unknown };
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAuthStateExpired(
  authState: ExtensionAuthState,
  now = Date.now(),
): boolean {
  return (
    typeof authState.expiresAt === "number" &&
    authState.expiresAt <= now + 15_000
  );
}

export function isAuthStateExpiringSoon(
  authState: ExtensionAuthState,
  now = Date.now(),
): boolean {
  return (
    typeof authState.expiresAt === "number" &&
    authState.expiresAt <= now + AUTH_EXPIRING_SOON_THRESHOLD_MS
  );
}

export function isPendingAuthStateStale(
  authState: ExtensionAuthState,
  now = Date.now(),
): boolean {
  return (
    authState.status === "pending" &&
    typeof authState.updatedAt === "number" &&
    authState.updatedAt <= now - BRIDGE_REQUEST_MAX_AGE_MS
  );
}

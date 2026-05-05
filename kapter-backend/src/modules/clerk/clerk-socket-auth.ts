export interface SocketHandshakeLike {
  auth?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const readAuthorizationHeader = (
  authorizationHeader: string | string[] | undefined,
): string | undefined => {
  const normalizedHeader = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;

  const headerValue = readString(normalizedHeader);

  if (!headerValue) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(headerValue);
  return match ? readString(match[1]) : undefined;
};

export const extractSessionTokenFromHandshake = (
  handshake: SocketHandshakeLike,
): string | undefined => {
  const authToken = readString(handshake.auth?.token);

  if (authToken) {
    return authToken;
  }

  return readAuthorizationHeader(handshake.headers?.authorization);
};

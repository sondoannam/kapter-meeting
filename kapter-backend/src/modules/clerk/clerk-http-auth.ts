export interface ClerkHttpRequestLike {
  headers: {
    authorization?: string | string[] | undefined;
    cookie?: string | string[] | undefined;
  };
}

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const getHeaderValue = (
  value: string | string[] | undefined,
): string | undefined => {
  if (Array.isArray(value)) {
    return value.find(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    );
  }

  return value;
};

const readBearerToken = (
  authorizationHeader: string | string[] | undefined,
): string | undefined => {
  const headerValue = asNonEmptyString(getHeaderValue(authorizationHeader));

  if (!headerValue) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(headerValue);
  return match ? asNonEmptyString(match[1]) : undefined;
};

const readSessionCookie = (
  cookieHeader: string | string[] | undefined,
): string | undefined => {
  const headerValue = asNonEmptyString(getHeaderValue(cookieHeader));

  if (!headerValue) {
    return undefined;
  }

  for (const cookie of headerValue.split(";")) {
    const [cookieName, ...cookieValueParts] = cookie.split("=");

    if (cookieName?.trim() !== "__session") {
      continue;
    }

    const cookieValue = cookieValueParts.join("=").trim();

    if (cookieValue.length > 0) {
      return cookieValue;
    }
  }

  return undefined;
};

export const extractSessionTokenFromHttpRequest = (
  request: ClerkHttpRequestLike,
): string | undefined => {
  return (
    readBearerToken(request.headers.authorization) ??
    readSessionCookie(request.headers.cookie)
  );
};

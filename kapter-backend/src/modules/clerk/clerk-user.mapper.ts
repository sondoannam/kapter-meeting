export interface ClerkEmailAddressLike {
  id: string;
  email_address: string;
}

export interface ClerkApiEmailAddressLike {
  id: string;
  emailAddress: string;
}

export interface ClerkUserLike {
  id: string;
  username?: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url?: string | null;
  primary_email_address_id: string | null;
  email_addresses: ClerkEmailAddressLike[];
}

export interface ClerkApiUserLike {
  id: string;
  username?: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl?: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: ClerkApiEmailAddressLike[];
}

export interface ClerkDeletedUserLike {
  id: string;
  image_url?: string | null;
}

export type ClerkUserEventPayload =
  | {
      type: "user.created" | "user.updated";
      data: ClerkUserLike;
    }
  | {
      type: "user.deleted";
      data: ClerkDeletedUserLike;
    };

export interface NormalizedClerkUser {
  clerkId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  deleted: boolean;
}

type ClerkUserRecord = ClerkUserLike | ClerkApiUserLike;

const LOCAL_EMAIL_DOMAIN = "clerk.local";

const buildLocalEmail = (prefix: string, clerkId: string): string =>
  `${prefix}+${clerkId}@${LOCAL_EMAIL_DOMAIN}`;

const normalizeOptionalString = (
  value: string | null | undefined,
): string | null => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

const resolveImageUrl = (user: ClerkUserRecord): string | null => {
  const webhookUser = user as ClerkUserLike;
  const apiUser = user as ClerkApiUserLike;

  return normalizeOptionalString(webhookUser.image_url ?? apiUser.imageUrl);
};

const resolveEmailAddress = (
  email: ClerkEmailAddressLike | ClerkApiEmailAddressLike | undefined,
): string | undefined => {
  if (!email) {
    return undefined;
  }

  return "email_address" in email ? email.email_address : email.emailAddress;
};

const resolveUserName = (user: ClerkUserRecord): string | null => {
  const firstName = "first_name" in user ? user.first_name : user.firstName;
  const lastName = "last_name" in user ? user.last_name : user.lastName;
  const nameParts = [firstName, lastName]
    .map((value) => normalizeOptionalString(value))
    .filter((value): value is string => value !== null);

  if (nameParts.length > 0) {
    return nameParts.join(" ");
  }

  return normalizeOptionalString(user.username);
};

const resolvePrimaryEmail = (user: ClerkUserRecord): string => {
  const emailAddresses =
    "email_addresses" in user ? user.email_addresses : user.emailAddresses;
  const primaryEmailAddressId =
    "primary_email_address_id" in user
      ? user.primary_email_address_id
      : user.primaryEmailAddressId;
  const primaryEmail = emailAddresses.find(
    ({ id }) => id === primaryEmailAddressId,
  );
  const fallbackEmail = emailAddresses[0];
  const resolvedEmail = normalizeOptionalString(
    resolveEmailAddress(primaryEmail) ?? resolveEmailAddress(fallbackEmail),
  );

  return resolvedEmail ?? buildLocalEmail("user", user.id);
};

export const normalizeClerkUserRecord = (
  user: ClerkUserRecord,
): NormalizedClerkUser => ({
  clerkId: user.id,
  email: resolvePrimaryEmail(user),
  name: resolveUserName(user),
  imageUrl: resolveImageUrl(user),
  deleted: false,
});

export const normalizeClerkUserEvent = (
  event: ClerkUserEventPayload,
): NormalizedClerkUser => {
  if (event.type === "user.deleted") {
    return {
      clerkId: event.data.id,
      email: buildLocalEmail("deleted", event.data.id),
      name: null,
      imageUrl: normalizeOptionalString(event.data.image_url),
      deleted: true,
    };
  }

  return normalizeClerkUserRecord(event.data);
};

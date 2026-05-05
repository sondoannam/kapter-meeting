import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeClerkUserEvent } from "./clerk-user.mapper";

void describe("normalizeClerkUserEvent", () => {
  void it("maps a created Clerk user using the primary email address and full name", () => {
    const normalizedUser = normalizeClerkUserEvent({
      type: "user.created",
      data: {
        id: "user_123",
        first_name: "Ada",
        last_name: "Lovelace",
        image_url: "https://img.example.com/ada.png",
        primary_email_address_id: "email_primary",
        email_addresses: [
          {
            id: "email_secondary",
            email_address: "secondary@example.com",
          },
          {
            id: "email_primary",
            email_address: "ada@example.com",
          },
        ],
      },
    });

    assert.deepEqual(normalizedUser, {
      clerkId: "user_123",
      email: "ada@example.com",
      name: "Ada Lovelace",
      imageUrl: "https://img.example.com/ada.png",
      deleted: false,
    });
  });

  void it("maps a deleted Clerk user to a tombstone email while preserving the Clerk identity", () => {
    const normalizedUser = normalizeClerkUserEvent({
      type: "user.deleted",
      data: {
        id: "user_deleted",
        image_url: null,
      },
    });

    assert.deepEqual(normalizedUser, {
      clerkId: "user_deleted",
      email: "deleted+user_deleted@clerk.local",
      name: null,
      imageUrl: null,
      deleted: true,
    });
  });
});

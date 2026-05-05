import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { syncBackendSession } from "./backend-auth.ts";

void describe("syncBackendSession", () => {
  void it("calls the backend auth endpoint and returns the synced local user", async () => {
    let receivedUrl = "";
    let receivedHeaders: Headers | undefined;

    const result = await syncBackendSession(
      "session_token",
      async (input, init) => {
        receivedUrl = String(input);
        receivedHeaders = new Headers(init?.headers);

        return new Response(
          JSON.stringify({
            auth: {
              clerkUserId: "clerk_user_1",
              sessionId: "sess_1",
              authorizedParty: "http://localhost:5173",
            },
            user: {
              id: "local_user_1",
              clerkId: "clerk_user_1",
              email: "user@example.com",
              name: "Test User",
              imageUrl: null,
              deletedAt: null,
              createdAt: "2026-04-22T00:00:00.000Z",
              updatedAt: "2026-04-22T00:00:00.000Z",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      },
      "http://localhost:3001",
    );

    assert.equal(receivedUrl, "http://localhost:3001/api/auth/me");
    assert.equal(receivedHeaders?.get("authorization"), "Bearer session_token");
    assert.equal(receivedHeaders?.get("accept"), "application/json");
    assert.equal(result.user?.id, "local_user_1");
  });

  void it("throws when the backend does not return a synced local user", async () => {
    await assert.rejects(
      syncBackendSession(
        "session_token",
        async () =>
          new Response(
            JSON.stringify({
              auth: {
                clerkUserId: "clerk_user_1",
                sessionId: "sess_1",
                authorizedParty: null,
              },
              user: null,
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
        "http://localhost:3001",
      ),
      /synced local user/i,
    );
  });
});

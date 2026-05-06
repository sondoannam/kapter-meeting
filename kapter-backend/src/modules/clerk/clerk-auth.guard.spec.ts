import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { ClerkAuthGuard } from "./clerk-auth.guard";

void describe("ClerkAuthGuard", () => {
  void it("allows HTTP OPTIONS requests without Clerk authentication", async () => {
    const reflector = {
      getAllAndOverride: mock.fn(() => false),
    };
    const verifySessionToken = mock.fn(async () => {
      throw new Error("should not verify preflight requests");
    });
    const getOrSyncLocalUser = mock.fn(async () => {
      throw new Error("should not hydrate preflight requests");
    });
    const guard = new ClerkAuthGuard(
      reflector as unknown as ConstructorParameters<typeof ClerkAuthGuard>[0],
      {
        verifySessionToken,
        getOrSyncLocalUser,
      } as unknown as ConstructorParameters<typeof ClerkAuthGuard>[1],
    );

    const canActivate = await guard.canActivate({
      getType: () => "http",
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          method: "OPTIONS",
          headers: {},
        }),
      }),
    } as never);

    assert.equal(canActivate, true);
    assert.equal(reflector.getAllAndOverride.mock.callCount(), 0);
    assert.equal(verifySessionToken.mock.callCount(), 0);
    assert.equal(getOrSyncLocalUser.mock.callCount(), 0);
  });

  void it("hydrates the local user context for authenticated HTTP requests", async () => {
    const verifySessionToken = mock.fn(async () => ({
      userId: "clerk_user_1",
      sessionId: "sess_1",
      authorizedParty: null,
      claims: {},
    }));
    const getOrSyncLocalUser = mock.fn(async () => ({
      id: "local_user_1",
      clerkId: "clerk_user_1",
      email: "user@example.com",
      name: "Test User",
      imageUrl: null,
    }));
    const guard = new ClerkAuthGuard(
      {
        getAllAndOverride: mock.fn(() => false),
      } as unknown as ConstructorParameters<typeof ClerkAuthGuard>[0],
      {
        verifySessionToken,
        getOrSyncLocalUser,
      } as unknown as ConstructorParameters<typeof ClerkAuthGuard>[1],
    );

    const request: {
      headers: { authorization: string };
      auth?: unknown;
      localUser?: unknown;
    } = {
      headers: {
        authorization: "Bearer session_token",
      },
    };

    const canActivate = await guard.canActivate({
      getType: () => "http",
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as never);

    assert.equal(canActivate, true);
    assert.equal(verifySessionToken.mock.callCount(), 1);
    assert.equal(getOrSyncLocalUser.mock.callCount(), 1);
    assert.deepEqual(request.auth, {
      userId: "clerk_user_1",
      sessionId: "sess_1",
      authorizedParty: null,
      claims: {},
    });
    assert.deepEqual(request.localUser, {
      id: "local_user_1",
      clerkId: "clerk_user_1",
      email: "user@example.com",
      name: "Test User",
      imageUrl: null,
    });
  });
});

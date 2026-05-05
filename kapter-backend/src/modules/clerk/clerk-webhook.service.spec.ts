import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { ClerkWebhookService } from "./clerk-webhook.service";

const createService = () => {
  const syncNormalizedUser = mock.fn(
    async (_payload: unknown) => null as unknown,
  );

  const logger = {
    info: mock.fn(() => undefined),
    debug: mock.fn(() => undefined),
    warn: mock.fn(() => undefined),
  };

  const service = new ClerkWebhookService(
    { syncNormalizedUser } as never,
    { clerk: { webhookSigningSecret: "whsec_test" } } as never,
    logger as never,
  );

  return {
    service,
    syncNormalizedUser,
    logger,
  };
};

void describe("ClerkWebhookService", () => {
  void it("does not create a tombstone user when a delete webhook arrives for an unknown Clerk user", async () => {
    const { service, syncNormalizedUser, logger } = createService();

    await service.handleEvent({
      type: "user.deleted",
      data: {
        id: "user_deleted_missing_locally",
        image_url: null,
      },
    } as never);

    assert.equal(syncNormalizedUser.mock.callCount(), 1);
    const syncNormalizedUserCall = syncNormalizedUser.mock.calls[0];
    assert.ok(syncNormalizedUserCall);
    assert.deepEqual(syncNormalizedUserCall.arguments[0], {
      clerkId: "user_deleted_missing_locally",
      email: "deleted+user_deleted_missing_locally@clerk.local",
      name: null,
      imageUrl: null,
      deleted: true,
    });
    assert.equal(logger.info.mock.callCount(), 0);
  });
});

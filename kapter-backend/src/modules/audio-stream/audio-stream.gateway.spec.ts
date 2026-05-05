import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { AudioStreamGateway } from "./audio-stream.gateway";

void describe("AudioStreamGateway", () => {
  void it("forwards disconnect finalization to the audio stream service", () => {
    const handleClientDisconnect = mock.fn(async () => undefined);
    const audioStreamService = { handleClientDisconnect };
    const config = {
      wsAudioNamespace: "/audio-stream",
    };
    const logger = {
      info: mock.fn(() => undefined),
      warn: mock.fn(() => undefined),
      error: mock.fn(() => undefined),
      debug: mock.fn(() => undefined),
    };

    const gateway = new AudioStreamGateway(
      audioStreamService as unknown as ConstructorParameters<
        typeof AudioStreamGateway
      >[0],
      {} as ConstructorParameters<typeof AudioStreamGateway>[1],
      logger as unknown as ConstructorParameters<typeof AudioStreamGateway>[2],
      config as unknown as ConstructorParameters<typeof AudioStreamGateway>[3],
    );

    gateway.handleDisconnect({
      id: "client_1",
      data: {
        auth: { userId: "clerk_user_1" },
        userId: "local_user_1",
      },
    } as unknown as Parameters<AudioStreamGateway["handleDisconnect"]>[0]);

    assert.equal(handleClientDisconnect.mock.callCount(), 1);
    assert.equal(
      handleClientDisconnect.mock.calls[0]?.arguments[0],
      "client_1",
    );
    assert.equal(logger.info.mock.callCount(), 1);
  });

  void it("hydrates missing local users through Clerk auth before accepting websocket connections", async () => {
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
    const logger = {
      info: mock.fn(() => undefined),
      warn: mock.fn(() => undefined),
      error: mock.fn(() => undefined),
      debug: mock.fn(() => undefined),
    };

    const gateway = new AudioStreamGateway(
      {
        handleClientDisconnect: mock.fn(async () => undefined),
      } as unknown as ConstructorParameters<typeof AudioStreamGateway>[0],
      {
        verifySessionToken,
        getOrSyncLocalUser,
      } as unknown as ConstructorParameters<typeof AudioStreamGateway>[1],
      logger as unknown as ConstructorParameters<typeof AudioStreamGateway>[2],
      {
        wsAudioNamespace: "/audio-stream",
      } as unknown as ConstructorParameters<typeof AudioStreamGateway>[3],
    );

    const client = {
      id: "client_1",
      handshake: {
        auth: {
          token: "session_token",
        },
        headers: {},
        query: {},
      },
      data: {},
    } as Parameters<AudioStreamGateway["handleConnection"]>[0];

    let nextError: Error | undefined;

    await gateway["authorizeSocket"](client, (error?: Error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(verifySessionToken.mock.callCount(), 1);
    assert.equal(getOrSyncLocalUser.mock.callCount(), 1);
    assert.equal(client.data.userId, "local_user_1");
    assert.deepEqual(client.data.localUser, {
      id: "local_user_1",
      clerkId: "clerk_user_1",
      email: "user@example.com",
      name: "Test User",
      imageUrl: null,
    });
  });
});

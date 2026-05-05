import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractSessionTokenFromHandshake } from "./clerk-socket-auth";

void describe("extractSessionTokenFromHandshake", () => {
  void it("prefers the explicit handshake auth token", () => {
    const token = extractSessionTokenFromHandshake({
      auth: {
        token: "session_token_from_auth",
      },
      headers: {
        authorization: "Bearer ignored_header_token",
      },
      query: {},
    });

    assert.equal(token, "session_token_from_auth");
  });

  void it("falls back to a bearer token in the authorization header", () => {
    const token = extractSessionTokenFromHandshake({
      auth: {},
      headers: {
        authorization: "Bearer session_token_from_header",
      },
      query: {},
    });

    assert.equal(token, "session_token_from_header");
  });

  void it("returns undefined when no supported token source is present", () => {
    const token = extractSessionTokenFromHandshake({
      auth: {},
      headers: {},
      query: {},
    });

    assert.equal(token, undefined);
  });
});

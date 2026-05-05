import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractSessionTokenFromHttpRequest } from "./clerk-http-auth";

void describe("extractSessionTokenFromHttpRequest", () => {
  void it("prefers a bearer token from the authorization header", () => {
    const token = extractSessionTokenFromHttpRequest({
      headers: {
        authorization: "Bearer session_token_from_header",
        cookie: "__session=session_token_from_cookie",
      },
    });

    assert.equal(token, "session_token_from_header");
  });

  void it("falls back to the __session cookie when the authorization header is missing", () => {
    const token = extractSessionTokenFromHttpRequest({
      headers: {
        cookie:
          "theme=dark; __session=session_token_from_cookie; Path=/; HttpOnly",
      },
    });

    assert.equal(token, "session_token_from_cookie");
  });

  void it("returns undefined when neither a bearer token nor __session cookie is present", () => {
    const token = extractSessionTokenFromHttpRequest({
      headers: {
        cookie: "theme=dark; locale=en",
      },
    });

    assert.equal(token, undefined);
  });
});

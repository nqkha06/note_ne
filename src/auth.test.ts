import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSessionToken, csrfMatches, readSessionToken } from "./auth.js";

const secret = "test-session-secret-with-at-least-32-characters";

describe("account sessions", () => {
  it("accepts a signed session and rejects tampering or expiry", () => {
    const token = createSessionToken(42, secret, 1_000);
    const session = readSessionToken(token, secret, 2_000);
    assert.equal(session?.userId, 42);
    assert.ok(session?.csrf);
    assert.equal(readSessionToken(`${token}x`, secret, 2_000), null);
    assert.equal(readSessionToken(token, secret, 8 * 24 * 60 * 60 * 1000), null);
  });

  it("compares CSRF tokens without accepting missing values", () => {
    assert.equal(csrfMatches("same-token-value-123456789", "same-token-value-123456789"), true);
    assert.equal(csrfMatches("same-token-value-123456789", "different-token"), false);
    assert.equal(csrfMatches("same-token-value-123456789", null), false);
  });
});

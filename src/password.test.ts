import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hash as hashArgon2 } from "@node-rs/argon2";
import { hashSync as hashBcrypt } from "bcryptjs";

import {
  createUnlockToken,
  isUnlockTokenValid,
  PasswordAttemptLimiter,
  verifyLegacyPassword,
} from "./password.js";

describe("legacy note passwords", () => {
  it("verifies Laravel bcrypt and Argon2 hashes", async () => {
    const bcrypt = hashBcrypt("open-sesame", 4).replace(/^\$2b\$/, "$2y$");
    const argon2 = await hashArgon2("open-sesame", { memoryCost: 4096, timeCost: 1 });
    assert.equal(await verifyLegacyPassword("open-sesame", bcrypt), true);
    assert.equal(await verifyLegacyPassword("wrong", bcrypt), false);
    assert.equal(await verifyLegacyPassword("open-sesame", argon2), true);
    assert.equal(await verifyLegacyPassword("wrong", argon2), false);
    assert.equal(await verifyLegacyPassword("anything", "not-a-supported-hash"), false);
  });

  it("signs short-lived unlock tokens with the stored password hash", () => {
    const now = Date.UTC(2026, 9, 31);
    const token = createUnlockToken("Nb7P", "$2y$hash", now);
    assert.equal(isUnlockTokenValid(token, "Nb7P", "$2y$hash", now), true);
    assert.equal(isUnlockTokenValid(token, "other", "$2y$hash", now), false);
    assert.equal(isUnlockTokenValid(`${token}x`, "Nb7P", "$2y$hash", now), false);
    assert.equal(isUnlockTokenValid(token, "Nb7P", "$2y$hash", now + 3_600_001), false);
  });

  it("limits repeated failed attempts for one client and alias", () => {
    const limiter = new PasswordAttemptLimiter(2, 60_000);
    limiter.failure("client:note", 1_000);
    assert.equal(limiter.retryAfter("client:note", 2_000), 0);
    limiter.failure("client:note", 2_000);
    assert.equal(limiter.retryAfter("client:note", 3_000), 58);
    limiter.success("client:note");
    assert.equal(limiter.retryAfter("client:note", 3_000), 0);
  });
});

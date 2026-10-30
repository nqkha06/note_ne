import { createHmac, timingSafeEqual } from "node:crypto";

import { verify as verifyArgon2 } from "@node-rs/argon2";
import { compare as verifyBcrypt } from "bcryptjs";

export const UNLOCK_COOKIE_NAME = "stu_note_unlock";
const UNLOCK_SECONDS = 60 * 60;

export async function verifyLegacyPassword(candidate: string, storedHash: string) {
  try {
    if (/^\$2[aby]\$/.test(storedHash)) {
      const normalized = storedHash.startsWith("$2y$")
        ? `$2b$${storedHash.slice(4)}`
        : storedHash;
      return await verifyBcrypt(candidate, normalized);
    }
    if (/^\$argon2(?:id|i|d)\$/.test(storedHash)) {
      return await verifyArgon2(storedHash, candidate);
    }
    return false;
  } catch {
    return false;
  }
}

function signature(payload: string, storedHash: string) {
  return createHmac("sha256", storedHash).update(payload).digest("base64url");
}

export function createUnlockToken(alias: string, storedHash: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ alias, expiresAt: now + UNLOCK_SECONDS * 1000 }))
    .toString("base64url");
  return `${payload}.${signature(payload, storedHash)}`;
}

export function isUnlockTokenValid(
  token: string | undefined,
  alias: string,
  storedHash: string,
  now = Date.now(),
) {
  if (!token) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra !== undefined) return false;
  const expected = Buffer.from(signature(payload, storedHash));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("alias" in parsed) ||
      !("expiresAt" in parsed) ||
      parsed.alias !== alias ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function readUnlockCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(";")) {
    const [name, ...value] = item.trim().split("=");
    if (name === UNLOCK_COOKIE_NAME) return value.join("=");
  }
  return undefined;
}

export function unlockCookie(token: string, secure: boolean) {
  return [
    `${UNLOCK_COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${UNLOCK_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export class PasswordAttemptLimiter {
  private readonly attempts = new Map<string, { failures: number; resetAt: number }>();

  constructor(
    private readonly maximumFailures = 5,
    private readonly windowMilliseconds = 15 * 60 * 1000,
  ) {}

  retryAfter(key: string, now = Date.now()) {
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      if (current) this.attempts.delete(key);
      return 0;
    }
    return current.failures >= this.maximumFailures
      ? Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      : 0;
  }

  failure(key: string, now = Date.now()) {
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { failures: 1, resetAt: now + this.windowMilliseconds });
      return;
    }
    current.failures += 1;
  }

  success(key: string) {
    this.attempts.delete(key);
  }
}

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "stu_note_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

export type Session = {
  userId: number;
  expiresAt: number;
  csrf: string;
};

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(userId: number, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: now + SESSION_SECONDS * 1000,
    csrf: randomBytes(24).toString("base64url"),
  })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string | undefined, secret: string, now = Date.now()): Session | null {
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Session>;
    if (
      !Number.isSafeInteger(value.userId) || (value.userId ?? 0) <= 0 ||
      typeof value.expiresAt !== "number" || value.expiresAt <= now ||
      typeof value.csrf !== "string" || value.csrf.length < 20
    ) return null;
    return value as Session;
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(";")) {
    const [candidate, ...value] = item.trim().split("=");
    if (candidate === name) return value.join("=");
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean) {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie(secure: boolean) {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function csrfMatches(expected: string, supplied: string | null) {
  if (!supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

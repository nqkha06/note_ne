import type { IncomingMessage, ServerResponse } from "node:http";

import { publicNoteState } from "./note.js";
import type { NoteRepository } from "./note-repository.js";
import {
  createUnlockToken,
  isUnlockTokenValid,
  PasswordAttemptLimiter,
  readUnlockCookie,
  unlockCookie,
  verifyLegacyPassword,
} from "./password.js";
import { renderNote, renderPasswordForm, renderState } from "./render.js";
import { stylesheet } from "./styles.js";

const ALIAS = /^[A-Za-z0-9_-]{1,255}$/;
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

type Logger = (error: unknown) => void;

function send(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  contentType: string,
  body: string,
  headers: Record<string, string> = {},
) {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    "Cache-Control": "private, no-store",
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

function html(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  body: string,
) {
  send(request, response, status, "text/html; charset=utf-8", body);
}

function pathAlias(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  try {
    const alias = decodeURIComponent(segments[0] ?? "");
    return ALIAS.test(alias) ? alias : null;
  } catch {
    return null;
  }
}

function methodNotAllowed(request: IncomingMessage, response: ServerResponse) {
  send(request, response, 405, "text/plain; charset=utf-8", "Method Not Allowed", {
    Allow: "GET, HEAD, POST",
  });
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clientKey(request: IncomingMessage, alias: string) {
  const forwarded = firstHeader(request.headers["cf-connecting-ip"])
    ?? firstHeader(request.headers["x-forwarded-for"])?.split(",")[0]?.trim()
    ?? request.socket.remoteAddress
    ?? "unknown";
  return `${forwarded}:${alias.toLowerCase()}`;
}

function isSecureRequest(request: IncomingMessage) {
  return firstHeader(request.headers["x-forwarded-proto"])?.split(",")[0]?.trim() === "https"
    || ("encrypted" in request.socket && request.socket.encrypted === true);
}

async function readPassword(request: IncomingMessage) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return null;
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    length += buffer.length;
    if (length > 4096) throw new Error("FORM_TOO_LARGE");
    chunks.push(buffer);
  }
  const password = new URLSearchParams(Buffer.concat(chunks).toString("utf8")).get("password");
  return password && password.length <= 1024 ? password : null;
}

export function createRequestHandler(repository: NoteRepository, logError: Logger = console.error) {
  const passwordAttempts = new PasswordAttemptLimiter();

  return async function handler(request: IncomingMessage, response: ServerResponse) {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
      methodNotAllowed(request, response);
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/styles.css") {
      if (request.method === "POST") return methodNotAllowed(request, response);
      send(request, response, 200, "text/css; charset=utf-8", stylesheet, {
        "Cache-Control": "public, max-age=86400",
      });
      return;
    }
    if (url.pathname === "/health/live") {
      if (request.method === "POST") return methodNotAllowed(request, response);
      send(request, response, 200, "application/json; charset=utf-8", '{"status":"ok"}');
      return;
    }
    if (url.pathname === "/health/ready") {
      if (request.method === "POST") return methodNotAllowed(request, response);
      try {
        await repository.ping();
        send(request, response, 200, "application/json; charset=utf-8", '{"status":"ok"}');
      } catch (error) {
        logError(error);
        send(request, response, 503, "application/json; charset=utf-8", '{"status":"unavailable"}');
      }
      return;
    }

    const alias = pathAlias(url.pathname);
    if (!alias) {
      html(request, response, 404, renderState("404", "Không tìm thấy ghi chú", "Đường dẫn này không tồn tại."));
      return;
    }

    try {
      const note = await repository.findByAlias(alias);
      if (!note) {
        html(request, response, 404, renderState("404", "Không tìm thấy ghi chú", "Ghi chú có thể đã bị xóa hoặc đường dẫn không đúng."));
        return;
      }
      const state = publicNoteState(note);
      if (state.kind === "unavailable") {
        html(request, response, 410, renderState("Không còn khả dụng", "Ghi chú đã đóng", "Nội dung này đã hết hạn hoặc không còn được chia sẻ."));
        return;
      }
      if (state.kind === "protected") {
        const storedHash = state.note.password?.trim();
        if (!storedHash) {
          html(request, response, 503, renderState("Tạm gián đoạn", "Chưa thể mở ghi chú", "Vui lòng thử lại sau ít phút."));
          return;
        }
        if (request.method !== "POST") {
          const token = readUnlockCookie(firstHeader(request.headers.cookie));
          if (isUnlockTokenValid(token, alias, storedHash)) {
            html(request, response, 200, renderNote(state.note));
          } else {
            html(request, response, 200, renderPasswordForm(state.note));
          }
          return;
        }

        const key = clientKey(request, alias);
        const retryAfter = passwordAttempts.retryAfter(key);
        if (retryAfter > 0) {
          send(
            request,
            response,
            429,
            "text/html; charset=utf-8",
            renderPasswordForm(state.note, "Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại."),
            { "Retry-After": String(retryAfter) },
          );
          return;
        }

        let candidate: string | null;
        try {
          candidate = await readPassword(request);
        } catch {
          html(request, response, 413, renderPasswordForm(state.note, "Dữ liệu gửi lên quá lớn."));
          return;
        }
        if (!candidate) {
          html(request, response, 400, renderPasswordForm(state.note, "Vui lòng nhập mật khẩu."));
          return;
        }
        if (!(await verifyLegacyPassword(candidate, storedHash))) {
          passwordAttempts.failure(key);
          html(request, response, 401, renderPasswordForm(state.note, "Mật khẩu không đúng."));
          return;
        }

        passwordAttempts.success(key);
        const token = createUnlockToken(alias, storedHash);
        send(request, response, 303, "text/plain; charset=utf-8", "", {
          Location: `/${encodeURIComponent(alias)}`,
          "Set-Cookie": unlockCookie(token, isSecureRequest(request)),
        });
        return;
      }
      if (request.method === "POST") {
        send(request, response, 303, "text/plain; charset=utf-8", "", {
          Location: `/${encodeURIComponent(alias)}`,
        });
        return;
      }
      html(request, response, 200, renderNote(state.note));
    } catch (error) {
      logError(error);
      html(request, response, 503, renderState("Tạm gián đoạn", "Chưa thể mở ghi chú", "Vui lòng thử lại sau ít phút."));
    }
  };
}

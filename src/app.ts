import type { IncomingMessage, ServerResponse } from "node:http";

import {
  clearSessionCookie,
  createSessionToken,
  csrfMatches,
  readCookie,
  readSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookie,
  type Session,
} from "./auth.js";
import { editorScript } from "./editor.js";
import { publicNoteState } from "./note.js";
import type { LegacyUser, NoteRepository } from "./note-repository.js";
import {
  createUnlockToken,
  isUnlockTokenValid,
  PasswordAttemptLimiter,
  readUnlockCookie,
  unlockCookie,
  verifyLegacyPassword,
} from "./password.js";
import { passwordVisibilityScript } from "./password-visibility.js";
import {
  renderEditor,
  renderLogin,
  renderNote,
  renderNotes,
  renderPasswordForm,
  renderState,
  sanitizeNoteContent,
} from "./render.js";
import { stylesheet } from "./styles.js";

const ALIAS = /^[A-Za-z0-9_-]{1,255}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVE_USER_STATUS = "active";
const MAX_NOTE_BYTES = 65_535;
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

type Logger = (error: unknown) => void;
type HandlerOptions = { sessionSecret: string; logError?: Logger };
type Authenticated = { session: Session; user: LegacyUser };

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

function html(request: IncomingMessage, response: ServerResponse, status: number, body: string) {
  send(request, response, status, "text/html; charset=utf-8", body);
}

function redirect(request: IncomingMessage, response: ServerResponse, location: string, headers: Record<string, string> = {}) {
  send(request, response, 303, "text/plain; charset=utf-8", "", { Location: location, ...headers });
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

function editNoteId(pathname: string) {
  const match = /^\/notes\/(\d+)\/edit$/.exec(pathname);
  if (!match?.[1]) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function methodNotAllowed(request: IncomingMessage, response: ServerResponse) {
  send(request, response, 405, "text/plain; charset=utf-8", "Method Not Allowed", { Allow: "GET, HEAD, POST" });
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clientAddress(request: IncomingMessage) {
  return firstHeader(request.headers["cf-connecting-ip"])
    ?? firstHeader(request.headers["x-forwarded-for"])?.split(",")[0]?.trim()
    ?? request.socket.remoteAddress
    ?? "unknown";
}

function isSecureRequest(request: IncomingMessage) {
  return firstHeader(request.headers["x-forwarded-proto"])?.split(",")[0]?.trim() === "https"
    || ("encrypted" in request.socket && request.socket.encrypted === true);
}

async function readForm(request: IncomingMessage, maximumBytes: number) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/x-www-form-urlencoded")) return null;
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    length += buffer.length;
    if (length > maximumBytes) throw new Error("FORM_TOO_LARGE");
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

async function authenticate(request: IncomingMessage, repository: NoteRepository, secret: string): Promise<Authenticated | null> {
  const token = readCookie(firstHeader(request.headers.cookie), SESSION_COOKIE_NAME);
  const session = readSessionToken(token, secret);
  if (!session) return null;
  const user = await repository.findUserById(session.userId);
  if (!user || user.status.trim() !== ACTIVE_USER_STATUS) return null;
  return { session, user };
}

export function createRequestHandler(repository: NoteRepository, options: HandlerOptions) {
  if (options.sessionSecret.length < 32) throw new Error("sessionSecret must contain at least 32 characters");
  const logError = options.logError ?? console.error;
  const passwordAttempts = new PasswordAttemptLimiter();
  const loginAttempts = new PasswordAttemptLimiter();

  return async function handler(request: IncomingMessage, response: ServerResponse) {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
      methodNotAllowed(request, response);
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/styles.css" || url.pathname === "/editor.js" || url.pathname === "/password-visibility.js") {
      if (request.method === "POST") return methodNotAllowed(request, response);
      const isScript = url.pathname === "/editor.js";
      const isPasswordScript = url.pathname === "/password-visibility.js";
      const body = isScript ? editorScript : isPasswordScript ? passwordVisibilityScript : stylesheet;
      send(request, response, 200, isScript || isPasswordScript ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8", body, {
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

    try {
      if (url.pathname === "/login") {
        const current = await authenticate(request, repository, options.sessionSecret);
        if (current) return redirect(request, response, "/notes");
        if (request.method !== "POST") {
          html(request, response, 200, renderLogin());
          return;
        }
        let form: URLSearchParams | null;
        try { form = await readForm(request, 8192); } catch {
          html(request, response, 413, renderLogin("Dữ liệu gửi lên quá lớn."));
          return;
        }
        const email = form?.get("email")?.trim().toLowerCase() ?? "";
        const password = form?.get("password") ?? "";
        if (!EMAIL.test(email) || password.length < 1 || password.length > 1024) {
          html(request, response, 400, renderLogin("Vui lòng nhập email và mật khẩu hợp lệ.", email));
          return;
        }
        const key = `${clientAddress(request)}:${email}`;
        const retryAfter = loginAttempts.retryAfter(key);
        if (retryAfter > 0) {
          send(request, response, 429, "text/html; charset=utf-8", renderLogin("Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại.", email), { "Retry-After": String(retryAfter) });
          return;
        }
        const user = await repository.findUserByEmail(email);
        if (!user || user.status.trim() !== ACTIVE_USER_STATUS || !(await verifyLegacyPassword(password, user.password))) {
          loginAttempts.failure(key);
          html(request, response, 401, renderLogin("Email hoặc mật khẩu không đúng.", email));
          return;
        }
        loginAttempts.success(key);
        const token = createSessionToken(user.id, options.sessionSecret);
        redirect(request, response, "/notes", { "Set-Cookie": sessionCookie(token, isSecureRequest(request)) });
        return;
      }

      if (url.pathname === "/logout") {
        if (request.method !== "POST") return methodNotAllowed(request, response);
        const auth = await authenticate(request, repository, options.sessionSecret);
        let form: URLSearchParams | null = null;
        try { form = await readForm(request, 4096); } catch { /* clear an invalid session below */ }
        if (auth && !csrfMatches(auth.session.csrf, form?.get("csrf") ?? null)) {
          html(request, response, 403, renderState("403", "Yêu cầu không hợp lệ", "Vui lòng tải lại trang và thử lại."));
          return;
        }
        redirect(request, response, "/login", { "Set-Cookie": clearSessionCookie(isSecureRequest(request)) });
        return;
      }

      if (url.pathname === "/notes") {
        if (request.method === "POST") return methodNotAllowed(request, response);
        const auth = await authenticate(request, repository, options.sessionSecret);
        if (!auth) return redirect(request, response, "/login");
        const notes = await repository.listByUserId(auth.user.id);
        html(request, response, 200, renderNotes(auth.user, notes, auth.session.csrf, url.searchParams.get("updated") === "1"));
        return;
      }

      const ownedNoteId = editNoteId(url.pathname);
      if (ownedNoteId !== null) {
        const auth = await authenticate(request, repository, options.sessionSecret);
        if (!auth) return redirect(request, response, "/login");
        const note = await repository.findOwnedById(ownedNoteId, auth.user.id);
        if (!note) {
          html(request, response, 404, renderState("404", "Không tìm thấy ghi chú", "Ghi chú không tồn tại hoặc không thuộc tài khoản này."));
          return;
        }
        if (request.method !== "POST") {
          html(request, response, 200, renderEditor(auth.user, note, auth.session.csrf));
          return;
        }
        let form: URLSearchParams | null;
        try { form = await readForm(request, 160_000); } catch {
          html(request, response, 413, renderEditor(auth.user, note, auth.session.csrf, "Nội dung gửi lên quá lớn."));
          return;
        }
        const title = form?.get("title")?.trim() ?? "";
        const content = sanitizeNoteContent(form?.get("content") ?? "");
        if (!csrfMatches(auth.session.csrf, form?.get("csrf") ?? null)) {
          html(request, response, 403, renderEditor(auth.user, note, auth.session.csrf, "Phiên làm việc không hợp lệ. Vui lòng tải lại trang.", { title, content }));
          return;
        }
        const plainText = sanitizeNoteContent(content).replace(/<[^>]*>/g, "").replaceAll("&nbsp;", " ").trim();
        if (title.length > 255 || Buffer.byteLength(content, "utf8") > MAX_NOTE_BYTES || plainText === "") {
          html(request, response, 400, renderEditor(auth.user, note, auth.session.csrf, "Tiêu đề hoặc nội dung không hợp lệ. Nội dung không được để trống và phải nhỏ hơn 64 KB.", { title, content }));
          return;
        }
        const updated = await repository.updateOwned(note.id, auth.user.id, title || null, content);
        if (!updated) {
          html(request, response, 404, renderState("404", "Không tìm thấy ghi chú", "Ghi chú không còn tồn tại hoặc không thuộc tài khoản này."));
          return;
        }
        redirect(request, response, "/notes?updated=1");
        return;
      }

      const alias = pathAlias(url.pathname);
      if (!alias) {
        html(request, response, 404, renderState("404", "Không tìm thấy ghi chú", "Đường dẫn này không tồn tại."));
        return;
      }

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
          html(request, response, 200, isUnlockTokenValid(token, alias, storedHash) ? renderNote(state.note) : renderPasswordForm(state.note));
          return;
        }
        const key = `${clientAddress(request)}:${alias.toLowerCase()}`;
        const retryAfter = passwordAttempts.retryAfter(key);
        if (retryAfter > 0) {
          send(request, response, 429, "text/html; charset=utf-8", renderPasswordForm(state.note, "Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại."), { "Retry-After": String(retryAfter) });
          return;
        }
        let form: URLSearchParams | null;
        try { form = await readForm(request, 4096); } catch {
          html(request, response, 413, renderPasswordForm(state.note, "Dữ liệu gửi lên quá lớn."));
          return;
        }
        const candidate = form?.get("password");
        if (!candidate || candidate.length > 1024) {
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
        redirect(request, response, `/${encodeURIComponent(alias)}`, { "Set-Cookie": unlockCookie(token, isSecureRequest(request)) });
        return;
      }
      if (request.method === "POST") return redirect(request, response, `/${encodeURIComponent(alias)}`);
      html(request, response, 200, renderNote(state.note));
    } catch (error) {
      logError(error);
      html(request, response, 503, renderState("Tạm gián đoạn", "Chưa thể xử lý yêu cầu", "Vui lòng thử lại sau ít phút."));
    }
  };
}

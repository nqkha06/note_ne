import type { IncomingMessage, ServerResponse } from "node:http";

import { publicNoteState } from "./note.js";
import type { NoteRepository } from "./note-repository.js";
import { renderNote, renderState } from "./render.js";
import { stylesheet } from "./styles.js";

const ALIAS = /^[A-Za-z0-9_-]{1,255}$/;
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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

export function createRequestHandler(repository: NoteRepository, logError: Logger = console.error) {
  return async function handler(request: IncomingMessage, response: ServerResponse) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      send(request, response, 405, "text/plain; charset=utf-8", "Method Not Allowed", {
        Allow: "GET, HEAD",
      });
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/styles.css") {
      send(request, response, 200, "text/css; charset=utf-8", stylesheet, {
        "Cache-Control": "public, max-age=86400",
      });
      return;
    }
    if (url.pathname === "/health/live") {
      send(request, response, 200, "application/json; charset=utf-8", '{"status":"ok"}');
      return;
    }
    if (url.pathname === "/health/ready") {
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
      if (state.kind === "protected") {
        html(request, response, 403, renderState("Được bảo vệ", "Ghi chú riêng tư", "Ghi chú này được bảo vệ bằng mật khẩu và không thể hiển thị công khai."));
        return;
      }
      if (state.kind === "unavailable") {
        html(request, response, 410, renderState("Không còn khả dụng", "Ghi chú đã đóng", "Nội dung này đã hết hạn hoặc không còn được chia sẻ."));
        return;
      }
      html(request, response, 200, renderNote(state.note));
    } catch (error) {
      logError(error);
      html(request, response, 503, renderState("Tạm gián đoạn", "Chưa thể mở ghi chú", "Vui lòng thử lại sau ít phút."));
    }
  };
}

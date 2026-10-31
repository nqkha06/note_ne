import sanitizeHtml from "sanitize-html";

import type { LegacyNote } from "./note.js";
import type { LegacyUser, OwnedNote, OwnedNoteSummary } from "./note-repository.js";

const ASSET_VERSION = "20261031-1";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const NOTE_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "article",
    "aside",
    "blockquote",
    "br",
    "code",
    "del",
    "div",
    "em",
    "figcaption",
    "figure",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "section",
    "span",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "rel", "target", "title"],
    li: ["value"],
    ol: ["reversed", "start", "type"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: "a",
      attribs: {
        ...attribs,
        rel: "nofollow noopener noreferrer",
      },
    }),
  },
};

export function sanitizeNoteContent(content: string) {
  return sanitizeHtml(content, NOTE_HTML_OPTIONS);
}

function document(title: string, main: string, options: { user?: LegacyUser; scripts?: string[] } = {}) {
  const brandHref = options.user ? "/notes" : "/login";
  const account = options.user
    ? `<nav class="account-nav" aria-label="Tài khoản">
        <a href="/notes">Ghi chú của tôi</a>
        <span class="account-name">${escapeHtml(options.user.name)}</span>
      </nav>`
    : "";
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/styles.css?v=${ASSET_VERSION}">
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="${brandHref}"><span class="brand-mark" aria-hidden="true">L</span>Link4Sub</a>
      ${account}
    </div>
  </header>
  <main class="page">${main}</main>
  ${(options.scripts ?? []).map((script) => `<script src="${escapeHtml(script)}?v=${ASSET_VERSION}" defer></script>`).join("\n  ")}
</body>
</html>`;
}

function hiddenCsrf(csrf: string) {
  return `<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">`;
}

function passwordToggle() {
  return `<button class="password-toggle" type="button" data-password-toggle aria-label="Hiện mật khẩu" aria-pressed="false">
    <svg data-eye-open viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6S2.25 12 2.25 12Z"></path>
      <circle cx="12" cy="12" r="2.75"></circle>
    </svg>
    <svg data-eye-off viewBox="0 0 24 24" aria-hidden="true" focusable="false" hidden>
      <path d="m3 3 18 18"></path>
      <path d="M10.6 6.15A10.8 10.8 0 0 1 12 6c6.25 0 9.75 6 9.75 6a17.6 17.6 0 0 1-2.35 3.05M6.2 6.2C3.65 8 2.25 12 2.25 12S5.75 18 12 18c1.35 0 2.57-.28 3.65-.72"></path>
      <path d="M9.8 9.8A3.1 3.1 0 0 0 14.2 14.2"></path>
    </svg>
  </button>`;
}

function formatDate(value: Date | string | null) {
  if (!value) return "Chưa cập nhật";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function noteStatus(note: OwnedNoteSummary) {
  if (note.isExpired) return "Đã hết hạn";
  return new Set(["active", "1"]).has(note.status.trim()) ? "Đang hiển thị" : "Đã tắt";
}

export function renderNote(note: LegacyNote) {
  const title = note.title?.trim() || `Ghi chú ${note.alias}`;
  return document(
    title,
    `<article class="note">
      <div class="note-inner">
        <h1>${escapeHtml(title)}</h1>
        <div class="note-body">${sanitizeNoteContent(note.content)}</div>
      </div>
    </article>`,
  );
}

export function renderPasswordForm(note: LegacyNote, error?: string) {
  const title = note.title?.trim() || `Ghi chú ${note.alias}`;
  return document(
    title,
    `<section class="unlock">
      <p class="state-code">Được bảo vệ</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="unlock-description">Nhập mật khẩu để mở ghi chú này.</p>
      <form class="unlock-form" method="post" action="/${encodeURIComponent(note.alias)}">
        <label for="password">Mật khẩu</label>
        <div class="password-field" data-password-wrapper>
          <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
          ${passwordToggle()}
        </div>
        ${error ? `<p class="unlock-error" role="alert">${escapeHtml(error)}</p>` : ""}
        <button type="submit">Mở ghi chú</button>
      </form>
    </section>`,
    { scripts: ["/password-visibility.js"] },
  );
}

export function renderLogin(error?: string, email = "") {
  return document(
    "Đăng nhập — Link4Sub",
    `<section class="auth-card">
      <p class="state-code">Quản lý ghi chú</p>
      <h1>Đăng nhập</h1>
      <p class="form-description">Dùng tài khoản Link4Sub cũ để xem và sửa các ghi chú của bạn.</p>
      <form class="stack-form" method="post" action="/login">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value="${escapeHtml(email)}" autocomplete="username" maxlength="255" required autofocus>
        <label for="password">Mật khẩu</label>
        <div class="password-field" data-password-wrapper>
          <input id="password" name="password" type="password" autocomplete="current-password" maxlength="1024" required>
          ${passwordToggle()}
        </div>
        ${error ? `<p class="form-error" role="alert">${escapeHtml(error)}</p>` : ""}
        <button class="primary-button" type="submit">Đăng nhập</button>
      </form>
    </section>`,
    { scripts: ["/password-visibility.js"] },
  );
}

export function renderNotes(user: LegacyUser, notes: OwnedNoteSummary[], csrf: string, updated: boolean) {
  const items = notes.map((note) => {
    const title = note.title?.trim() || `Ghi chú ${note.alias}`;
    return `<article class="note-row">
      <div class="note-row-main">
        <h2>${escapeHtml(title)}</h2>
        <a class="note-alias" href="/${encodeURIComponent(note.alias)}" target="_blank" rel="noopener noreferrer">/${escapeHtml(note.alias)}</a>
        <p>${escapeHtml(noteStatus(note))} · ${escapeHtml(formatDate(note.updatedAt ?? note.createdAt))}</p>
      </div>
      <a class="secondary-button" href="/notes/${note.id}/edit">Sửa</a>
    </article>`;
  }).join("");

  return document(
    "Ghi chú của tôi — Link4Sub",
    `<section class="dashboard-heading">
      <div><p class="state-code">Tài khoản</p><h1>Ghi chú của tôi</h1></div>
      <form method="post" action="/logout">${hiddenCsrf(csrf)}<button class="text-button" type="submit">Đăng xuất</button></form>
    </section>
    ${updated ? '<p class="success-message" role="status">Đã lưu thay đổi.</p>' : ""}
    <section class="note-list" aria-label="Danh sách ghi chú">
      ${items || '<div class="empty-state"><h2>Chưa có ghi chú</h2><p>Tài khoản này chưa có ghi chú cũ để hiển thị.</p></div>'}
    </section>`,
    { user },
  );
}

export function renderEditor(
  user: LegacyUser,
  note: OwnedNote,
  csrf: string,
  error?: string,
  values: { title: string; content: string } = {
    title: note.title ?? "",
    content: note.content,
  },
) {
  const safeContent = sanitizeNoteContent(values.content);
  return document(
    `Sửa ${note.title?.trim() || note.alias} — Link4Sub`,
    `<section class="editor-heading">
      <div><a class="back-link" href="/notes">← Ghi chú của tôi</a><h1>Sửa ghi chú</h1><p>Alias <a href="/${encodeURIComponent(note.alias)}" target="_blank" rel="noopener noreferrer">/${escapeHtml(note.alias)}</a> không thể thay đổi.</p></div>
    </section>
    <form class="editor-form" method="post" action="/notes/${note.id}/edit">
      ${hiddenCsrf(csrf)}
      <label for="title">Tiêu đề</label>
      <input id="title" name="title" type="text" value="${escapeHtml(values.title)}" maxlength="255">
      <label for="content-editor">Nội dung</label>
      <div class="editor-shell">
        <div class="editor-toolbar" role="toolbar" aria-label="Định dạng nội dung">
          <select data-block aria-label="Kiểu đoạn văn">
            <option value="p">Đoạn văn</option>
            <option value="h2">Tiêu đề 2</option>
            <option value="h3">Tiêu đề 3</option>
            <option value="blockquote">Trích dẫn</option>
            <option value="pre">Mã nguồn</option>
          </select>
          <button type="button" data-command="bold" aria-label="In đậm"><strong>B</strong></button>
          <button type="button" data-command="italic" aria-label="In nghiêng"><em>I</em></button>
          <button type="button" data-command="underline" aria-label="Gạch chân"><u>U</u></button>
          <button type="button" data-command="insertUnorderedList" aria-label="Danh sách dấu chấm">• Danh sách</button>
          <button type="button" data-command="insertOrderedList" aria-label="Danh sách số">1. Danh sách</button>
          <button type="button" data-command="createLink" aria-label="Chèn liên kết">Liên kết</button>
          <button type="button" data-command="removeFormat" aria-label="Xóa định dạng">Xóa định dạng</button>
        </div>
        <div id="content-editor" class="rich-editor note-body" contenteditable="true" data-editor role="textbox" aria-multiline="true">${safeContent}</div>
      </div>
      <textarea class="visually-hidden" name="content" data-editor-input aria-hidden="true" tabindex="-1">${escapeHtml(safeContent)}</textarea>
      ${error ? `<p class="form-error" role="alert">${escapeHtml(error)}</p>` : ""}
      <div class="editor-actions"><a class="secondary-button" href="/notes">Hủy</a><button class="primary-button" type="submit">Lưu thay đổi</button></div>
    </form>`,
    { user, scripts: ["/editor.js"] },
  );
}

export function renderState(
  code: string,
  title: string,
  description: string,
) {
  return document(
    title,
    `<section class="state">
      <p class="state-code">${escapeHtml(code)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>`,
  );
}

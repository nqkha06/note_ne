import sanitizeHtml from "sanitize-html";

import type { LegacyNote } from "./note.js";

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

function document(title: string, main: string) {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <span class="brand"><span class="brand-mark" aria-hidden="true">L</span>Link4Sub</span>
    </div>
  </header>
  <main class="page">${main}</main>
</body>
</html>`;
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
        <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
        ${error ? `<p class="unlock-error" role="alert">${escapeHtml(error)}</p>` : ""}
        <button type="submit">Mở ghi chú</button>
      </form>
    </section>`,
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

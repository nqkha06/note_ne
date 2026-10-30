import type { LegacyNote } from "./note.js";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
      <span class="brand"><span class="brand-mark" aria-hidden="true">N</span>STU Note</span>
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
        <div class="note-body">${escapeHtml(note.content)}</div>
      </div>
    </article>`,
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

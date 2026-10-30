export const stylesheet = String.raw`
:root {
  color-scheme: only light;
  --background: #ffffff;
  --foreground: #17181b;
  --card: #ffffff;
  --card-border: #e5e7eb;
  --muted: #686d76;
  --border: #e1e3e7;
  --brand: #2563eb;
}

* { box-sizing: border-box; }

html { min-height: 100%; background: var(--background); }

body {
  min-height: 100vh;
  margin: 0;
  color: var(--foreground);
  background: var(--background);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.site-header {
  height: 64px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.header-inner,
.page {
  width: min(100% - 32px, 800px);
  margin-inline: auto;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--foreground);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-decoration: none;
}

.brand-mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--brand);
  color: white;
  font-size: 15px;
}

.page { padding-block: clamp(32px, 7vw, 72px); }

.note {
  position: relative;
  overflow: hidden;
  min-height: 320px;
  padding: clamp(28px, 6vw, 52px);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  background-color: var(--card);
  box-shadow: 0 10px 30px rgba(24, 28, 36, 0.05);
}

.note-inner { position: relative; }

h1 {
  margin: 0 0 28px;
  font-size: clamp(26px, 5vw, 38px);
  line-height: 1.15;
  letter-spacing: -0.035em;
}

.note-body {
  overflow-wrap: anywhere;
  font-size: clamp(16px, 2.4vw, 18px);
  line-height: 1.7;
  white-space: pre-wrap;
}

.note-body > :first-child { margin-top: 0; }
.note-body > :last-child { margin-bottom: 0; }
.note-body p, .note-body ul, .note-body ol, .note-body blockquote, .note-body pre, .note-body table { margin-block: 1em; }
.note-body a { color: var(--brand); text-underline-offset: 3px; }
.note-body blockquote { margin-inline: 0; padding-left: 18px; border-left: 3px solid var(--border); color: var(--muted); }
.note-body pre { overflow-x: auto; padding: 16px; border-radius: 8px; background: #f3f4f6; }
.note-body code { padding: 0.15em 0.35em; border-radius: 4px; background: #f3f4f6; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
.note-body pre code { padding: 0; background: transparent; }
.note-body table { width: 100%; border-collapse: collapse; }
.note-body th, .note-body td { padding: 10px 12px; border: 1px solid var(--border); text-align: left; }
.note-body hr { margin-block: 28px; border: 0; border-top: 1px solid var(--border); }
.note-body h1, .note-body h2, .note-body h3, .note-body h4, .note-body h5, .note-body h6 {
  margin: 1.4em 0 0.55em;
  line-height: 1.25;
}

.state {
  max-width: 560px;
  margin: 12vh auto 0;
  text-align: center;
}

.state-code {
  margin: 0 0 12px;
  color: var(--brand);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.state h1 { margin-bottom: 12px; }
.state p { margin: 0; color: var(--muted); line-height: 1.6; }

.unlock {
  width: min(100%, 460px);
  margin: 8vh auto 0;
  padding: clamp(28px, 6vw, 44px);
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(24, 28, 36, 0.05);
}

.unlock h1 { margin-bottom: 10px; }
.unlock-description { margin: 0 0 26px; color: var(--muted); line-height: 1.6; }
.unlock-form { display: grid; gap: 10px; }
.unlock-form label { font-size: 14px; font-weight: 600; }
.unlock-form input {
  width: 100%;
  height: 44px;
  padding: 0 13px;
  border: 1px solid #cfd2d8;
  border-radius: 8px;
  background: #ffffff;
  color: var(--foreground);
  font: inherit;
  outline: none;
}
.unlock-form input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14); }
.unlock-form button {
  height: 44px;
  margin-top: 6px;
  border: 0;
  border-radius: 8px;
  background: var(--brand);
  color: #ffffff;
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}
.unlock-form button:hover { background: #1d4ed8; }
.unlock-error { margin: 2px 0 0; color: #b42318; font-size: 14px; }

@media (max-width: 520px) {
  .header-inner, .page { width: min(100% - 24px, 800px); }
  .note { border-radius: 12px; }
}
`;

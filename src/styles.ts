export const stylesheet = String.raw`
:root {
  color-scheme: light dark;
  --background: #f7f8fa;
  --foreground: #17181b;
  --card: #fffdf0;
  --card-border: #e5dfb4;
  --muted: #686d76;
  --border: #e1e3e7;
  --brand: #6366d9;
  --line: rgba(93, 84, 30, 0.10);
  --margin-line: rgba(197, 59, 71, 0.24);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #09090b;
    --foreground: #f5f6f7;
    --card: #1c1b14;
    --card-border: #3b3823;
    --muted: #aeb2ba;
    --border: #26282d;
    --brand: #8588f0;
    --line: rgba(242, 233, 173, 0.08);
    --margin-line: rgba(225, 91, 101, 0.30);
  }
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
  background-image: repeating-linear-gradient(
    transparent 0,
    transparent 31px,
    var(--line) 32px
  );
  box-shadow: 0 12px 32px rgba(24, 28, 36, 0.06);
}

.note::before {
  content: "";
  position: absolute;
  inset-block: 0;
  left: clamp(28px, 6vw, 52px);
  width: 2px;
  background: var(--margin-line);
}

.note-inner { position: relative; padding-left: clamp(20px, 4vw, 36px); }

h1 {
  margin: 0 0 28px;
  font-size: clamp(26px, 5vw, 38px);
  line-height: 1.15;
  letter-spacing: -0.035em;
}

.note-body {
  overflow-wrap: anywhere;
  font-size: clamp(16px, 2.4vw, 18px);
  line-height: 32px;
  white-space: pre-wrap;
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

@media (max-width: 520px) {
  .header-inner, .page { width: min(100% - 24px, 800px); }
  .note { border-radius: 12px; }
}
`;

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import { hashSync as hashBcrypt } from "bcryptjs";

import { createRequestHandler } from "./app.js";
import type { LegacyNote } from "./note.js";
import type { LegacyUser, NoteRepository, OwnedNote } from "./note-repository.js";

const sessionSecret = "test-session-secret-with-at-least-32-characters";
const user: LegacyUser = {
  id: 7,
  name: "Người dùng thử",
  email: "owner@example.com",
  password: hashBcrypt("account-password", 4).replace(/^\$2b\$/, "$2y$"),
  status: "active",
};
const ownedNotes = new Map<number, OwnedNote>([[12, {
  id: 12,
  alias: "public-note",
  title: "Ghi chú công khai",
  content: "Nội dung",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  isExpired: false,
}]]);

const notes = new Map<string, LegacyNote>([
  ["public-note", {
    alias: "public-note",
    title: "Ghi chú công khai",
    content: "Nội dung",
    password: null,
    status: "active",
    isDeleted: false,
    isExpired: false,
  }],
  ["locked-note", {
    alias: "locked-note",
    title: "Riêng tư",
    content: "Không được lộ",
    password: hashBcrypt("open-sesame", 4).replace(/^\$2b\$/, "$2y$"),
    status: "active",
    isDeleted: false,
    isExpired: false,
  }],
  ["expired-note", {
    alias: "expired-note",
    title: "Cũ",
    content: "Nội dung cũ",
    password: null,
    status: "active",
    isDeleted: false,
    isExpired: true,
  }],
]);

describe("HTTP app", () => {
  let origin = "";
  const repository: NoteRepository = {
    async findByAlias(alias) { return notes.get(alias) ?? null; },
    async findUserByEmail(email) { return email.toLowerCase() === user.email ? user : null; },
    async findUserById(id) { return id === user.id ? user : null; },
    async listByUserId(userId) { return userId === user.id ? [...ownedNotes.values()] : []; },
    async findOwnedById(id, userId) { return userId === user.id ? ownedNotes.get(id) ?? null : null; },
    async updateOwned(id, userId, title, content) {
      const note = userId === user.id ? ownedNotes.get(id) : undefined;
      if (!note) return false;
      note.title = title;
      note.content = content;
      return true;
    },
    async ping() {},
    async close() {},
  };
  const server = createServer(createRequestHandler(repository, { sessionSecret, logError: () => {} }));

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("shows an active public note without analytics or redirect", async () => {
    const response = await fetch(`${origin}/public-note?from=share`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Ghi chú công khai/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });

  it("shows an unlock form without exposing password-protected content", async () => {
    const response = await fetch(`${origin}/locked-note`);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /name="password"/);
    assert.match(body, /data-password-toggle/);
    assert.match(body, /data-eye-open/);
    assert.doesNotMatch(body, /Không được lộ/);
  });

  it("serves the password visibility control on the login form", async () => {
    const response = await fetch(`${origin}/login`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /data-password-toggle/);
    assert.match(body, /data-eye-off/);
    assert.match(body, /\/password-visibility\.js/);
    const script = await fetch(`${origin}/password-visibility.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type") ?? "", /text\/javascript/);
  });

  it("rejects a wrong password and unlocks with a signed cookie after a correct one", async () => {
    const wrong = await fetch(`${origin}/locked-note`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "wrong" }),
      redirect: "manual",
    });
    assert.equal(wrong.status, 401);
    assert.match(await wrong.text(), /Mật khẩu không đúng/);

    const correct = await fetch(`${origin}/locked-note`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Forwarded-Proto": "https",
      },
      body: new URLSearchParams({ password: "open-sesame" }),
      redirect: "manual",
    });
    assert.equal(correct.status, 303);
    assert.equal(correct.headers.get("location"), "/locked-note");
    const setCookie = correct.headers.get("set-cookie");
    assert.match(setCookie ?? "", /HttpOnly/);
    assert.match(setCookie ?? "", /Secure/);

    const unlocked = await fetch(`${origin}/locked-note`, {
      headers: { Cookie: setCookie?.split(";", 1)[0] ?? "" },
    });
    assert.equal(unlocked.status, 200);
    assert.match(await unlocked.text(), /Không được lộ/);
  });

  it("distinguishes unavailable and missing notes", async () => {
    assert.equal((await fetch(`${origin}/expired-note`)).status, 410);
    assert.equal((await fetch(`${origin}/missing-note`)).status, 404);
  });

  it("exposes liveness and database readiness endpoints", async () => {
    assert.equal((await fetch(`${origin}/health/live`)).status, 200);
    assert.equal((await fetch(`${origin}/health/ready`)).status, 200);
  });

  it("requires login, lists only owned notes, and does not expose a create action", async () => {
    const anonymous = await fetch(`${origin}/notes`, { redirect: "manual" });
    assert.equal(anonymous.status, 303);
    assert.equal(anonymous.headers.get("location"), "/login");

    const login = await fetch(`${origin}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: user.email, password: "account-password" }),
      redirect: "manual",
    });
    assert.equal(login.status, 303);
    const cookie = login.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    assert.match(cookie, /stu_note_session=/);

    const list = await fetch(`${origin}/notes`, { headers: { Cookie: cookie } });
    const body = await list.text();
    assert.equal(list.status, 200);
    assert.match(body, /Ghi chú công khai/);
    assert.match(body, /\/notes\/12\/edit/);
    assert.doesNotMatch(body, /Tạo ghi chú/);
    assert.equal((await fetch(`${origin}/notes`, { method: "POST", headers: { Cookie: cookie } })).status, 405);
  });

  it("edits an owned note through the HTML editor and sanitizes content", async () => {
    const login = await fetch(`${origin}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: user.email, password: "account-password" }),
      redirect: "manual",
    });
    const cookie = login.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const editPage = await fetch(`${origin}/notes/12/edit`, { headers: { Cookie: cookie } });
    const editHtml = await editPage.text();
    assert.equal(editPage.status, 200);
    assert.match(editHtml, /contenteditable="true"/);
    const csrf = /name="csrf" value="([^"]+)"/.exec(editHtml)?.[1];
    assert.ok(csrf);

    const save = await fetch(`${origin}/notes/12/edit`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrf, title: "Tiêu đề mới", content: '<p>Nội dung <strong>mới</strong></p><script>alert(1)</script>' }),
      redirect: "manual",
    });
    assert.equal(save.status, 303);
    assert.equal(save.headers.get("location"), "/notes?updated=1");
    assert.equal(ownedNotes.get(12)?.title, "Tiêu đề mới");
    assert.equal(ownedNotes.get(12)?.content, "<p>Nội dung <strong>mới</strong></p>");
  });

  it("rejects an edit without valid CSRF and hides notes not owned by the user", async () => {
    const login = await fetch(`${origin}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: user.email, password: "account-password" }),
      redirect: "manual",
    });
    const cookie = login.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    assert.equal((await fetch(`${origin}/notes/999/edit`, { headers: { Cookie: cookie } })).status, 404);
    const invalid = await fetch(`${origin}/notes/12/edit`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrf: "invalid", title: "X", content: "Y" }),
    });
    assert.equal(invalid.status, 403);
  });
});

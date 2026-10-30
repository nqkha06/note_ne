import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import { hashSync as hashBcrypt } from "bcryptjs";

import { createRequestHandler } from "./app.js";
import type { LegacyNote } from "./note.js";
import type { NoteRepository } from "./note-repository.js";

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
    async ping() {},
    async close() {},
  };
  const server = createServer(createRequestHandler(repository, () => {}));

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
    assert.doesNotMatch(body, /Không được lộ/);
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
});

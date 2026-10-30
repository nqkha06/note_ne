import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

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
    password: "$2y$hash",
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

  it("does not expose password-protected content", async () => {
    const response = await fetch(`${origin}/locked-note`);
    assert.equal(response.status, 403);
    assert.doesNotMatch(await response.text(), /Không được lộ/);
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

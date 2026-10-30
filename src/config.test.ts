import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig } from "./config.js";

const database = {
  MYSQL_HOST: "legacy-mysql",
  MYSQL_DATABASE: "legacy_stu",
  MYSQL_USER: "note_reader",
};

describe("config", () => {
  it("applies safe server and pool defaults", () => {
    const config = loadConfig(database);
    assert.equal(config.host, "0.0.0.0");
    assert.equal(config.port, 3001);
    assert.equal(config.mysql.port, 3306);
    assert.equal(config.mysql.connectionLimit, 5);
    assert.equal(config.mysql.ssl, false);
  });

  it("rejects missing database config and invalid numeric values", () => {
    assert.throws(() => loadConfig({}), /MYSQL_HOST/);
    assert.throws(() => loadConfig({ ...database, PORT: "0" }), /PORT/);
    assert.throws(() => loadConfig({ ...database, MYSQL_SSL_MODE: "maybe" }), /MYSQL_SSL_MODE/);
  });
});

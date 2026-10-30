import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderNote } from "./render.js";

describe("note renderer", () => {
  it("renders legacy content as text instead of executable HTML", () => {
    const html = renderNote({
      alias: "safe",
      title: "<b>Tiêu đề</b>",
      content: '<script>alert("xss")</script>\nDòng 2',
      password: null,
      status: "active",
      isDeleted: false,
      isExpired: false,
    });
    assert.match(html, /&lt;b&gt;Tiêu đề&lt;\/b&gt;/);
    assert.match(html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/);
  });
});

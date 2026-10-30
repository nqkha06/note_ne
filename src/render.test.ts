import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderNote, sanitizeNoteContent } from "./render.js";

describe("note renderer", () => {
  it("renders safe legacy HTML and removes executable content", () => {
    const html = renderNote({
      alias: "safe",
      title: "<b>Tiêu đề</b>",
      content: '<p><strong>Nội dung</strong></p><script>alert("xss")</script><a href="javascript:alert(1)" onclick="alert(2)">Link</a>',
      password: null,
      status: "active",
      isDeleted: false,
      isExpired: false,
    });
    assert.match(html, /&lt;b&gt;Tiêu đề&lt;\/b&gt;/);
    assert.match(html, /<p><strong>Nội dung<\/strong><\/p>/);
    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /alert\(/);
    assert.doesNotMatch(html, /onclick|javascript:/);
    assert.match(html, /rel="nofollow noopener noreferrer"/);
  });

  it("keeps common note formatting", () => {
    assert.equal(
      sanitizeNoteContent("<h2>Mục</h2><ul><li>Một</li></ul><table><tbody><tr><td>Ô</td></tr></tbody></table>"),
      "<h2>Mục</h2><ul><li>Một</li></ul><table><tbody><tr><td>Ô</td></tr></tbody></table>",
    );
  });
});

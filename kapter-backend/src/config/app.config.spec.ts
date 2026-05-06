import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeConfiguredUrl,
  parseCorsOriginValue,
  parseStringList,
} from "./app.config";

void describe("app config URL normalization", () => {
  void it("normalizes quoted deployment URLs for CORS-sensitive lists", () => {
    assert.deepEqual(
      parseStringList(
        '"https://kapter.sondndev.id.vn/,https://kapter-api.sondndev.id.vn/"',
      ),
      ["https://kapter.sondndev.id.vn", "https://kapter-api.sondndev.id.vn"],
    );
    assert.equal(
      normalizeConfiguredUrl('"https://kapter.sondndev.id.vn/"'),
      "https://kapter.sondndev.id.vn",
    );
  });

  void it("treats a quoted wildcard CORS origin as wildcard", () => {
    assert.equal(parseCorsOriginValue('"*"'), "*");
  });

  void it("preserves already-normalized origin lists", () => {
    assert.deepEqual(parseCorsOriginValue("https://kapter.sondndev.id.vn"), [
      "https://kapter.sondndev.id.vn",
    ]);
    assert.deepEqual(parseStringList("https://kapter.sondndev.id.vn"), [
      "https://kapter.sondndev.id.vn",
    ]);
  });
});

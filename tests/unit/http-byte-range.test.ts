import assert from "node:assert/strict";
import test from "node:test";

import { parseHttpByteRange } from "../../src/lib/http-byte-range";

test("parse les plages utilisées par un lecteur vidéo", () => {
  assert.deepEqual(parseHttpByteRange("bytes=0-1023", 5000), { start: 0, end: 1023 });
  assert.deepEqual(parseHttpByteRange("bytes=1000-", 5000), { start: 1000, end: 4999 });
  assert.deepEqual(parseHttpByteRange("bytes=-500", 5000), { start: 4500, end: 4999 });
  assert.deepEqual(parseHttpByteRange("bytes=0-9999", 5000), { start: 0, end: 4999 });
});

test("rejette les plages invalides", () => {
  assert.equal(parseHttpByteRange("bytes=5000-", 5000), "invalid");
  assert.equal(parseHttpByteRange("bytes=20-10", 5000), "invalid");
  assert.equal(parseHttpByteRange("bytes=0-1,4-5", 5000), "invalid");
  assert.equal(parseHttpByteRange(null, 5000), null);
});

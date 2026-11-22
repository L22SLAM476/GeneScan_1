import test from "node:test";
import assert from "node:assert/strict";
import { analyze, complement, validateFile } from "./index.js";
for (const [b, c] of Object.entries(complement))
  test("complement " + b, () => assert.equal(analyze(b).reverse, c));
test("canonical denominator", () => {
  const r = analyze(">record\r\nag cn");
  assert.deepEqual(
    [r.length, r.gc, r.ambiguous, r.ratio],
    [4, 200 / 3, 1, 0.5],
  );
});
test("undefined ratios", () => {
  assert.equal(analyze("N").gc, null);
  assert.equal(analyze("A").ratio, null);
});
for (const raw of ["", ">", ">a\nAC\n>b\nTT", "A!", "A".repeat(100001), "aß"])
  test("reject " + raw.slice(0, 8), () => assert.throws(() => analyze(raw)));
test("file validation", () => {
  validateFile("example.FA", 200000);
  assert.throws(() => validateFile("example.exe", 1));
  assert.throws(() => validateFile("example.fa", 200001));
});

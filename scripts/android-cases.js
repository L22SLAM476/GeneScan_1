import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import cases, { mobileCases } from "./scenarios.js";

const all = cases.concat(mobileCases);
const group = Number(process.env.APPIUM_GROUP || 0);
assert(Number.isInteger(group) && group >= 0 && group <= 8);
export const androidCases = all.filter(({ id }, index) => {
  // Keep the account and navigation flows together in their original order.
  const assigned = Number(id) > 290 ? 8 : 1 + (index % 7);
  return !group || group === assigned;
});

if (process.argv.includes("--verify")) {
  const records = readFileSync("appium-tests/results.ndjson", "utf8").trim()
    .split("\n").map(line => JSON.parse(line));
  assert.deepEqual(records.map(r => r.id).sort(), androidCases.map(c => c.id).sort());
  assert(records.every(r => r.status === "passed"), "Every scheduled case must pass");
  console.log(records.length + " Android cases executed and passed");
}

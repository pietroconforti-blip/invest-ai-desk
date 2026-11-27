import assert from "node:assert/strict";
import { test } from "node:test";
import { parseResearchJson } from "./research-parse.ts";

test("parses a fenced research object and drops extra prose", () => {
  const parsed = parseResearchJson(`Note:\n\`\`\`json\n{"headline":"A calm line","interpretation":"This is a reading.","facts":["Price is 10"],"risks":["Gap risk"],"bullCase":["If demand holds"],"bearCase":["If demand fades"],"newsRead":"Thin tape.","assumptions":["No filings in the feed"]}\n\`\`\``);
  assert.equal(parsed?.headline, "A calm line");
  assert.deepEqual(parsed?.facts, ["Price is 10"]);
});

test("rejects a payload without a headline", () => {
  assert.equal(parseResearchJson('{"interpretation":"only this"}'), null);
});

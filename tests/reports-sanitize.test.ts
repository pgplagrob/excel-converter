import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeCellText, sanitizeRowText } from "../lib/reports/sanitize";

test("sanitizeCellText prefixes text starting with =, +, -, or @ with an apostrophe", () => {
  assert.equal(sanitizeCellText("=SUM(A1:A10)"), "'=SUM(A1:A10)");
  assert.equal(sanitizeCellText("+1234"), "'+1234");
  assert.equal(sanitizeCellText("-1234"), "'-1234");
  assert.equal(sanitizeCellText("@cmd"), "'@cmd");
});

test("sanitizeCellText leaves ordinary text and empty strings untouched", () => {
  assert.equal(sanitizeCellText("โต๊ะทำงาน"), "โต๊ะทำงาน");
  assert.equal(sanitizeCellText(""), "");
  assert.equal(sanitizeCellText("A001"), "A001");
});

test("sanitizeRowText only touches string fields", () => {
  const row = sanitizeRowText({ assetName: "=cmd|'/c calc'!A1", cost: 100, code: "A001" });
  assert.equal(row.assetName, "'=cmd|'/c calc'!A1");
  assert.equal(row.cost, 100);
  assert.equal(row.code, "A001");
});

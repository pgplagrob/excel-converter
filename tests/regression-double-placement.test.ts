import assert from "node:assert/strict";
import test from "node:test";
import { mappingSuggestionsToRecord, suggestMapping } from "../lib/mapping";
import { transformRowsToTemplateDataset } from "../lib/transform";

// Regression anchor for the suspected Reference double-placement bug
// (traced on assets/.../แบบฟอร์มกรอก.xlsx and โยธา สำนักงานช่าง.xlsx).
//
// A source column "งานที่รับผิดชอบ" is parsed into the normalized field
// `responsibleUnit`, which transform.ts hardcodes into the template column
// "งาน" (lib/transform.ts), while auto-mapping separately fills the template
// column "งานที่รับผิดชอบ". The single source value therefore lands in TWO
// template columns, producing ~15k spurious Reference warnings per sheet.
//
// These tests LOCK the current behavior before any parser/mapping change, so a
// future fix has a safe baseline. Do NOT change the parser/mapping to satisfy
// the skipped target test without approval.

function transformResponsibleWorkRow() {
  const headers = ["ชื่อสินทรัพย์", "รหัสสินทรัพย์", "งานที่รับผิดชอบ"];
  const mapping = mappingSuggestionsToRecord(suggestMapping(headers));
  const sourceRow = {
    __sourceProfile: "FLEXIBLE_ASSET_TABLE", // non-known profile -> fallback mapping
    assetCode: "400-28-0761",
    assetName: "โต๊ะทำงาน",
    responsibleUnit: "หัวหน้างานวิจัย",
    "งานที่รับผิดชอบ": "หัวหน้างานวิจัย",
  };
  return { mapping, row: transformRowsToTemplateDataset([sourceRow], mapping)[0] };
}

test("mapping does not point both งาน and งานที่รับผิดชอบ at the same source column", () => {
  const { mapping } = transformResponsibleWorkRow();
  // The auto-mapping itself is correct: only "งานที่รับผิดชอบ" is mapped.
  assert.equal(mapping["งานที่รับผิดชอบ"], "งานที่รับผิดชอบ");
  assert.equal(mapping["งาน"] || "", "");
});

test("CURRENT BEHAVIOR (bug): responsibleUnit is duplicated into both งาน and งานที่รับผิดชอบ", () => {
  const { row } = transformResponsibleWorkRow();
  // transform.ts copies responsibleUnit -> "งาน", and mapping fills
  // "งานที่รับผิดชอบ" -> the same value appears twice.
  assert.equal(row["งาน"], "หัวหน้างานวิจัย");
  assert.equal(row["งานที่รับผิดชอบ"], "หัวหน้างานวิจัย");
});

test(
  "TARGET BEHAVIOR (enable after parser/mapping fix): value only in งานที่รับผิดชอบ",
  { skip: "documents desired behavior; do not fix parser/mapping without approval" },
  () => {
    const { row } = transformResponsibleWorkRow();
    assert.equal(row["งาน"] || "", "");
    assert.equal(row["งานที่รับผิดชอบ"], "หัวหน้างานวิจัย");
  },
);

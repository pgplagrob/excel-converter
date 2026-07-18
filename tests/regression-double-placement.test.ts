import assert from "node:assert/strict";
import test from "node:test";
import { mappingSuggestionsToRecord, suggestMapping } from "../lib/mapping";
import { transformRowsToTemplateDataset } from "../lib/transform";

// Regression coverage for the Reference double-placement bug (traced on
// assets/.../แบบฟอร์มกรอก.xlsx and โยธา สำนักงานช่าง.xlsx, ~15k spurious
// warnings per sheet).
//
// Root cause: a source column literally named "งานที่รับผิดชอบ" is parsed
// into the normalized field `responsibleUnit`; lib/transform.ts's fallback
// mapper then unconditionally copied that same field into the template
// column "งาน" (line 367, pre-fix), while the ordinary header-based mapping
// loop separately (and correctly) filled the template column "งานที่รับผิดชอบ"
// from the same source cell. One source value landed in two template
// columns. Fixed by lib/transform.ts's resolveResponsibleWorkFallback():
// "งาน" is only backfilled from responsibleUnit when it is still empty AND
// doing so would not repeat a value already placed in "งานที่รับผิดชอบ".
//
// Known positional profiles (NEW_ASSET_2567, REGISTER_3_ROW_HEADER,
// TRANSFER_2567, ASSET_DATA) are untouched by this fix: mapProfileRow never
// auto-fills "งานที่รับผิดชอบ" from source headers at all, so there was never
// a collision to begin with there — see the dedicated test below.

function transformRow(sourceRow: Record<string, unknown>, headers: string[]) {
  const mapping = mappingSuggestionsToRecord(suggestMapping(headers));
  return { mapping, row: transformRowsToTemplateDataset([sourceRow], mapping)[0] };
}

function transformResponsibleWorkRow() {
  const headers = ["ชื่อสินทรัพย์", "รหัสสินทรัพย์", "งานที่รับผิดชอบ"];
  const sourceRow = {
    __sourceProfile: "FLEXIBLE_ASSET_TABLE", // non-known profile -> fallback mapping
    assetCode: "400-28-0761",
    assetName: "โต๊ะทำงาน",
    responsibleUnit: "หัวหน้างานวิจัย",
    "งานที่รับผิดชอบ": "หัวหน้างานวิจัย",
  };
  return transformRow(sourceRow, headers);
}

test("mapping does not point both งาน and งานที่รับผิดชอบ at the same source column", () => {
  const { mapping } = transformResponsibleWorkRow();
  // The auto-mapping itself is correct: only "งานที่รับผิดชอบ" is mapped.
  assert.equal(mapping["งานที่รับผิดชอบ"], "งานที่รับผิดชอบ");
  assert.equal(mapping["งาน"] || "", "");
});

test("only งานที่รับผิดชอบ header present: value lands only in งานที่รับผิดชอบ, not งาน", () => {
  const { row } = transformResponsibleWorkRow();
  assert.equal(row["งาน"] || "", "");
  assert.equal(row["งานที่รับผิดชอบ"], "หัวหน้างานวิจัย");
});

test("only งาน header present: value lands only in งาน, not งานที่รับผิดชอบ", () => {
  const headers = ["ชื่อสินทรัพย์", "รหัสสินทรัพย์", "งาน"];
  const sourceRow = {
    __sourceProfile: "FLEXIBLE_ASSET_TABLE",
    assetCode: "400-28-0762",
    assetName: "เก้าอี้ทำงาน",
    responsibleUnit: "งานบริหารทั่วไป",
    "งาน": "งานบริหารทั่วไป",
  };
  const { row } = transformRow(sourceRow, headers);
  assert.equal(row["งาน"], "งานบริหารทั่วไป");
  assert.equal(row["งานที่รับผิดชอบ"] || "", "");
});

test("both งาน and งานที่รับผิดชอบ headers present with different values: both are preserved distinctly", () => {
  const headers = ["ชื่อสินทรัพย์", "รหัสสินทรัพย์", "งาน", "งานที่รับผิดชอบ"];
  const sourceRow = {
    __sourceProfile: "FLEXIBLE_ASSET_TABLE",
    assetCode: "400-28-0763",
    assetName: "ตู้เอกสาร",
    // The parser's normalized field reflects whichever column it detected as
    // "responsible unit" (here, the same text as the explicit "งาน" header).
    responsibleUnit: "งานบริหารทั่วไป",
    "งาน": "งานบริหารทั่วไป",
    "งานที่รับผิดชอบ": "หัวหน้างานวิจัย",
  };
  const { row } = transformRow(sourceRow, headers);
  assert.equal(row["งาน"], "งานบริหารทั่วไป");
  assert.equal(row["งานที่รับผิดชอบ"], "หัวหน้างานวิจัย");
});

test("manual mapping may still intentionally copy the same source column into both template columns", () => {
  // An explicit user action (manual mapping) is a different thing from the
  // automatic double-placement bug — it must still be possible.
  const headers = ["ชื่อสินทรัพย์", "รหัสสินทรัพย์", "งานที่รับผิดชอบ"];
  const mapping = mappingSuggestionsToRecord(suggestMapping(headers));
  const sourceRow = {
    __sourceProfile: "FLEXIBLE_ASSET_TABLE",
    assetCode: "400-28-0764",
    assetName: "โต๊ะประชุม",
    responsibleUnit: "หัวหน้างานวิจัย",
    "งานที่รับผิดชอบ": "หัวหน้างานวิจัย",
  };
  const manualMapping = { "งาน": "งานที่รับผิดชอบ" };
  const [row] = transformRowsToTemplateDataset([sourceRow], mapping, manualMapping);
  assert.equal(row["งาน"], "หัวหน้างานวิจัย");
  assert.equal(row["งานที่รับผิดชอบ"], "หัวหน้างานวิจัย");
});

test("known positional profiles (e.g. ASSET_DATA) are unaffected: งาน still comes from responsibleUnit", () => {
  // mapProfileRow (used for known profiles) never auto-fills งานที่รับผิดชอบ
  // from a source header at all, so there is no collision to guard against —
  // this pins that its behavior is unchanged by the fallback-mapper fix.
  const headers = ["AssetCode", "ModelName", "AssetTypeName", "PurchaseDate", "Price", "LocationName"];
  const mapping = mappingSuggestionsToRecord(suggestMapping(headers));
  const sourceRow = {
    __sourceProfile: "ASSET_DATA",
    assetCode: "A-001",
    assetName: "เครื่องคอมพิวเตอร์",
    responsibleUnit: "งานเทคโนโลยีสารสนเทศ",
  };
  const [row] = transformRowsToTemplateDataset([sourceRow], mapping);
  assert.equal(row["งาน"], "งานเทคโนโลยีสารสนเทศ");
  assert.equal(row["งานที่รับผิดชอบ"] || "", "");
});

test("headerless/positional layouts still backfill งาน from responsibleUnit (no header row to map from)", () => {
  // No header row at all -> mapping["งาน"] and mapping["งานที่รับผิดชอบ"] are
  // both empty; the fallback must still populate งาน, exactly as the
  // pre-existing "parses supported headerless positional asset layouts" test
  // in converter.test.ts already asserts for real FLEXIBLE_ASSET_TABLE data.
  const sourceRow = {
    __sourceProfile: "FLEXIBLE_ASSET_TABLE",
    assetCode: "400-67-0001",
    assetName: "โต๊ะทำงาน",
    responsibleUnit: "งานพัสดุ",
  };
  const { row } = transformRow(sourceRow, []);
  assert.equal(row["งาน"], "งานพัสดุ");
  assert.equal(row["งานที่รับผิดชอบ"] || "", "");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERNAL,
  SOURCE_ASSET_TYPE_COLUMN,
  SOURCE_EXCEL_ROW_COLUMN,
  SOURCE_ROW_KEY_COLUMN,
  SOURCE_SHEET_NAME_COLUMN,
} from "../lib/datasource";
import { normalizeAssetRow, resolveAcquisitionDateIso, resolveCostSatang } from "../lib/reporting/normalize-asset";

function baseSourceRow(overrides: Record<string, unknown> = {}) {
  return {
    [SOURCE_ROW_KEY_COLUMN]: "row-1",
    [SOURCE_SHEET_NAME_COLUMN]: "Sheet1",
    [SOURCE_EXCEL_ROW_COLUMN]: 5,
    assetCode: "400-01-0001",
    assetName: "โต๊ะทำงาน",
    receivedDate: "01/04/2560", // Buddhist-era dd/mm/yyyy, as parsers commonly emit
    value: "48,000",
    [SOURCE_ASSET_TYPE_COLUMN]: "ครุภัณฑ์สำนักงาน",
    ...overrides,
  };
}

test("adapter preserves provenance (rowKey/sheet/excelRow/sourceFile)", () => {
  const asset = normalizeAssetRow(baseSourceRow(), { sourceFile: "test.xlsx" });
  assert.equal(asset.rowKey, "row-1");
  assert.equal(asset.sourceSheet, "Sheet1");
  assert.equal(asset.sourceExcelRow, 5);
  assert.equal(asset.sourceFile, "test.xlsx");
  assert.equal(asset.assetCode, "400-01-0001");
  assert.equal(asset.assetName, "โต๊ะทำงาน");
});

test("adapter does not pre-resolve assetGroup/usefulLifeCategoryKey (that is category-mapping's job)", () => {
  const asset = normalizeAssetRow(baseSourceRow(), { sourceFile: "test.xlsx" });
  assert.equal(asset.assetGroup, undefined);
  assert.equal(asset.usefulLifeCategoryKey, undefined);
  assert.equal(asset.raw?.sourceCategoryText, "ครุภัณฑ์สำนักงาน");
});

test("Buddhist-era dd/mm/yyyy source date converts to canonical Gregorian ISO", () => {
  assert.equal(resolveAcquisitionDateIso("01/04/2560"), "2017-04-01");
});

test("empty date is MISSING (undefined), garbage date is INVALID (null)", () => {
  assert.equal(resolveAcquisitionDateIso(""), undefined);
  assert.equal(resolveAcquisitionDateIso("not a date"), null);
});

test("cost parses commas and rounds to integer satang", () => {
  assert.equal(resolveCostSatang("48,000"), 4_800_000);
  assert.equal(resolveCostSatang(9000), 900_000);
});

test("empty/dash cost is MISSING (undefined), garbage cost is invalid (NaN)", () => {
  assert.equal(resolveCostSatang(""), undefined);
  assert.equal(resolveCostSatang("-"), undefined);
  assert.ok(Number.isNaN(resolveCostSatang("N/A")));
});

test("adapter surfaces unparseable source values through the domain's own blocking (never dropped silently)", () => {
  const asset = normalizeAssetRow(baseSourceRow({ value: "N/A" }), { sourceFile: "test.xlsx" });
  assert.ok(Number.isNaN(asset.costSatang as number));
});

test("mapping option resolves unit / source useful life / source accumulated depreciation", () => {
  const row = baseSourceRow({
    "หน่วยนับ (source)": "ตัว",
    "อายุ (source)": "8",
    "ค่าเสื่อมยกมา (source)": "9,000",
  });
  const asset = normalizeAssetRow(row, {
    sourceFile: "test.xlsx",
    mapping: {
      "หน่วยนับ": "หน่วยนับ (source)",
      "อายุการใช้งาน": "อายุ (source)",
      "ค่าเสื่อมสะสม ณ ยกมา": "ค่าเสื่อมยกมา (source)",
    },
  });
  assert.equal(asset.unit, "ตัว");
  assert.equal(asset.sourceUsefulLifeYears, 8);
  assert.equal(asset.sourceAccumulatedDepreciationSatang, 900_000);
});

test("without a mapping, unit/source life/source accumulated stay unset", () => {
  const asset = normalizeAssetRow(baseSourceRow(), { sourceFile: "test.xlsx" });
  assert.equal(asset.unit, undefined);
  assert.equal(asset.sourceUsefulLifeYears, null);
  assert.equal(asset.sourceAccumulatedDepreciationSatang, null);
});

test("raw provenance retains the original row plus sourceCategoryText", () => {
  const row = baseSourceRow();
  const asset = normalizeAssetRow(row, { sourceFile: "test.xlsx" });
  assert.equal(asset.raw?.assetCode, row.assetCode);
  assert.equal(asset.raw?.[INTERNAL.value], undefined); // not set in this fixture, but key access should not throw
});

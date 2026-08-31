import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisRecord } from "../lib/analysis-store";
import { buildSheetData } from "../lib/build-sheet-data";
import { INTERNAL, type DataSourceWorkbook } from "../lib/datasource";
import { parseFlexibleAssetSheet } from "../lib/datasource/parsers/flexible";
import type { SheetProfileDebug } from "../lib/datasource/types";
import {
  parseReparseSheetRequest,
  ReparseRequestValidationError,
  validateReparseSheetBounds,
} from "../lib/reparse-request";
import { reparseStoredAnalysisSheet } from "../lib/reparse-sheet";
import type { AssetTemplateMetadata, TemplateReferenceValues } from "../lib/template";

const MATRIX = [
  ["รายงานสินทรัพย์"],
  ["รหัสสินทรัพย์", "ชื่อสินทรัพย์", "วันที่ได้มา", "มูลค่า"],
  ["400-67-0001", "โต๊ะทำงาน", "1/1/2567", 1000],
  ["400-67-0002", "เก้าอี้ทำงาน", "2/1/2567", 2000],
  ["400-67-0003", "ตู้เอกสาร", "3/1/2567", 3000],
];

function emptyReferences(): TemplateReferenceValues {
  return {
    categories: new Set(),
    types: new Set(),
    classes: new Set(),
    units: new Set(),
    buildings: new Set(),
    rooms: new Set(),
    owners: new Set(),
    institutes: new Set(),
    departments: new Set(),
    sections: new Set(),
    responsibleWork: new Set(),
    getByMethods: new Set(),
    statuses: new Set(),
    booleans: new Set(),
    assetReturns: new Set(),
  };
}

test("standard-table forced data bounds override the computed range", () => {
  const bounded = parseFlexibleAssetSheet("Assets", MATRIX, {
    kind: "standard-table",
    confidence: 1,
    headerRowIndex: 1,
    dataStartRowIndex: 3,
    dataEndRowIndex: 4,
  });

  assert.equal(bounded.rowCount, 1);
  assert.equal(bounded.rows[0][INTERNAL.assetCode], "400-67-0002");
  assert.equal(bounded.rows[0].__excelRow, 4);
});

test("standard-table without forced bounds keeps its automatic range", () => {
  const automatic = parseFlexibleAssetSheet("Assets", MATRIX, {
    kind: "standard-table",
    confidence: 0.9,
    headerRowIndex: 1,
  });

  assert.equal(automatic.rowCount, 3);
  assert.deepEqual(
    automatic.rows.map((row) => row[INTERNAL.assetCode]),
    ["400-67-0001", "400-67-0002", "400-67-0003"],
  );
});

test("buildSheetData assembles mapping, summaries, previews, and mapped rows", () => {
  const sheet = parseFlexibleAssetSheet("Assets", MATRIX, {
    kind: "standard-table",
    confidence: 0.9,
    headerRowIndex: 1,
  });
  sheet.eligibility = "exportable";
  sheet.eligibilityReason = "matched flexible standard-table layout";
  const template: AssetTemplateMetadata = { columns: [], references: emptyReferences() };

  const result = buildSheetData(sheet, template, MATRIX);

  assert.equal(result.sheetName, "Assets");
  assert.equal(result.headerRowIndex, 1);
  assert.equal(result.rowCount, 3);
  assert.equal(result.summary.rowCount, 3);
  assert.equal(result.summary.headerRow, 2);
  assert.deepEqual(result.rawPreviewRows, MATRIX);
  assert.equal(result.sampleRows.length, 3);
  assert.equal(result.rows.length, 3);
  assert.equal(result.templateSampleRows?.length, 3);
  assert.ok(result.mapping.some((item) => item.templateColumn === "รหัสสินทรัพย์"));
});

test("reparse request rejects invalid row values and ranges", () => {
  const base = { analysisId: "analysis", sheetName: "Assets", headerRow: 1 };

  for (const headerRow of [0, 1.5]) {
    assert.throws(
      () => parseReparseSheetRequest({ ...base, headerRow }),
      ReparseRequestValidationError,
    );
  }
  assert.throws(
    () => validateReparseSheetBounds({ ...base, headerRow: 6 }, MATRIX.length),
    ReparseRequestValidationError,
  );
  assert.throws(
    () => parseReparseSheetRequest({ ...base, dataStartRow: 1 }),
    ReparseRequestValidationError,
  );
  assert.throws(
    () => validateReparseSheetBounds({ ...base, dataEndRow: 7 }, MATRIX.length),
    ReparseRequestValidationError,
  );
  assert.throws(
    () => validateReparseSheetBounds({ ...base, dataStartRow: 999 }, MATRIX.length),
    ReparseRequestValidationError,
  );
  assert.throws(
    () => parseReparseSheetRequest({ ...base, dataStartRow: 4, dataEndRow: 4 }),
    ReparseRequestValidationError,
  );
});

test("reparsing replaces the stored parsed sheet at the same position", () => {
  const initialSheet = parseFlexibleAssetSheet("Assets", MATRIX, {
    kind: "standard-table",
    confidence: 0.5,
    headerRowIndex: 0,
  });
  const debug: SheetProfileDebug = {
    sheetName: "Assets",
    profile: "unknown",
    headerRowIndex: 0,
    confidence: 0.5,
    reasons: ["initial detection"],
    shouldParse: true,
    legacySourceProfile: "UNKNOWN",
    eligibility: "needsReview",
    decisionReason: "initial parse",
  };
  initialSheet.profileDebug = debug;
  const workbook: DataSourceWorkbook = {
    fileName: "assets.xlsx",
    sheets: [initialSheet],
    preservedSheets: [],
    skippedSheets: [],
    profileDebug: [debug],
  };
  const analysis: AnalysisRecord = {
    id: "analysis",
    createdAt: 1,
    expiresAt: 2,
    dataSource: workbook,
    sourceWorkbookSheets: [{ sheetName: "Assets", matrix: MATRIX, rowMeta: [] }],
  };

  const reparsed = reparseStoredAnalysisSheet(analysis, {
    analysisId: "analysis",
    sheetName: "Assets",
    headerRow: 2,
    dataStartRow: 3,
    dataEndRow: 5,
  });

  assert.equal(reparsed.sheet.headerRowIndex, 1);
  assert.equal(reparsed.sheet.rowCount, 3);
  assert.equal(reparsed.sheet.headers[0], "รหัสสินทรัพย์");
  assert.equal(analysis.dataSource.sheets[0], reparsed.sheet);
  assert.equal(analysis.dataSource.sheets[0].sheetName, "Assets");
  assert.equal(analysis.dataSource.profileDebug[0], reparsed.sheet.profileDebug);
  assert.match(reparsed.sheet.profileDebug?.reasons.at(-1) || "", /manual override/);
  assert.equal(reparsed.sheet.profileDebug?.manuallyPinned, true);
});

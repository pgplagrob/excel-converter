import assert from "node:assert/strict";
import test from "node:test";
import type { SheetData, SheetOverview } from "../lib/client-types";
import { createParsedSheetSelection, selectedSheetCount } from "../lib/sheet-selection";

function parsedSheet(sheetName: string): SheetData {
  return {
    sheetName,
    headerRowIndex: 0,
    summary: {} as SheetData["summary"],
    headers: [],
    rowCount: 1,
    eligibility: "exportable",
    eligibilityReason: "ready",
    confidence: 1,
    rawPreviewRows: [],
    sampleRows: [],
    rows: [],
    mapping: [],
  };
}

function overview(sheetName: string, eligibility: SheetOverview["eligibility"]): SheetOverview {
  return {
    sheetName,
    sourceProfile: "ASSET_DATA",
    detectedProfile: "ASSET_DATA",
    eligibility,
    reason: "test",
    rowCount: 1,
    errorCount: 0,
    warningCount: 0,
    confidence: 1,
  };
}

test("selection only includes sheets that exist in parsed data", () => {
  const selection = createParsedSheetSelection(
    [parsedSheet("Data")],
    [overview("Data", "exportable"), overview("Preserved", "exportable")],
  );

  assert.deepEqual(selection, { Data: true });
  assert.equal(selectedSheetCount(selection), 1);
});

test("non-exportable parsed sheets remain unselected", () => {
  const selection = createParsedSheetSelection(
    [parsedSheet("Needs review")],
    [overview("Needs review", "needsReview")],
  );

  assert.deepEqual(selection, { "Needs review": false });
  assert.equal(selectedSheetCount(selection), 0);
});

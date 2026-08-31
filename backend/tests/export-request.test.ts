import assert from "node:assert/strict";
import test from "node:test";
import {
  ExportRequestValidationError,
  parseExportRequest,
  validateRowFixRanges,
} from "../lib/export-request";
import { TEMPLATE_COLUMNS } from "../lib/mapping";

test("export request parser accepts and normalizes a valid request", () => {
  const parsed = parseExportRequest({
    mode: "validate",
    analysisId: "analysis-1",
    sourceFileName: "source.xlsx",
    sheets: [
      {
        sheetName: "Data",
        headerRow: 2,
        manualMapping: {
          [TEMPLATE_COLUMNS[0]]: "source-column",
          [TEMPLATE_COLUMNS[1]]: null,
        },
        cellOverrides: {
          3: {
            [TEMPLATE_COLUMNS[2]]: "ค่าที่ผู้ใช้แก้",
          },
        },
        excludedRows: [4, 8],
        rows: [{ ignored: true }],
      },
    ],
  });

  assert.equal(parsed.mode, "validate");
  assert.equal(parsed.analysisId, "analysis-1");
  assert.equal(parsed.sheets?.[0].sheetName, "Data");
  assert.deepEqual(parsed.sheets?.[0].manualMapping, {
    [TEMPLATE_COLUMNS[0]]: "source-column",
    [TEMPLATE_COLUMNS[1]]: null,
  });
  assert.equal(parsed.sheets?.[0].rows, undefined);
  assert.deepEqual(parsed.sheets?.[0].cellOverrides, {
    3: { [TEMPLATE_COLUMNS[2]]: "ค่าที่ผู้ใช้แก้" },
  });
  assert.deepEqual(parsed.sheets?.[0].excludedRows, [4, 8]);
});

test("export request parser accepts profile-sourced auto mappings", () => {
  const parsed = parseExportRequest({
    mode: "download",
    analysisId: "analysis-1",
    sheets: [{
      sheetName: "Data",
      autoMapping: [{
        templateColumn: TEMPLATE_COLUMNS[0],
        sourceColumn: "remembered header",
        confidence: "high",
        confidenceScore: 90,
        status: "guessed",
        method: "profile",
      }],
    }],
  });

  assert.equal(parsed.sheets?.[0].autoMapping?.[0].method, "profile");
});

test("export request parser rejects malformed and ambiguous requests", () => {
  for (const value of [
    null,
    { analysisId: "analysis-1", sheets: [] },
    { mode: "invalid", analysisId: "analysis-1", sheets: [{ sheetName: "Data" }] },
    { analysisId: "analysis-1", sheets: [{ sheetName: "Data" }, { sheetName: "data" }] },
    {
      analysisId: "analysis-1",
      sheets: [{ sheetName: "Data", manualMapping: { unknown: "source" } }],
    },
    {
      analysisId: "analysis-1",
      sheets: [{ sheetName: "Data", cellOverrides: { 0: { unknown: "value" } } }],
    },
    {
      analysisId: "analysis-1",
      sheets: [{ sheetName: "Data", cellOverrides: { "-1": { [TEMPLATE_COLUMNS[0]]: "value" } } }],
    },
    {
      analysisId: "analysis-1",
      sheets: [{ sheetName: "Data", cellOverrides: { 0: { [TEMPLATE_COLUMNS[0]]: 123 } } }],
    },
    {
      analysisId: "analysis-1",
      sheets: [{ sheetName: "Data", excludedRows: [1.5] }],
    },
    {
      analysisId: "analysis-1",
      sheets: [{ sheetName: "Data", excludedRows: [50_000] }],
    },
  ]) {
    assert.throws(() => parseExportRequest(value), ExportRequestValidationError);
  }
});

test("row fix range validation rejects indices outside the authoritative sheet", () => {
  assert.throws(
    () => validateRowFixRanges({
      sheetName: "Data",
      cellOverrides: { 2: { [TEMPLATE_COLUMNS[0]]: "value" } },
    }, 2),
    ExportRequestValidationError,
  );
  assert.throws(
    () => validateRowFixRanges({ sheetName: "Data", excludedRows: [3] }, 3),
    ExportRequestValidationError,
  );
});

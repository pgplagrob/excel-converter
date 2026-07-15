import assert from "node:assert/strict";
import test from "node:test";
import { ExportRequestValidationError, parseExportRequest } from "../lib/export-request";
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
  ]) {
    assert.throws(() => parseExportRequest(value), ExportRequestValidationError);
  }
});

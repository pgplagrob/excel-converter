import assert from "node:assert/strict";
import test from "node:test";
import { getAnalysis, saveAnalysis } from "../lib/analysis-store";
import type { DataSourceWorkbook } from "../lib/datasource";

const workbook: DataSourceWorkbook = {
  fileName: "test.xlsx",
  sheets: [],
  preservedSheets: [],
  skippedSheets: [],
  profileDebug: [],
};

test("analysis store evicts the least recently used record at capacity", () => {
  const ids = Array.from({ length: 20 }, () => saveAnalysis(workbook));
  assert.ok(getAnalysis(ids[0]));

  const newestId = saveAnalysis(workbook);

  assert.equal(getAnalysis(ids[1]), null);
  assert.ok(getAnalysis(ids[0]));
  assert.ok(getAnalysis(newestId));
});

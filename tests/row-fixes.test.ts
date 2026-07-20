import assert from "node:assert/strict";
import test from "node:test";
import { TEMPLATE_COLUMNS } from "../lib/mapping";
import { applyRowFixes, enrichFixedRowIssues } from "../lib/row-fixes";
import { validateMappedRows, type ValidationIssue } from "../lib/validate";

test("row fixes apply only the explicit cell override", () => {
  const [firstColumn, secondColumn] = TEMPLATE_COLUMNS;
  const mappedRows = [
    { [firstColumn]: "เดิม A", [secondColumn]: "เดิม B" },
    { [firstColumn]: "อีกแถว", [secondColumn]: "คงเดิม" },
  ];

  const result = applyRowFixes(
    mappedRows,
    [{ sourceId: "source-0" }, { sourceId: "source-1" }],
    { 0: { [firstColumn]: "ผู้ใช้พิมพ์เอง" } },
  );

  assert.equal(result.mappedRows[0][firstColumn], "ผู้ใช้พิมพ์เอง");
  assert.equal(result.mappedRows[0][secondColumn], "เดิม B");
  assert.equal(result.mappedRows[1][firstColumn], "อีกแถว");
  assert.equal(mappedRows[0][firstColumn], "เดิม A");
});

test("row exclusion keeps mapped and source rows index-aligned", () => {
  const column = TEMPLATE_COLUMNS[0];
  const result = applyRowFixes(
    [
      { [column]: "mapped-0" },
      { [column]: "mapped-1" },
      { [column]: "mapped-2" },
    ],
    [
      { sourceId: "source-0" },
      { sourceId: "source-1" },
      { sourceId: "source-2" },
    ],
    {},
    [1],
  );

  assert.deepEqual(result.mappedRows.map((row) => row[column]), ["mapped-0", "mapped-2"]);
  assert.deepEqual(result.sourceRows.map((row) => row.sourceId), ["source-0", "source-2"]);
  assert.deepEqual(result.originalRowIndices, [0, 2]);
});

test("validation sees post-override values and post-exclusion rows", () => {
  const rows = [
    { "รหัสสินทรัพย์": "", "ชื่อสินทรัพย์": "ชื่อสินทรัพย์" },
    { "รหัสสินทรัพย์": "A-001", "ชื่อสินทรัพย์": "โต๊ะ", "วันที่ได้รับ": "not-a-date" },
  ];
  const before = validateMappedRows("Data", rows, [{}, {}]);
  assert.equal(before.some((issue) => issue.rowIndex === 0 && issue.severity === "error"), true);
  assert.equal(before.some((issue) => issue.rowIndex === 1 && issue.column === "วันที่ได้รับ"), true);

  const fixed = applyRowFixes(
    rows,
    [{ sourceId: "leaked-header" }, { sourceId: "asset" }],
    { 1: { "วันที่ได้รับ": "01/01/2024" } },
    [0],
  );
  const after = validateMappedRows("Data", fixed.mappedRows, fixed.sourceRows);

  assert.equal(after.some((issue) => issue.column === "วันที่ได้รับ"), false);
  assert.equal(after.some((issue) => issue.severity === "error"), false);
  assert.equal(fixed.sourceRows[0].sourceId, "asset");
});

test("late row issues carry the post-override current value while sheet issues stay untouched", () => {
  const rows = Array.from({ length: 12 }, (_, rowIndex) => ({
    "รหัสสินทรัพย์": `A-${rowIndex}`,
    "ชื่อสินทรัพย์": `สินทรัพย์ ${rowIndex}`,
    "วันที่ได้รับ": "01/01/2024",
  }));
  const fixed = applyRowFixes(
    rows,
    rows.map((_, rowIndex) => ({ sourceId: rowIndex })),
    { 11: { "วันที่ได้รับ": "ค่ายังไม่ถูกต้อง" } },
    [0],
  );
  const sheetIssue: ValidationIssue = {
    sheetName: "Data",
    rowIndex: -1,
    column: "sheet",
    message: "sheet-level issue",
    severity: "warning",
  };
  const enriched = enrichFixedRowIssues(
    [sheetIssue, ...validateMappedRows("Data", fixed.mappedRows, fixed.sourceRows)],
    fixed,
  );

  const lateRowIssue = enriched.find(
    (issue) => issue.rowIndex === 11 && issue.column === "วันที่ได้รับ",
  );
  assert.equal(lateRowIssue?.currentValue, "ค่ายังไม่ถูกต้อง");
  assert.equal(enriched[0], sheetIssue);
  assert.equal(enriched[0].currentValue, undefined);
});

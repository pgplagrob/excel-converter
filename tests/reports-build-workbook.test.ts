import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildAuditAssumptionsDataset } from "../lib/reports/audit-assumptions-dataset";
import { buildReportWorkbook } from "../lib/reports/build-report-workbook";
import { buildSorThor1Dataset } from "../lib/reports/sor-thor-1-dataset";
import { buildSorThor2Dataset } from "../lib/reports/sor-thor-2-dataset";
import { buildSorThor3Dataset } from "../lib/reports/sor-thor-3-dataset";
import { reconcileWorkbook } from "../lib/reporting/reconcile";
import { evaluateExportGate } from "../lib/reporting/calculate-workbook";
import type { CalculatedRow } from "../lib/reporting/types";
import type { OrganizationMetadata, ReportingPolicy } from "../lib/domain/types";

const org: OrganizationMetadata = {
  organizationName: "เทศบาลนครลำปาง",
  district: "เมืองลำปาง",
  province: "ลำปาง",
  postalCode: "52000",
  contactName: "นาย ก.",
  contactPosition: "นักวิชาการเงินและบัญชี",
  phone: "054-000000",
  fax: "054-000001",
};

const policy: ReportingPolicy = {
  fiscalYearBE: 2561,
  cutoffDateISO: "2018-09-30",
  acquisitionDay15Rule: "count-month",
  usefulLifeSelectionPolicy: "explicit-per-category",
  usefulLifeOverridesByCategory: { EQUIP_OFFICE: { years: 8, rangeMin: 3, rangeMax: 12, source: "manual" } },
  residualBookValueSatang: 100,
  roundingMode: "half-up",
  roundingStage: "final-only",
  classificationVersion: "v1",
  depreciationRuleVersion: "v1",
};

function row(overrides: Partial<CalculatedRow> & { assetNameOverride?: string } = {}): CalculatedRow {
  const { assetNameOverride, ...rest } = overrides;
  return {
    rowKey: overrides.rowKey || `r${Math.random()}`,
    sourceFile: "f.xlsx",
    sourceSheet: "Sheet1",
    sourceExcelRow: 2,
    assetCode: "A001",
    assetName: assetNameOverride || "โต๊ะทำงาน",
    unit: "ตัว",
    sourceCategoryText: "ครุภัณฑ์สำนักงาน",
    categoryMapping: { sourceValue: "ครุภัณฑ์สำนักงาน", normalizedKey: "ครุภัณฑ์สำนักงาน", status: "canonical", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_OFFICE", occurrences: 1 },
    normalized: {
      rowKey: "r",
      sourceFile: "f.xlsx",
      sourceSheet: "Sheet1",
      sourceExcelRow: 2,
      assetCode: "A001",
      assetName: assetNameOverride || "โต๊ะทำงาน",
      assetGroup: "EQUIPMENT",
      usefulLifeCategoryKey: "EQUIP_OFFICE",
      acquisitionDateISO: "2017-04-01",
      costSatang: 4_800_000,
    },
    classification: { rowKey: "r", classification: "SOR_THOR_2", reasonCodes: ["IN_SCOPE_SOR_THOR_2"], explanation: "", evaluatedRules: [], missingFields: [], classificationVersion: "v1" },
    depreciation: {
      rowKey: "r",
      shouldDepreciate: true,
      usefulLifeYearsUsed: 8,
      accumulatedDepreciationSatang: 900_000,
      netBookValueSatang: 3_900_000,
      reasonCodes: ["IN_SCOPE_SOR_THOR_2"],
      explanation: "",
      calculationSteps: [],
      blockingIssues: [],
      depreciationRuleVersion: "v1",
    },
    appliedOverrides: [],
    ...rest,
  };
}

function findCellValue(sheet: ExcelJS.Worksheet, text: string): { row: number; col: number } | null {
  for (let r = 1; r <= sheet.rowCount; r += 1) {
    for (let c = 1; c <= sheet.columnCount; c += 1) {
      const value = sheet.getCell(r, c).value;
      if (typeof value === "string" && value.includes(text)) return { row: r, col: c };
    }
  }
  return null;
}

test("official (non-draft) workbook: form codes, titles, org info, headers, merges present for all three reports", async () => {
  const rows = [row({ rowKey: "r1" })];
  const recon = reconcileWorkbook(rows);
  const gate = evaluateExportGate({ rows, reconciliation: recon, blockingRowKeys: [], unresolvedCategoryValues: [] });
  const audit = buildAuditAssumptionsDataset(policy, org, [], [], [], rows, recon, gate);

  const workbook = buildReportWorkbook({
    sorThor1: buildSorThor1Dataset(recon),
    sorThor2: buildSorThor2Dataset(rows),
    sorThor3: buildSorThor3Dataset(rows),
    audit,
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });

  const sheet1 = workbook.getWorksheet("อปท-สท1")!;
  assert.ok(findCellValue(sheet1, "แบบ อปท. - สท. 1"));
  assert.ok(findCellValue(sheet1, "รายงานแสดงมูลค่ารวมของสินทรัพย์"));
  assert.ok(findCellValue(sheet1, "เทศบาลนครลำปาง"));
  assert.ok(findCellValue(sheet1, "ประเภทสินทรัพย์"));
  assert.ok(findCellValue(sheet1, "รวมมูลค่าสินทรัพย์ทั้งสิ้น"));
  // No draft banner on an official report.
  assert.equal(findCellValue(sheet1, "ฉบับร่าง"), null);

  const sheet2 = workbook.getWorksheet("อปท-สท2")!;
  assert.ok(findCellValue(sheet2, "แบบ อปท. - สท. 2"));
  assert.ok(findCellValue(sheet2, "อายุการใช้งานของสินทรัพย์"));
  assert.ok(findCellValue(sheet2, "รวม (บาท)"));

  const sheet3 = workbook.getWorksheet("อปท-สท3")!;
  assert.ok(findCellValue(sheet3, "แบบ อปท. - สท. 3"));
  assert.ok(findCellValue(sheet3, "10,000 บาท"));

  const auditSheet = workbook.getWorksheet("Audit_Assumptions")!;
  assert.ok(findCellValue(auditSheet, "ได้มาก่อนวันที่ 15 นับเป็น 1 เดือน"));
});

test("draft workbook shows a clearly-marked banner on every report sheet", async () => {
  const rows = [row({ rowKey: "r1" })];
  const recon = reconcileWorkbook(rows);
  const workbook = buildReportWorkbook({
    sorThor1: buildSorThor1Dataset(recon),
    sorThor2: buildSorThor2Dataset(rows),
    sorThor3: buildSorThor3Dataset(rows),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: true,
  });
  for (const name of ["อปท-สท1", "อปท-สท2", "อปท-สท3"]) {
    const sheet = workbook.getWorksheet(name)!;
    assert.ok(findCellValue(sheet, "ฉบับร่าง"), `${name} should show the draft banner`);
    assert.ok(findCellValue(sheet, "ยังไม่พร้อมใช้เป็นรายงานทางการ"));
  }
});

test("สท.1 grand total uses a SUM formula over the 8 group rows, not a hardcoded number", async () => {
  const rows = [row({ rowKey: "r1" })];
  const recon = reconcileWorkbook(rows);
  const workbook = buildReportWorkbook({
    sorThor1: buildSorThor1Dataset(recon),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  const sheet = workbook.getWorksheet("อปท-สท1")!;
  const totalLabel = findCellValue(sheet, "รวมมูลค่าสินทรัพย์ทั้งสิ้น")!;
  const costCell = sheet.getCell(totalLabel.row, 3);
  assert.equal((costCell.value as any)?.formula, `SUM(C${totalLabel.row - 8}:C${totalLabel.row - 1})`);
});

test("สท.2/สท.3 total formulas reference exactly the actual data row range (changes with row count)", async () => {
  const rows = [row({ rowKey: "r1", assetNameOverride: "A" }), row({ rowKey: "r2", assetNameOverride: "B" }), row({ rowKey: "r3", assetNameOverride: "C" })];
  const workbook = buildReportWorkbook({
    sorThor2: buildSorThor2Dataset(rows),
    sorThor3: buildSorThor3Dataset(rows), // no SOR_THOR_3 rows here -> 0 rows
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  const sheet2 = workbook.getWorksheet("อปท-สท2")!;
  const total2 = findCellValue(sheet2, "รวม (บาท)")!;
  const costFormula2 = (sheet2.getCell(total2.row, 8).value as any)?.formula;
  assert.equal(costFormula2, `SUM(H${total2.row - 3}:H${total2.row - 1})`);

  // สท.3 with zero rows: total must not be a broken/self-referencing formula.
  const sheet3 = workbook.getWorksheet("อปท-สท3")!;
  const total3 = findCellValue(sheet3, "รวม (บาท)")!;
  const costCell3 = sheet3.getCell(total3.row, 6);
  assert.equal(costCell3.value, 0);
});

test("grand total does not double count: สท.1's 8-row SUM range excludes the total row itself", async () => {
  const rows = [row({ rowKey: "r1" })];
  const recon = reconcileWorkbook(rows);
  const workbook = buildReportWorkbook({
    sorThor1: buildSorThor1Dataset(recon),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  const sheet = workbook.getWorksheet("อปท-สท1")!;
  const totalLabel = findCellValue(sheet, "รวมมูลค่าสินทรัพย์ทั้งสิ้น")!;
  const formula = (sheet.getCell(totalLabel.row, 3).value as any).formula as string;
  const range = formula.match(/C(\d+):C(\d+)/)!;
  assert.ok(Number(range[2]) < totalLabel.row, "SUM range must end before the total row");
});

test("formula injection guard: a malicious asset name is stored as safe text, not a formula", async () => {
  const malicious = row({ rowKey: "r1", assetNameOverride: "=cmd|'/c calc'!A1" });
  const workbook = buildReportWorkbook({
    sorThor2: buildSorThor2Dataset([malicious]),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  const sheet = workbook.getWorksheet("อปท-สท2")!;
  const found = findCellValue(sheet, "cmd|");
  assert.ok(found, "the asset name should still be present in the sheet");
  const cell = sheet.getCell(found!.row, found!.col);
  assert.equal(typeof cell.value, "string");
  assert.ok((cell.value as string).startsWith("'="), "a leading =, +, -, or @ must be escaped with a leading apostrophe");
});

test("money cells are numeric with #,##0.00 format (so subtotal formulas sum real numbers)", async () => {
  const rows = [row({ rowKey: "r1" })];
  const recon = reconcileWorkbook(rows);
  const workbook = buildReportWorkbook({
    sorThor1: buildSorThor1Dataset(recon),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  const sheet = workbook.getWorksheet("อปท-สท1")!;
  const equipmentCellPos = findCellValue(sheet, "ครุภัณฑ์")!;
  const costCell = sheet.getCell(equipmentCellPos.row, 3);
  assert.equal(typeof costCell.value, "number");
  assert.equal(costCell.value, 48000);
  assert.equal(costCell.numFmt, "#,##0.00");
});

test("date columns render DD.MM.YYYY in Buddhist Era on สท.2/สท.3", async () => {
  const rows = [row({ rowKey: "r1" })]; // acquisitionDateISO 2017-04-01 -> BE 2560
  const workbook = buildReportWorkbook({
    sorThor2: buildSorThor2Dataset(rows),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  const sheet = workbook.getWorksheet("อปท-สท2")!;
  assert.ok(findCellValue(sheet, "01.04.2560"));
});

test("page setup: landscape orientation, print area, and repeated header row are configured", async () => {
  const rows = [row({ rowKey: "r1" })];
  const recon = reconcileWorkbook(rows);
  const workbook = buildReportWorkbook({
    sorThor1: buildSorThor1Dataset(recon),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  const sheet = workbook.getWorksheet("อปท-สท1")!;
  assert.equal(sheet.pageSetup.orientation, "landscape");
  assert.ok(sheet.pageSetup.printArea);
  assert.ok(sheet.pageSetup.printTitlesRow);
});

test("report sheets can be appended onto an existing workbook (e.g. alongside Template-50 sheets)", async () => {
  const existing = new ExcelJS.Workbook();
  existing.addWorksheet("Sheet1"); // stand-in for the Template-50 sheet
  const rows = [row({ rowKey: "r1" })];
  const recon = reconcileWorkbook(rows);
  const result = buildReportWorkbook({
    workbook: existing,
    sorThor1: buildSorThor1Dataset(recon),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  assert.equal(result, existing);
  assert.ok(result.getWorksheet("Sheet1"));
  assert.ok(result.getWorksheet("อปท-สท1"));
});

test("column widths are set (not default) for readability", async () => {
  const rows = [row({ rowKey: "r1" })];
  const workbook = buildReportWorkbook({
    sorThor2: buildSorThor2Dataset(rows),
    organizationMetadata: org,
    reportingPolicy: policy,
    isDraft: false,
  });
  const sheet = workbook.getWorksheet("อปท-สท2")!;
  assert.ok((sheet.getColumn(3).width || 0) >= 20); // รายการสินทรัพย์ column should be wide
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildSorThor1Dataset } from "../lib/reports/sor-thor-1-dataset";
import { buildSorThor2Dataset } from "../lib/reports/sor-thor-2-dataset";
import { buildSorThor3Dataset } from "../lib/reports/sor-thor-3-dataset";
import { buildAuditAssumptionsDataset } from "../lib/reports/audit-assumptions-dataset";
import { reconcileWorkbook } from "../lib/reporting/reconcile";
import { evaluateExportGate } from "../lib/reporting/calculate-workbook";
import type { CalculatedRow } from "../lib/reporting/types";
import type { OrganizationMetadata, ReportingPolicy } from "../lib/domain/types";

function row(overrides: Partial<CalculatedRow> = {}): CalculatedRow {
  return {
    rowKey: overrides.rowKey || `r${Math.random()}`,
    sourceFile: "f.xlsx",
    sourceSheet: "Sheet1",
    sourceExcelRow: 2,
    assetCode: "A001",
    assetName: "โต๊ะทำงาน",
    unit: "ตัว",
    sourceCategoryText: "ครุภัณฑ์สำนักงาน",
    categoryMapping: { sourceValue: "ครุภัณฑ์สำนักงาน", normalizedKey: "ครุภัณฑ์สำนักงาน", status: "canonical", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_OFFICE", occurrences: 1 },
    normalized: {
      rowKey: "r",
      sourceFile: "f.xlsx",
      sourceSheet: "Sheet1",
      sourceExcelRow: 2,
      assetCode: "A001",
      assetName: "โต๊ะทำงาน",
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
    ...overrides,
  };
}

test("สท.1 dataset always has 8 groups (zero-filled) and a grand total equal to the sum of the groups", () => {
  const recon = reconcileWorkbook([
    row({ rowKey: "r1" }), // EQUIPMENT, SOR_THOR_2
  ]);
  const dataset = buildSorThor1Dataset(recon);
  assert.equal(dataset.rows.length, 8);
  const equipmentRow = dataset.rows.find((r) => r.assetGroup === "EQUIPMENT");
  assert.equal(equipmentRow?.costSatang, 4_800_000);
  const landRow = dataset.rows.find((r) => r.assetGroup === "LAND");
  assert.equal(landRow?.costSatang, 0);
  const sumOfGroups = dataset.rows.reduce((acc, r) => acc + r.costSatang, 0);
  assert.equal(dataset.grandTotal.costSatang, sumOfGroups);
});

test("สท.2 dataset includes only SOR_THOR_2 rows, sorted by group then asset code", () => {
  const rows = [
    row({ rowKey: "r2", assetCode: "B002" }),
    row({ rowKey: "r1", assetCode: "A001" }),
    row({ rowKey: "r3", classification: { rowKey: "r3", classification: "SOR_THOR_3", reasonCodes: ["BELOW_THRESHOLD"], explanation: "", evaluatedRules: [], missingFields: [], classificationVersion: "v1" } }),
  ];
  const dataset = buildSorThor2Dataset(rows);
  assert.equal(dataset.rows.length, 2);
  assert.equal(dataset.rows[0].assetCode, "A001");
  assert.equal(dataset.totals.costSatang, 9_600_000);
});

test("สท.3 dataset includes only SOR_THOR_3 rows with no useful-life/rate/accumulated fields", () => {
  const rows = [
    row({
      rowKey: "r1",
      classification: { rowKey: "r1", classification: "SOR_THOR_3", reasonCodes: ["BELOW_THRESHOLD"], explanation: "", evaluatedRules: [], missingFields: [], classificationVersion: "v1" },
      depreciation: { rowKey: "r1", shouldDepreciate: false, accumulatedDepreciationSatang: 0, netBookValueSatang: 900_000, reasonCodes: ["NOT_DEPRECIATED_BELOW_THRESHOLD"], explanation: "", calculationSteps: [], blockingIssues: [], depreciationRuleVersion: "v1" },
      normalized: { rowKey: "r1", sourceFile: "f", sourceSheet: "s", sourceExcelRow: 2, assetCode: "A001", assetName: "x", costSatang: 900_000, acquisitionDateISO: "2018-01-01" },
    }),
  ];
  const dataset = buildSorThor3Dataset(rows);
  assert.equal(dataset.rows.length, 1);
  assert.equal(dataset.rows[0].costSatang, 900_000);
  assert.equal(dataset.totals.costSatang, 900_000);
  assert.equal((dataset.rows[0] as any).usefulLifeYears, undefined);
  assert.equal((dataset.rows[0] as any).accumulatedDepreciationSatang, undefined);
});

test("audit/assumptions dataset discloses 'ยังไม่มีมติ' when the day-15 policy has not been chosen", () => {
  const policy: ReportingPolicy = {
    fiscalYearBE: 2561,
    cutoffDateISO: "2018-09-30",
    acquisitionDay15Rule: undefined,
    usefulLifeSelectionPolicy: "explicit-per-category",
    usefulLifeOverridesByCategory: { EQUIP_OFFICE: { years: 8, rangeMin: 3, rangeMax: 12, source: "manual", approver: "reviewer" } },
    residualBookValueSatang: 100,
    roundingMode: "half-up",
    roundingStage: "final-only",
    classificationVersion: "v1",
    depreciationRuleVersion: "v1",
  };
  const org: OrganizationMetadata = {
    organizationName: "เทศบาลนครลำปาง",
    district: "เมืองลำปาง",
    province: "ลำปาง",
    postalCode: "52000",
    contactName: "x",
    contactPosition: "y",
    phone: "0",
    fax: "",
  };
  const rows = [row({ rowKey: "r1" }), row({ rowKey: "r2", classification: { rowKey: "r2", classification: "NEEDS_REVIEW", reasonCodes: ["MISSING_COST"], explanation: "", evaluatedRules: [], missingFields: ["cost"], classificationVersion: "v1" } })];
  const recon = reconcileWorkbook(rows);
  const gate = evaluateExportGate({ rows, reconciliation: recon, blockingRowKeys: ["r2"], unresolvedCategoryValues: [] });

  const dataset = buildAuditAssumptionsDataset(policy, org, [], [], [], rows, recon, gate);
  assert.equal(dataset.day15PolicyLabel, "ยังไม่มีมติ (ยังไม่มีการเลือก policy วันที่ 15)");
  assert.equal(dataset.usefulLifeOverrides[0].labelTh, "ครุภัณฑ์สำนักงาน");
  assert.equal(dataset.needsReviewRows.length, 1);
  assert.equal(dataset.needsReviewRows[0].rowKey, "r2");
  assert.equal(dataset.exportGate.officialAllowed, false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createDataSourceWorkbook } from "../lib/datasource";
import { calculateWorkbookFromDataSource } from "../lib/reporting/calculate-workbook";
import type { ReportingPolicy } from "../lib/domain/types";

function policy(overrides: Partial<ReportingPolicy> = {}): ReportingPolicy {
  return {
    fiscalYearBE: 2568,
    cutoffDateISO: "2025-09-30",
    acquisitionDay15Rule: undefined,
    usefulLifeSelectionPolicy: "explicit-per-category",
    usefulLifeOverridesByCategory: {
      EQUIP_COMPUTER: { years: 5, rangeMin: 3, rangeMax: 5, source: "test" },
    },
    residualBookValueSatang: 100,
    roundingMode: "half-up",
    roundingStage: "final-only",
    classificationVersion: "v1",
    depreciationRuleVersion: "v1",
    ...overrides,
  };
}

test("calculateWorkbookFromDataSource bridges a real ASSET_DATA-profile sheet through to a classification", () => {
  const dataSource = createDataSourceWorkbook("asset-data.xlsx", [
    {
      sheetName: "AssetData",
      matrix: [
        ["AssetCode", "ModelName", "AssetTypeName", "PurchaseDate", "PurchasePrice", "Price", "LocationName", "Status", "BrandName"],
        ["A-001", "เครื่องคอมพิวเตอร์", "ครุภัณฑ์คอมพิวเตอร์", "2024-01-05", "", 25000, "อาคาร 1", "ปกติ", "SAMSUNG"],
      ],
    },
  ]);

  const result = calculateWorkbookFromDataSource(dataSource, "asset-data.xlsx", policy(), [], []);

  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.assetCode, "A-001");
  assert.equal(row.sourceCategoryText, "ครุภัณฑ์คอมพิวเตอร์");
  assert.equal(row.categoryMapping.status, "canonical");
  assert.equal(row.normalized.assetGroup, "EQUIPMENT");
  assert.equal(row.normalized.usefulLifeCategoryKey, "EQUIP_COMPUTER");
  assert.equal(row.normalized.acquisitionDateISO, "2024-01-05");
  assert.equal(row.normalized.costSatang, 2_500_000);
  assert.equal(row.classification.classification, "SOR_THOR_2");
  assert.equal(row.depreciation.shouldDepreciate, true);
});

test("calculateWorkbookFromDataSource skips preserved/skipped/unsupported sheets (no rows to calculate)", () => {
  const dataSource = createDataSourceWorkbook("help.xlsx", [
    {
      sheetName: "คำแนะนำ",
      matrix: [["วิธีใช้งานแบบฟอร์ม"], ["กรอกข้อมูลในชีตถัดไป"]],
    },
  ]);
  const result = calculateWorkbookFromDataSource(dataSource, "help.xlsx", policy(), [], []);
  assert.equal(result.rows.length, 0);
});

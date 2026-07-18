// Pure dataset builder for the Audit/Assumptions sheet — the single place
// every policy choice, override, and unresolved item must be disclosed
// (prompt section 4 / P1-B). This sheet is required output for every report
// export, official or draft.

import { USEFUL_LIFE_TABLE } from "../domain/useful-life";
import type { OrganizationMetadata, ReportingPolicy } from "../domain/types";
import type { ExportGateResult } from "../reporting/types";
import type {
  CalculatedRow,
  CategoryMappingOverride,
  ReconciliationResult,
  ReferenceOverride,
  RowOverride,
} from "../reporting/types";
import { reasonCodeLabelTh } from "./labels";

export interface AuditRowTrace {
  rowKey: string;
  sourceFile: string;
  sourceSheet: string;
  sourceExcelRow: number;
  assetCode: string;
  assetName: string;
  classification: string;
  reasonCodesTh: string[];
}

export interface AuditAssumptionsDataset {
  fiscalYearBE: number;
  cutoffDateISO: string;
  organizationMetadata: OrganizationMetadata;
  day15PolicyLabel: string;
  usefulLifeSelectionPolicyLabel: string;
  usefulLifeOverrides: {
    categoryKey: string;
    labelTh: string;
    years: number;
    rangeMin: number;
    rangeMax: number;
    source: string;
    reason?: string;
    approver?: string;
  }[];
  categoryMappingOverridesUsed: CategoryMappingOverride[];
  roundingModeLabel: string;
  roundingStageLabel: string;
  residualBookValueBaht: number;
  classificationVersion: string;
  depreciationRuleVersion: string;
  rowOverrides: RowOverride[];
  referenceOverrides: ReferenceOverride[];
  reconciliation: ReconciliationResult;
  needsReviewRows: AuditRowTrace[];
  excludedRows: AuditRowTrace[];
  exportGate: ExportGateResult;
}

const DAY15_LABELS: Record<string, string> = {
  "count-month": "ได้มาก่อนวันที่ 15 นับเป็น 1 เดือน (count-month)",
  "exclude-month": "ได้มาหลังวันที่ 15 ตัดเดือนนั้นทิ้ง (exclude-month)",
};

const USEFUL_LIFE_POLICY_LABELS: Record<string, string> = {
  minimum: "ใช้อายุการใช้งานต่ำสุดของแต่ละประเภทตามตาราง",
  maximum: "ใช้อายุการใช้งานสูงสุดของแต่ละประเภทตามตาราง",
  "explicit-per-category": "กำหนดอายุการใช้งานเฉพาะเจาะจงต่อประเภท (explicit-per-category)",
};

const ROUNDING_MODE_LABELS: Record<string, string> = {
  "half-up": "ปัดขึ้นเมื่อเศษ .5 (half-up)",
  "half-even": "ปัดเข้าเลขคู่เมื่อเศษ .5 (half-even / banker's rounding)",
  truncate: "ตัดทศนิยมทิ้ง (truncate)",
};

const ROUNDING_STAGE_LABELS: Record<string, string> = {
  "final-only": "ปัดเศษเฉพาะผลลัพธ์สุดท้าย (final-only)",
  "per-year": "ปัดเศษค่าเสื่อมรายปีก่อนสะสม (per-year)",
  "per-month": "ปัดเศษค่าเสื่อมรายเดือนก่อนสะสม (per-month)",
};

function traceOf(row: CalculatedRow): AuditRowTrace {
  return {
    rowKey: row.rowKey,
    sourceFile: row.sourceFile,
    sourceSheet: row.sourceSheet,
    sourceExcelRow: row.sourceExcelRow,
    assetCode: row.assetCode,
    assetName: row.assetName,
    classification: row.classification.classification,
    reasonCodesTh: row.classification.reasonCodes.map(reasonCodeLabelTh),
  };
}

export function buildAuditAssumptionsDataset(
  policy: ReportingPolicy,
  organizationMetadata: OrganizationMetadata,
  categoryMappingOverrides: CategoryMappingOverride[],
  rowOverrides: RowOverride[],
  referenceOverrides: ReferenceOverride[],
  calculatedRows: CalculatedRow[],
  reconciliation: ReconciliationResult,
  exportGate: ExportGateResult,
): AuditAssumptionsDataset {
  const usefulLifeOverrides = Object.entries(policy.usefulLifeOverridesByCategory).map(([categoryKey, override]) => ({
    categoryKey,
    labelTh: USEFUL_LIFE_TABLE[categoryKey as keyof typeof USEFUL_LIFE_TABLE]?.labelTh || categoryKey,
    years: override!.years,
    rangeMin: override!.rangeMin,
    rangeMax: override!.rangeMax,
    source: override!.source,
    reason: override!.reason,
    approver: override!.approver,
  }));

  return {
    fiscalYearBE: policy.fiscalYearBE,
    cutoffDateISO: policy.cutoffDateISO,
    organizationMetadata,
    day15PolicyLabel: policy.acquisitionDay15Rule ? DAY15_LABELS[policy.acquisitionDay15Rule] : "ยังไม่มีมติ (ยังไม่มีการเลือก policy วันที่ 15)",
    usefulLifeSelectionPolicyLabel: USEFUL_LIFE_POLICY_LABELS[policy.usefulLifeSelectionPolicy] || policy.usefulLifeSelectionPolicy,
    usefulLifeOverrides,
    categoryMappingOverridesUsed: categoryMappingOverrides,
    roundingModeLabel: ROUNDING_MODE_LABELS[policy.roundingMode] || policy.roundingMode,
    roundingStageLabel: ROUNDING_STAGE_LABELS[policy.roundingStage] || policy.roundingStage,
    residualBookValueBaht: policy.residualBookValueSatang / 100,
    classificationVersion: policy.classificationVersion,
    depreciationRuleVersion: policy.depreciationRuleVersion,
    rowOverrides,
    referenceOverrides,
    reconciliation,
    needsReviewRows: calculatedRows.filter((row) => row.classification.classification === "NEEDS_REVIEW").map(traceOf),
    excludedRows: calculatedRows.filter((row) => row.classification.classification === "EXCLUDED").map(traceOf),
    exportGate,
  };
}

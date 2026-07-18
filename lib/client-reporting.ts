// Client-side draft state for the report-configuration step. Every policy
// field starts unset (never a silent default) except residualBookValueSatang,
// which the manual itself fixes at 1 baht — shown pre-filled and editable,
// per spec section 2.4, rather than hidden as an implicit assumption.

import type {
  Day15Rule,
  OrganizationMetadata,
  ReportingPolicy,
  RoundingStage,
  UsefulLifeSelectionPolicy,
} from "./domain/types";
import type { RoundingMode } from "./domain/money";
import type { UsefulLifeCategoryKey } from "./domain/useful-life";
import type { SelectedOutput } from "./reporting/types";

export interface UsefulLifeOverrideDraft {
  years: string; // form-bound string; parsed on submit
  source: string;
  reason?: string;
  approver?: string;
}

export interface ReportingPolicyDraft {
  fiscalYearBE: string;
  cutoffDateISO: string; // native <input type="date"> already yields ISO
  acquisitionDay15Rule: Day15Rule | "";
  usefulLifeSelectionPolicy: UsefulLifeSelectionPolicy | "";
  usefulLifeOverridesByCategory: Partial<Record<UsefulLifeCategoryKey, UsefulLifeOverrideDraft>>;
  residualBookValueBaht: string; // pre-filled "1" (1.00 บาท) per the manual, editable
  roundingMode: RoundingMode | "";
  roundingStage: RoundingStage | "";
}

export function emptyReportingPolicyDraft(): ReportingPolicyDraft {
  return {
    fiscalYearBE: "",
    cutoffDateISO: "",
    acquisitionDay15Rule: "",
    usefulLifeSelectionPolicy: "",
    usefulLifeOverridesByCategory: {},
    residualBookValueBaht: "1",
    roundingMode: "",
    roundingStage: "",
  };
}

export function emptyOrganizationMetadataDraft(): OrganizationMetadata {
  return {
    organizationName: "",
    district: "",
    province: "",
    postalCode: "",
    contactName: "",
    contactPosition: "",
    phone: "",
    fax: "",
  };
}

/** Fields that must be non-empty before a ReportingPolicy can be submitted. */
export function reportingPolicyMissingFields(draft: ReportingPolicyDraft): string[] {
  const missing: string[] = [];
  if (!draft.fiscalYearBE.trim()) missing.push("ปีงบประมาณ (พ.ศ.)");
  if (!draft.cutoffDateISO.trim()) missing.push("วันตัดยอด (cutoff date)");
  if (!draft.usefulLifeSelectionPolicy) missing.push("Useful-life selection policy");
  if (!draft.roundingMode) missing.push("Rounding mode");
  if (!draft.roundingStage) missing.push("Rounding stage");
  if (!draft.residualBookValueBaht.trim()) missing.push("มูลค่าคงเหลือตามบัญชี (residual)");
  return missing;
}

export function organizationMetadataMissingFields(org: OrganizationMetadata): string[] {
  const missing: string[] = [];
  if (!org.organizationName.trim()) missing.push("หน่วยงาน");
  if (!org.district.trim()) missing.push("อำเภอ");
  if (!org.province.trim()) missing.push("จังหวัด");
  if (!org.postalCode.trim()) missing.push("รหัสไปรษณีย์");
  if (!org.contactName.trim()) missing.push("ชื่อเจ้าหน้าที่ประสานงาน");
  if (!org.contactPosition.trim()) missing.push("ตำแหน่ง");
  if (!org.phone.trim()) missing.push("โทรศัพท์");
  return missing;
}

/**
 * Converts a draft to a submittable ReportingPolicy, or null when required
 * fields are still missing. usefulLifeOverridesByCategory entries with a
 * blank `years` are dropped (they simply have not been decided yet).
 */
export function toReportingPolicy(draft: ReportingPolicyDraft): ReportingPolicy | null {
  if (reportingPolicyMissingFields(draft).length > 0) return null;
  const fiscalYearBE = Number(draft.fiscalYearBE);
  const residualBookValueSatang = Math.round(Number(draft.residualBookValueBaht) * 100);
  if (!Number.isFinite(fiscalYearBE) || !Number.isFinite(residualBookValueSatang)) return null;

  const usefulLifeOverridesByCategory: ReportingPolicy["usefulLifeOverridesByCategory"] = {};
  for (const [key, override] of Object.entries(draft.usefulLifeOverridesByCategory)) {
    if (!override || !override.years.trim()) continue;
    const years = Number(override.years);
    if (!Number.isFinite(years)) continue;
    usefulLifeOverridesByCategory[key as UsefulLifeCategoryKey] = {
      years,
      rangeMin: 0,
      rangeMax: 999, // server re-validates against the real manual range
      source: override.source || "ผู้ใช้เลือกผ่านหน้าตั้งค่ารายงาน",
      reason: override.reason,
      approver: override.approver,
    };
  }

  return {
    fiscalYearBE,
    cutoffDateISO: draft.cutoffDateISO,
    acquisitionDay15Rule: draft.acquisitionDay15Rule || undefined,
    usefulLifeSelectionPolicy: draft.usefulLifeSelectionPolicy as UsefulLifeSelectionPolicy,
    usefulLifeOverridesByCategory,
    residualBookValueSatang,
    roundingMode: draft.roundingMode as RoundingMode,
    roundingStage: draft.roundingStage as RoundingStage,
    classificationVersion: "manual-2561-v1",
    depreciationRuleVersion: "manual-2561-v1",
  };
}

export const ALL_SELECTED_OUTPUTS_CLIENT: { value: SelectedOutput; label: string }[] = [
  { value: "TEMPLATE_50", label: "Template 50 คอลัมน์ (เดิม)" },
  { value: "SOR_THOR_1", label: "แบบ อปท.-สท. 1" },
  { value: "SOR_THOR_2", label: "แบบ อปท.-สท. 2" },
  { value: "SOR_THOR_3", label: "แบบ อปท.-สท. 3" },
  { value: "AUDIT_ASSUMPTIONS", label: "Audit / Assumptions" },
];

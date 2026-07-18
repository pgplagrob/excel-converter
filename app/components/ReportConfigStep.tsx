"use client";

import { useMemo } from "react";
import type { OrganizationMetadata } from "@/lib/domain/types";
import { USEFUL_LIFE_TABLE, type UsefulLifeCategoryKey } from "@/lib/domain/useful-life";
import {
  ALL_SELECTED_OUTPUTS_CLIENT,
  organizationMetadataMissingFields,
  reportingPolicyMissingFields,
  type ReportingPolicyDraft,
} from "@/lib/client-reporting";
import type { CategoryMappingOverride, SelectedOutput } from "@/lib/reporting/types";

export interface CalculationSummary {
  totalRows: number;
  blockingRowCount: number;
  unresolvedCategoryValues: { sourceValue: string; occurrences: number; assetGroup?: string }[];
  usefulLifeCategoriesInUse: UsefulLifeCategoryKey[];
  reconciliation: {
    sorThor1MatchesSorThor2: boolean;
    controlTotalMatchesReportableScope: boolean;
    needsReviewCount: number;
    excludedCount: number;
  };
  exportGate: { officialAllowed: boolean; blockingReasons: string[] };
}

const ASSET_GROUP_OPTIONS = [
  "LAND",
  "BUILDING",
  "STRUCTURE",
  "EQUIPMENT",
  "INFRASTRUCTURE",
  "INTANGIBLE",
  "INVESTMENT_PROPERTY",
  "LEASED_ASSET",
] as const;

interface ReportConfigStepProps {
  policyDraft: ReportingPolicyDraft;
  setPolicyDraft: (updater: (prev: ReportingPolicyDraft) => ReportingPolicyDraft) => void;
  organizationMetadata: OrganizationMetadata;
  setOrganizationMetadata: (updater: (prev: OrganizationMetadata) => OrganizationMetadata) => void;
  selectedOutputs: SelectedOutput[];
  setSelectedOutputs: (updater: (prev: SelectedOutput[]) => SelectedOutput[]) => void;
  categoryMappingOverrides: CategoryMappingOverride[];
  setCategoryMappingOverrides: (updater: (prev: CategoryMappingOverride[]) => CategoryMappingOverride[]) => void;
  calculationSummary: CalculationSummary | null;
  onCalculate: () => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
}

export function ReportConfigStep({
  policyDraft,
  setPolicyDraft,
  organizationMetadata,
  setOrganizationMetadata,
  selectedOutputs,
  setSelectedOutputs,
  categoryMappingOverrides,
  setCategoryMappingOverrides,
  calculationSummary,
  onCalculate,
  onBack,
  onNext,
  loading,
}: ReportConfigStepProps) {
  const wantsReportOutputs = selectedOutputs.some((output) => output !== "TEMPLATE_50");
  const policyMissing = reportingPolicyMissingFields(policyDraft);
  const orgMissing = wantsReportOutputs ? organizationMetadataMissingFields(organizationMetadata) : [];
  const canCalculate = wantsReportOutputs && policyMissing.length === 0 && orgMissing.length === 0;

  const toggleOutput = (value: SelectedOutput) => {
    setSelectedOutputs((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const setOverrideForCategory = (
    sourceValue: string,
    assetGroup: string,
    usefulLifeCategoryKey: string,
  ) => {
    setCategoryMappingOverrides((prev) => {
      const withoutThis = prev.filter((item) => item.sourceValue !== sourceValue);
      if (!assetGroup) return withoutThis;
      return [
        ...withoutThis,
        {
          sourceValue,
          assetGroup: assetGroup as CategoryMappingOverride["assetGroup"],
          usefulLifeCategoryKey: (usefulLifeCategoryKey || undefined) as CategoryMappingOverride["usefulLifeCategoryKey"],
          approvedBy: "ผู้ใช้งาน (หน้าตั้งค่ารายงาน)",
        },
      ];
    });
  };

  const overrideFor = (sourceValue: string) => categoryMappingOverrides.find((item) => item.sourceValue === sourceValue);

  const usefulLifeCategoryOptions = useMemo(
    () => Object.values(USEFUL_LIFE_TABLE).sort((a, b) => a.labelTh.localeCompare(b.labelTh, "th")),
    [],
  );

  return (
    <>
      <p className="eyebrow">Step 3</p>
      <h2>ตั้งค่ารายงาน</h2>
      <p className="lead">
        กำหนดปีงบประมาณ วันตัดยอด ข้อมูลหน่วยงาน และ policy การคำนวณค่าเสื่อมราคา
        ระบบจะไม่เลือกค่าใด ๆ ให้อัตโนมัติ — ต้องเลือกเองทุกช่องที่จำเป็นก่อนคำนวณได้
      </p>

      <div className="form-section">
        <h3>Output ที่ต้องการ</h3>
        <p className="hint">Template 50 คอลัมน์ทำงานเหมือนเดิมเสมอ ส่วน อปท.-สท. และ Audit เป็น output เพิ่มเติมที่เลือกได้</p>
        <div className="checkbox-list">
          {ALL_SELECTED_OUTPUTS_CLIENT.map((item) => (
            <label className="checkbox-row" key={item.value}>
              <input
                type="checkbox"
                checked={selectedOutputs.includes(item.value)}
                onChange={() => toggleOutput(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      {wantsReportOutputs && (
        <>
          <div className="form-section">
            <h3>ปีงบประมาณและวันตัดยอด</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>ปีงบประมาณ (พ.ศ.)</label>
                <input
                  type="number"
                  value={policyDraft.fiscalYearBE}
                  onChange={(e) => setPolicyDraft((prev) => ({ ...prev, fiscalYearBE: e.target.value }))}
                  placeholder="เช่น 2568"
                />
              </div>
              <div className="form-field">
                <label>วันตัดยอด (cutoff date)</label>
                <input
                  type="date"
                  value={policyDraft.cutoffDateISO}
                  onChange={(e) => setPolicyDraft((prev) => ({ ...prev, cutoffDateISO: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>ข้อมูลหน่วยงาน / ผู้ประสานงาน</h3>
            <div className="form-grid">
              {(
                [
                  ["organizationName", "หน่วยงาน"],
                  ["district", "อำเภอ"],
                  ["province", "จังหวัด"],
                  ["postalCode", "รหัสไปรษณีย์"],
                  ["contactName", "ชื่อเจ้าหน้าที่ประสานงาน"],
                  ["contactPosition", "ตำแหน่ง"],
                  ["phone", "โทรศัพท์"],
                  ["fax", "โทรสาร (ถ้ามี)"],
                ] as [keyof OrganizationMetadata, string][]
              ).map(([field, label]) => (
                <div className="form-field" key={field}>
                  <label>{label}</label>
                  <input
                    type="text"
                    value={organizationMetadata[field]}
                    onChange={(e) =>
                      setOrganizationMetadata((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3>Policy การคำนวณค่าเสื่อมราคา</h3>
            <p className="hint">ไม่มีค่าเริ่มต้นที่เลือกไว้ล่วงหน้า ต้องเลือกเองทุกช่อง (ยกเว้นวันที่ 15 ซึ่งจำเป็นเฉพาะเมื่อพบรายการที่ตรงวันที่ 15)</p>
            <div className="form-grid">
              <div className="form-field">
                <label>Useful-life selection policy</label>
                <select
                  value={policyDraft.usefulLifeSelectionPolicy}
                  onChange={(e) =>
                    setPolicyDraft((prev) => ({ ...prev, usefulLifeSelectionPolicy: e.target.value as any }))
                  }
                >
                  <option value="">— เลือก —</option>
                  <option value="minimum">minimum (ใช้อายุต่ำสุด)</option>
                  <option value="maximum">maximum (ใช้อายุสูงสุด)</option>
                  <option value="explicit-per-category">explicit-per-category (กำหนดเฉพาะประเภท)</option>
                </select>
              </div>
              <div className="form-field">
                <label>กฎวันที่ 15 (acquisitionDay15Rule)</label>
                <select
                  value={policyDraft.acquisitionDay15Rule}
                  onChange={(e) =>
                    setPolicyDraft((prev) => ({ ...prev, acquisitionDay15Rule: e.target.value as any }))
                  }
                >
                  <option value="">— ยังไม่เลือก —</option>
                  <option value="count-month">count-month (ก่อน/ตรงวันที่ 15 นับเป็น 1 เดือน)</option>
                  <option value="exclude-month">exclude-month (หลัง/ตรงวันที่ 15 ตัดเดือนทิ้ง)</option>
                </select>
                <span className="field-hint">รายการที่ได้มาตรงวันที่ 15 จะเป็น NEEDS_REVIEW จนกว่าจะเลือก</span>
              </div>
              <div className="form-field">
                <label>Rounding mode</label>
                <select
                  value={policyDraft.roundingMode}
                  onChange={(e) => setPolicyDraft((prev) => ({ ...prev, roundingMode: e.target.value as any }))}
                >
                  <option value="">— เลือก —</option>
                  <option value="half-up">half-up</option>
                  <option value="half-even">half-even</option>
                  <option value="truncate">truncate</option>
                </select>
              </div>
              <div className="form-field">
                <label>Rounding stage</label>
                <select
                  value={policyDraft.roundingStage}
                  onChange={(e) => setPolicyDraft((prev) => ({ ...prev, roundingStage: e.target.value as any }))}
                >
                  <option value="">— เลือก —</option>
                  <option value="final-only">final-only</option>
                  <option value="per-year">per-year</option>
                  <option value="per-month">per-month</option>
                </select>
              </div>
              <div className="form-field">
                <label>มูลค่าคงเหลือตามบัญชี (residual, บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  value={policyDraft.residualBookValueBaht}
                  onChange={(e) =>
                    setPolicyDraft((prev) => ({ ...prev, residualBookValueBaht: e.target.value }))
                  }
                />
                <span className="field-hint">ตามคู่มือ = 1.00 บาท (แก้ไขได้ แต่จะไม่เปลี่ยนแบบเงียบ ๆ)</span>
              </div>
            </div>
          </div>

          {policyDraft.usefulLifeSelectionPolicy === "explicit-per-category" && (
            <div className="form-section">
              <h3>อายุการใช้งานเฉพาะประเภท (explicit-per-category)</h3>
              <p className="hint">
                {calculationSummary
                  ? `ประเภทที่พบในข้อมูล (${calculationSummary.usefulLifeCategoriesInUse.length} ประเภท) — กำหนดอายุให้ครบก่อนคำนวณรายงานทางการ`
                  : "กด \"คำนวณ\" ด้านล่างก่อน เพื่อให้ระบบแสดงประเภทที่พบจริงในข้อมูล"}
              </p>
              {calculationSummary?.usefulLifeCategoriesInUse.map((key) => {
                const table = USEFUL_LIFE_TABLE[key];
                const current = policyDraft.usefulLifeOverridesByCategory[key];
                return (
                  <div className="override-row" key={key}>
                    <span>{table.labelTh}</span>
                    <span className="field-hint">
                      ช่วง {table.minYears}-{table.maxYears} ปี
                    </span>
                    <input
                      type="number"
                      placeholder="อายุ (ปี)"
                      value={current?.years || ""}
                      onChange={(e) =>
                        setPolicyDraft((prev) => ({
                          ...prev,
                          usefulLifeOverridesByCategory: {
                            ...prev.usefulLifeOverridesByCategory,
                            [key]: { years: e.target.value, source: "หน้าตั้งค่ารายงาน" },
                          },
                        }))
                      }
                    />
                    <span />
                  </div>
                );
              })}
            </div>
          )}

          {calculationSummary && calculationSummary.unresolvedCategoryValues.length > 0 && (
            <div className="form-section">
              <h3>การ mapping ประเภทสินทรัพย์ที่ยังไม่ได้กำหนด</h3>
              <p className="hint">
                ค่าต้นทางเหล่านี้ไม่ตรงกับประเภทมาตรฐานในคู่มือแบบตรงตัว (exact match) — ต้องเลือกเอง ไม่มีการเดาหรือ fuzzy match
              </p>
              {calculationSummary.unresolvedCategoryValues.map((item) => {
                const current = overrideFor(item.sourceValue);
                return (
                  <div className="category-mapping-row" key={item.sourceValue}>
                    <span>{item.sourceValue}</span>
                    <span className="occurrences">พบ {item.occurrences} ครั้ง</span>
                    <select
                      value={current?.assetGroup || ""}
                      onChange={(e) =>
                        setOverrideForCategory(item.sourceValue, e.target.value, current?.usefulLifeCategoryKey || "")
                      }
                    >
                      <option value="">— เลือกประเภท (AssetGroup) —</option>
                      {ASSET_GROUP_OPTIONS.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                    <select
                      value={current?.usefulLifeCategoryKey || ""}
                      disabled={!current?.assetGroup || current.assetGroup === "LAND"}
                      onChange={(e) =>
                        setOverrideForCategory(item.sourceValue, current?.assetGroup || "", e.target.value)
                      }
                    >
                      <option value="">— เลือก useful-life category —</option>
                      {usefulLifeCategoryOptions.map((table) => (
                        <option key={table.key} value={table.key}>
                          {table.labelTh}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {(policyMissing.length > 0 || orgMissing.length > 0) && (
            <div className="missing-fields-banner">
              ยังไม่ครบ: {[...policyMissing, ...orgMissing].join(", ")}
            </div>
          )}

          <div className="actions">
            <button className="btn secondary" disabled={!canCalculate || loading} onClick={onCalculate}>
              {loading ? "กำลังคำนวณ..." : "คำนวณ / รีเฟรชผลลัพธ์"}
            </button>
          </div>

          {calculationSummary && (
            <div className="summary-grid small">
              <div className="summary-card">
                <div className="num">{calculationSummary.totalRows}</div>
                <div className="label">แถวทั้งหมดที่คำนวณ</div>
              </div>
              <div className={`summary-card ${calculationSummary.blockingRowCount > 0 ? "error" : "ok"}`}>
                <div className="num">{calculationSummary.blockingRowCount}</div>
                <div className="label">NEEDS_REVIEW / blocking</div>
              </div>
              <div className="summary-card">
                <div className="num">{calculationSummary.reconciliation.excludedCount}</div>
                <div className="label">EXCLUDED</div>
              </div>
              <div className={`summary-card ${calculationSummary.exportGate.officialAllowed ? "ok" : "error"}`}>
                <div className="num">{calculationSummary.exportGate.officialAllowed ? "พร้อม" : "ยังไม่พร้อม"}</div>
                <div className="label">export รายงานทางการ</div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="actions">
        <button className="btn secondary" onClick={onBack}>
          ← ย้อนกลับ
        </button>
        <button className="btn amber" onClick={onNext}>
          ไป Preview / Export →
        </button>
      </div>
    </>
  );
}

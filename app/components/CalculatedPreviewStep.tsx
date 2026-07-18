"use client";

import { useState } from "react";
import type { ReportClass } from "@/lib/domain/types";
import type { SeverityFilter } from "@/lib/reporting/preview-query";
import type { RowOverrideField, RowOverrideInput } from "@/lib/reporting/types";
import type { PreviewRowDto } from "@/lib/reporting/preview-dto";

export interface WarningGroupDto {
  reasonCode: string;
  count: number;
  sampleRowKeys: string[];
}

export interface ReconciliationSummaryDto {
  sorThor1MatchesSorThor2: boolean;
  controlTotalMatchesReportableScope: boolean;
  needsReviewCount: number;
  excludedCount: number;
}

interface CalculatedPreviewStepProps {
  rows: PreviewRowDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  warningGroups: WarningGroupDto[];
  reconciliation: ReconciliationSummaryDto | null;
  classificationFilter: ReportClass[];
  setClassificationFilter: (value: ReportClass[]) => void;
  severityFilter: SeverityFilter[];
  setSeverityFilter: (value: SeverityFilter[]) => void;
  search: string;
  setSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onApplyOverride: (override: RowOverrideInput) => void;
  onResetOverride: (rowKey: string) => void;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
}

const CLASSIFICATIONS: ReportClass[] = ["SOR_THOR_2", "SOR_THOR_3", "EXCLUDED", "NEEDS_REVIEW"];
const SEVERITIES: SeverityFilter[] = ["needsReview", "error", "warning"];
const OVERRIDE_FIELDS: { value: RowOverrideField; label: string }[] = [
  { value: "assetGroup", label: "assetGroup" },
  { value: "usefulLifeCategoryKey", label: "usefulLifeCategoryKey" },
  { value: "acquisitionDateISO", label: "acquisitionDateISO (YYYY-MM-DD)" },
  { value: "costSatang", label: "costSatang" },
];

function moneyBaht(satang?: number | null): string {
  if (satang === undefined || satang === null) return "-";
  return (satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function RowOverrideForm({
  rowKey,
  onApply,
}: {
  rowKey: string;
  onApply: (override: RowOverrideInput) => void;
}) {
  const [field, setField] = useState<RowOverrideField>("assetGroup");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="override-form">
      <select value={field} onChange={(e) => setField(e.target.value as RowOverrideField)}>
        {OVERRIDE_FIELDS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <input placeholder="ค่าที่แก้ไข" value={value} onChange={(e) => setValue(e.target.value)} />
      <input placeholder="เหตุผล (ถ้ามี)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button
        className="btn secondary"
        disabled={!value.trim()}
        onClick={() => {
          onApply({
            rowKey,
            field,
            overrideValue: field === "costSatang" ? Number(value) : value,
            reason: reason || undefined,
          });
          setValue("");
          setReason("");
        }}
      >
        แก้ไขแถวนี้
      </button>
    </div>
  );
}

export function CalculatedPreviewStep({
  rows,
  page,
  pageSize,
  total,
  totalPages,
  warningGroups,
  reconciliation,
  classificationFilter,
  setClassificationFilter,
  severityFilter,
  setSeverityFilter,
  search,
  setSearch,
  onPageChange,
  onApplyOverride,
  onResetOverride,
  loading,
  onBack,
  onNext,
}: CalculatedPreviewStepProps) {
  const [openOverrideRowKey, setOpenOverrideRowKey] = useState<string | null>(null);

  const toggleClassification = (value: ReportClass) => {
    setClassificationFilter(
      classificationFilter.includes(value)
        ? classificationFilter.filter((item) => item !== value)
        : [...classificationFilter, value],
    );
  };
  const toggleSeverity = (value: SeverityFilter) => {
    setSeverityFilter(
      severityFilter.includes(value) ? severityFilter.filter((item) => item !== value) : [...severityFilter, value],
    );
  };

  return (
    <>
      <p className="eyebrow">Step 4</p>
      <h2>Calculated preview</h2>
      <p className="lead">
        แสดงค่าต้นทาง ค่าที่ normalize และค่าที่คำนวณพร้อมเหตุผลเป็นรายแถว รองรับสูงสุดหลายพันแถวโดยแบ่งหน้า
        ไม่แสดงทุกแถวพร้อมกัน
      </p>

      {reconciliation && (
        <div className="summary-grid small">
          <div className={`summary-card ${reconciliation.sorThor1MatchesSorThor2 ? "ok" : "error"}`}>
            <div className="num">{reconciliation.sorThor1MatchesSorThor2 ? "✓" : "✗"}</div>
            <div className="label">สท.1 = สท.2</div>
          </div>
          <div className={`summary-card ${reconciliation.controlTotalMatchesReportableScope ? "ok" : "error"}`}>
            <div className="num">{reconciliation.controlTotalMatchesReportableScope ? "✓" : "✗"}</div>
            <div className="label">control total = สท.2+สท.3</div>
          </div>
          <div className="summary-card">
            <div className="num">{reconciliation.needsReviewCount}</div>
            <div className="label">NEEDS_REVIEW</div>
          </div>
          <div className="summary-card">
            <div className="num">{reconciliation.excludedCount}</div>
            <div className="label">EXCLUDED</div>
          </div>
        </div>
      )}

      {warningGroups.length > 0 && (
        <div className="form-section">
          <h3>สรุป warning แบบจัดกลุ่ม</h3>
          <div className="warning-groups">
            {warningGroups.slice(0, 15).map((group) => (
              <div
                className="warning-group-row"
                key={group.reasonCode}
                onClick={() => setSearch(group.sampleRowKeys[0] ? "" : search)}
                title={`ตัวอย่างแถว: ${group.sampleRowKeys.join(", ")}`}
              >
                <span>{group.reasonCode}</span>
                <span className="count">{group.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="preview-toolbar">
        {CLASSIFICATIONS.map((value) => (
          <label className="checkbox-row" key={value}>
            <input type="checkbox" checked={classificationFilter.includes(value)} onChange={() => toggleClassification(value)} />
            {value}
          </label>
        ))}
        {SEVERITIES.map((value) => (
          <label className="checkbox-row" key={value}>
            <input type="checkbox" checked={severityFilter.includes(value)} onChange={() => toggleSeverity(value)} />
            {value}
          </label>
        ))}
        <input
          type="search"
          placeholder="ค้นหารหัสหรือชื่อสินทรัพย์"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">ไม่มีแถวที่ตรงกับตัวกรองนี้</div>
      ) : (
        rows.map((row) => (
          <div className="preview-row" key={row.rowKey}>
            <div className="top-line">
              <span>
                {row.assetCode} — {row.assetName}
              </span>
              <span>{row.classification.classification}</span>
            </div>
            <div className="meta">
              ต้นทาง: {row.source.categoryText || "-"} | normalize: {row.normalized.assetGroup || "-"} /{" "}
              {row.normalized.usefulLifeCategoryKey || "-"} / {row.normalized.acquisitionDateISO || "-"} | คำนวณ: ราคาทุน{" "}
              {moneyBaht(row.normalized.costSatang)} บาท, ค่าเสื่อมสะสม {moneyBaht(row.depreciation.accumulatedDepreciationSatang)} บาท,
              สุทธิ {moneyBaht(row.depreciation.netBookValueSatang)} บาท
            </div>
            <div className="explanation">
              {row.classification.explanation} {row.depreciation.explanation}
            </div>
            {row.appliedOverrides.length > 0 && (
              <div className="field-hint">
                แก้ไขแล้ว: {row.appliedOverrides.map((o) => `${o.field}=${o.overrideValue}`).join(", ")}{" "}
                <button className="btn secondary" onClick={() => onResetOverride(row.rowKey)}>
                  ยกเลิกการแก้ไข
                </button>
              </div>
            )}
            <div className="actions" style={{ marginTop: 6 }}>
              <button
                className="btn secondary"
                onClick={() => setOpenOverrideRowKey(openOverrideRowKey === row.rowKey ? null : row.rowKey)}
              >
                {openOverrideRowKey === row.rowKey ? "ปิดฟอร์มแก้ไข" : "แก้ไขแถวนี้"}
              </button>
            </div>
            {openOverrideRowKey === row.rowKey && <RowOverrideForm rowKey={row.rowKey} onApply={onApplyOverride} />}
          </div>
        ))
      )}

      <div className="pagination-bar">
        <button className="btn secondary" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>
          ← ก่อนหน้า
        </button>
        <span>
          หน้า {page} / {totalPages} (ทั้งหมด {total} แถว, {pageSize} แถว/หน้า)
        </span>
        <button className="btn secondary" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}>
          ถัดไป →
        </button>
      </div>

      <div className="actions">
        <button className="btn secondary" onClick={onBack}>
          ← ย้อนกลับ
        </button>
        <button className="btn amber" onClick={onNext}>
          ไป Export →
        </button>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import type {
  CellOverridesBySheet,
  ExcludedRowsBySheet,
  IssueSummary,
  MappingSuggestion,
  ParseResponse,
  SheetData,
  SheetEligibility,
  ValidationIssue,
} from "@/lib/client-types";
import { hasManualOverride, type ManualMapping } from "@/lib/manual-mapping";
import { TEMPLATE_COLUMNS } from "@/lib/mapping";
import { createRuntimeSheetSummary, splitIssuesByReferenceMismatch } from "./display";
import { IssueList } from "./IssueList";
import { MappingSummary } from "./MappingSummary";
import { SheetSummaryPanel } from "./SheetSummaryPanel";
import { SheetTabs } from "./SheetTabs";
import { SourcePreviewTable } from "./SourcePreviewTable";

interface PreviewStepProps {
  reviewLayout?: boolean;
  parsed: ParseResponse;
  activeSheetIdx: number;
  setActiveSheetIdx: (index: number) => void;
  mappingState: Record<string, ManualMapping>;
  cellOverrides: CellOverridesBySheet;
  excludedRows: ExcludedRowsBySheet;
  updateMapping: (
    sheetName: string,
    templateColumn: string,
    sourceColumn: string | null | undefined,
  ) => void;
  updateCellOverride: (
    sheetName: string,
    rowIndex: number,
    templateColumn: string,
    value: string,
  ) => void;
  toggleExcludedRow: (sheetName: string, rowIndex: number) => void;
  resetSheetFixes: (sheetName: string) => void;
  reparseSheet: (
    sheetName: string,
    headerRow: number,
    dataStartRow?: number,
    dataEndRow?: number,
  ) => Promise<void>;
  mappedCountForSheet: (sheetName: string) => number;
  issues: ValidationIssue[] | null;
  issueSummary: IssueSummary | null;
  resultsStale: boolean;
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  canContinue: boolean;
  loading: boolean;
}

type VisibleMapping = MappingSuggestion & {
  originalIndex: number;
  autoSourceColumn: string | null;
};

type ReviewStatus = "success" | "warning" | "error" | "preserved" | "skipped" | "unsupported";

interface ReviewSheetRow {
  key: string;
  sheetName: string;
  sheet: SheetData | null;
  eligibility: SheetEligibility;
  status: ReviewStatus;
  rowCount: number;
  headerRow?: number;
  reason?: string;
  errorCount: number;
  warningCount: number;
}

const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; priority: number }> = {
  error: { label: "พบข้อผิดพลาด", priority: 0 },
  warning: { label: "ต้องตรวจสอบ", priority: 1 },
  unsupported: { label: "ยังไม่รองรับ", priority: 2 },
  success: { label: "พร้อมใช้งาน", priority: 3 },
  preserved: { label: "เก็บต้นฉบับ", priority: 4 },
  skipped: { label: "ข้าม", priority: 5 },
};

const PARSER_MANAGED_TEMPLATE_COLUMNS = new Set([
  "ชื่อสินทรัพย์",
  "รายละเอียด",
  "ชนิดสินทรัพย์",
  "รายการสินทรัพย์",
]);

export function PreviewStep({
  reviewLayout = false,
  parsed,
  activeSheetIdx,
  setActiveSheetIdx,
  mappingState,
  cellOverrides,
  excludedRows,
  updateMapping,
  updateCellOverride,
  toggleExcludedRow,
  resetSheetFixes,
  reparseSheet,
  mappedCountForSheet,
  issues,
  issueSummary,
  resultsStale,
  advancedOpen,
  setAdvancedOpen,
  onBack,
  onNext,
  canContinue,
  loading,
}: PreviewStepProps) {
  const [previewSheetKey, setPreviewSheetKey] = useState<string | null>(null);
  const [selectedReviewKey, setSelectedReviewKey] = useState<string | null>(null);
  useEffect(() => {
    if (previewSheetKey === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewSheetKey(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewSheetKey]);

  const sheet = parsed.sheets[activeSheetIdx];
  if (reviewLayout) {
    const sheetByName = new Map(parsed.sheets.map((item) => [item.sheetName, item]));
    const overviewNames = new Set(parsed.sheetOverview.map((item) => item.sheetName));
    const reviewRows: ReviewSheetRow[] = parsed.sheetOverview.map((overview, overviewIndex) => {
      const parsedSheet = typeof overview.parsedSheetIndex === "number"
        ? parsed.sheets[overview.parsedSheetIndex] || null
        : sheetByName.get(overview.sheetName) || null;
      const sheetIssues = (issues || []).filter((issue) => issue.sheetName === overview.sheetName);
      const runtimeSummary = parsedSheet
        ? createRuntimeSheetSummary(parsedSheet, sheetIssues)
        : null;
      const errorCount = Math.max(runtimeSummary?.errorCount || 0, overview.errorCount || 0);
      const warningCount = Math.max(runtimeSummary?.warningCount || 0, overview.warningCount || 0);
      let status: ReviewStatus;
      if (overview.eligibility === "unsupported") status = "unsupported";
      else if (overview.eligibility === "preserved") status = "preserved";
      else if (overview.eligibility === "skipped") status = "skipped";
      else if (errorCount > 0) status = "error";
      else if (warningCount > 0 || overview.eligibility === "needsReview") status = "warning";
      else status = "success";

      return {
        key: `${overview.sheetName}-${overviewIndex}`,
        sheetName: overview.sheetName,
        sheet: parsedSheet,
        eligibility: overview.eligibility,
        status,
        rowCount: parsedSheet?.rowCount ?? overview.rowCount,
        headerRow: parsedSheet ? parsedSheet.headerRowIndex + 1 : undefined,
        reason: overview.reason || parsedSheet?.eligibilityReason,
        errorCount,
        warningCount,
      };
    });

    parsed.sheets.forEach((parsedSheet, index) => {
      if (overviewNames.has(parsedSheet.sheetName)) return;
      const sheetIssues = (issues || []).filter((issue) => issue.sheetName === parsedSheet.sheetName);
      const summary = createRuntimeSheetSummary(parsedSheet, sheetIssues);
      reviewRows.push({
        key: `${parsedSheet.sheetName}-parsed-${index}`,
        sheetName: parsedSheet.sheetName,
        sheet: parsedSheet,
        eligibility: parsedSheet.eligibility,
        status: summary.status,
        rowCount: summary.rowCount,
        headerRow: summary.headerRow,
        reason: summary.reason || parsedSheet.eligibilityReason,
        errorCount: summary.errorCount,
        warningCount: summary.warningCount,
      });
    });

    reviewRows.sort((left, right) => (
      REVIEW_STATUS_META[left.status].priority - REVIEW_STATUS_META[right.status].priority
    ));

    const readyCount = reviewRows.filter((row) => row.status === "success").length;
    const attentionCount = reviewRows.filter((row) => (
      row.status === "warning" || row.status === "error" || row.status === "unsupported"
    )).length;
    const selectedReviewRow =
  reviewRows.find((row) => row.key === selectedReviewKey)
  ?? reviewRows.find(
    (row) =>
      row.status === "error"
      || row.status === "warning"
      || row.status === "unsupported",
  )
  ?? reviewRows[0]
  ?? null;
    const totalRows = reviewRows.reduce((sum, row) => sum + row.rowCount, 0);
    const previewRow = previewSheetKey === null
      ? null
      : reviewRows.find((row) => row.key === previewSheetKey) || null;
    const allReady = reviewRows.length > 0 && attentionCount === 0;
    const heading = canContinue ? "ตรวจสอบข้อมูล" : "ตรวจสอบและแก้ไขข้อมูล";
    const description = allReady
      ? "ข้อมูลทุกชีตพร้อมสำหรับดำเนินการ กรุณาตรวจสอบสรุปด้านล่างก่อนดำเนินการต่อ"
      : canContinue
        ? "มีบางชีตที่ต้องตรวจสอบ คุณยังดำเนินการต่อด้วยชีตที่พร้อมได้"
        : "ยังไม่มีชีตพร้อมดำเนินการต่อ กรุณาตรวจสอบรายละเอียดของแต่ละชีต";

    return (
      <section className="review-ready-page">
        <header className="review-ready-heading">
          <h1>{heading}</h1>
          <p>{description}</p>
        </header>

        <div className="review-ready-summary" aria-label="สรุปผลการตรวจสอบ">
          <article className="review-ready-card">
            <span>จำนวนชีตทั้งหมด</span>
            <strong>{reviewRows.length.toLocaleString("th-TH")}</strong>
          </article>
          <article className="review-ready-card success">
            <span>พร้อมใช้งาน</span>
            <strong>
              {readyCount.toLocaleString("th-TH")}
              {readyCount > 0 && <span className="review-ready-check" aria-hidden="true">✓</span>}
            </strong>
          </article>
          <article className="review-ready-card warning">
            <span>ต้องตรวจสอบ</span>
            <strong>{attentionCount.toLocaleString("th-TH")}</strong>
          </article>
          <article className="review-ready-card primary">
            <span>จำนวนรายการทั้งหมด</span>
            <strong>{totalRows.toLocaleString("th-TH")}</strong>
          </article>
        </div>
<div className="review-attention-layout">
  <section
    className="review-attention-sheet-panel"
    aria-labelledby="review-sheet-list-title"
  >
    <h2
      id="review-sheet-list-title"
      className="review-attention-panel-title"
    >
      ชีตที่ตรวจพบ
    </h2>
    
        <div className="review-ready-table-card">
          <div className="review-ready-table-wrap">
            <table className="review-ready-table">
              <thead>
                <tr>
                  <th>ชื่อชีต</th>
                  <th>สถานะ</th>
                  <th>จำนวนรายการ</th>
                  <th>แถวหัวตาราง</th>
                  <th className="review-ready-action-column">ดูข้อมูล</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <span className="review-ready-sheet-name">
                        <span className="review-ready-sheet-icon" aria-hidden="true">▦</span>
                        <span>
                          {row.sheetName}
                          {row.reason && row.status !== "success" && (
                            <small className="review-ready-sheet-reason">{row.reason}</small>
                          )}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`review-ready-status ${row.status}`}>
                        <span aria-hidden="true" />
                        {REVIEW_STATUS_META[row.status].label}
                      </span>
                    </td>
                    <td>{row.rowCount.toLocaleString("th-TH")}</td>
                    <td>{row.headerRow?.toLocaleString("th-TH") || "–"}</td>
                    <td className="review-ready-action-column">
                      <button
                        type="button"
                        className="review-ready-preview-button"
                        aria-label={`ดูรายละเอียดชีต ${row.sheetName}`}
                        onClick={() => {
                          setSelectedReviewKey(row.key);
                          setPreviewSheetKey(row.key);
                        }}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M2.7 12s3.4-6 9.3-6 9.3 6 9.3 6-3.4 6-9.3 6-9.3-6-9.3-6Z" />
                          <circle cx="12" cy="12" r="2.7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

          </section>

  <section
    className="review-attention-detail-panel"
    aria-labelledby="review-problem-title"
  >
    <h2
      id="review-problem-title"
      className="review-attention-panel-title"
    >
      {selectedReviewRow
        ? `รายละเอียด: ${selectedReviewRow.sheetName}`
        : "รายละเอียดปัญหา"}
    </h2>

    {selectedReviewRow ? (
      <div className="review-attention-placeholder">
        <span className={`review-ready-status ${selectedReviewRow.status}`}>
          <span aria-hidden="true" />
          {REVIEW_STATUS_META[selectedReviewRow.status].label}
        </span>

        <p>
          {selectedReviewRow.reason
            || "รายละเอียดของชีตที่เลือกจะแสดงในพื้นที่นี้"}
        </p>
      </div>
    ) : (
      <p className="review-attention-placeholder">
        ไม่พบชีตสำหรับตรวจสอบ
      </p>
    )}
  </section>
</div>

        <div className="review-ready-actions">
          <button type="button" className="review-ready-button secondary" onClick={onBack}>
            กลับไปเลือกไฟล์
          </button>
          <button
            type="button"
            className="review-ready-button primary"
            disabled={loading || !canContinue}
            onClick={onNext}
          >
            {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบอีกครั้งและดำเนินการต่อ"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </div>

        {previewRow && (
          <div
            className="review-preview-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPreviewSheetKey(null);
            }}
          >
            <section
              className="review-preview-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="review-preview-modal-title"
            >
              <header className="review-preview-modal-heading">
                <div>
                  <span>ตัวอย่างข้อมูล</span>
                  <h2 id="review-preview-modal-title">{previewRow.sheetName}</h2>
                </div>
                <button
                  type="button"
                  aria-label="ปิดตัวอย่างข้อมูล"
                  onClick={() => setPreviewSheetKey(null)}
                >
                  ×
                </button>
              </header>
              <div className="review-preview-modal-body">
                {previewRow.sheet ? (
                  <SourcePreviewTable
                    sheet={previewRow.sheet}
                    issues={(issues || []).filter((issue) => issue.sheetName === previewRow.sheetName)}
                    cellOverrides={cellOverrides[previewRow.sheetName] || {}}
                    excludedRows={excludedRows[previewRow.sheetName] || []}
                  />
                ) : (
                  <div className="review-preview-details">
                    <span className={`review-ready-status ${previewRow.status}`}>
                      <span aria-hidden="true" />
                      {REVIEW_STATUS_META[previewRow.status].label}
                    </span>
                    <p>{previewRow.reason || "ไม่มีข้อมูลตัวอย่างสำหรับชีตนี้"}</p>
                  </div>
                )}
              </div>
              <footer className="review-preview-modal-footer">
                <button type="button" onClick={() => setPreviewSheetKey(null)}>ปิด</button>
              </footer>
            </section>
          </div>
        )}
      </section>
    );
  }

  if (!sheet) {
    return (
      <>
        <p className="eyebrow">Sheet overview</p>
        <h2>ไม่พบชีตข้อมูลสินทรัพย์ที่พร้อมแปลง</h2>
        <p className="lead">
          ไม่มีชีตที่ผ่านนโยบายสำหรับ Validate หรือ Export ในไฟล์นี้
        </p>
        <div className="empty-export-message">
          ไฟล์ผลลัพธ์สร้างจากชีตข้อมูลรายสินทรัพย์ที่แปลงเข้า Template ได้เท่านั้น ชีตสรุปที่อ้างอิงยอดซ้ำและชีตที่ไม่ใช่ข้อมูลสินทรัพย์จะไม่ถูกนำไปใส่ในไฟล์ผลลัพธ์
        </div>
        <div className="actions">
          <button className="btn secondary" onClick={onBack}>← ย้อนกลับ</button>
          <button className="btn amber" disabled>ไม่มีชีตที่พร้อม Export</button>
        </div>
      </>
    );
  }

  const sheetMap = mappingState[sheet.sheetName] || {};
  const sheetCellOverrides = cellOverrides[sheet.sheetName] || {};
  const sheetExcludedRows = excludedRows[sheet.sheetName] || [];
  const editedCellCount = Object.values(sheetCellOverrides)
    .reduce((sum, row) => sum + Object.keys(row).length, 0);
  const hasSheetFixes = editedCellCount > 0 || sheetExcludedRows.length > 0;
  const isPreservedSheet = sheet.eligibility === "preserved";
  const sheetIssues = (issues || []).filter((issue) => issue.sheetName === sheet.sheetName);
  const currentSummary = createRuntimeSheetSummary(sheet, sheetIssues);
  const { referenceIssues: currentReferenceIssues } = splitIssuesByReferenceMismatch(sheetIssues);
  const visibleMappings: VisibleMapping[] = sheet.mapping
    .map((mapping, index) => {
      const autoSourceColumn = mapping.sourceColumn;
      const manualSource = sheetMap[mapping.templateColumn];
      const isManual = hasManualOverride(sheetMap, mapping.templateColumn);
      return {
        ...mapping,
        autoSourceColumn,
        sourceColumn: isManual ? manualSource : mapping.sourceColumn,
        status: isManual ? ("manual" as const) : mapping.status,
        confidence: isManual ? ("high" as const) : mapping.confidence,
        originalIndex: index,
      };
    })
    .sort((a, b) => {
      // Keep both regular Auto mappings and parser-managed authoritative
      // fields (e.g. รายละเอียด/ชนิดสินทรัพย์) at the top of the editor.
      const aIsMapped = Boolean(a.sourceColumn) || PARSER_MANAGED_TEMPLATE_COLUMNS.has(a.templateColumn);
      const bIsMapped = Boolean(b.sourceColumn) || PARSER_MANAGED_TEMPLATE_COLUMNS.has(b.templateColumn);
      if (aIsMapped === bIsMapped) return a.originalIndex - b.originalIndex;
      return aIsMapped ? -1 : 1;
    });

  return (
    <>
      <p className="eyebrow">Auto mapping default</p>
      <h2>ตรวจสอบชีต พรีวิว และผล Validation</h2>
      <p className="lead">
        พบทั้งหมด {parsed.sheetOverview.length} ชีต และอ่านเป็น datasource ได้ {parsed.sheets.length} ชีต
        ระบบจะตรวจสอบและส่งออกทุกชีตที่มีข้อมูลโดยอัตโนมัติ สามารถแก้ mapping เฉพาะกรณีที่จำเป็นได้จาก Advanced Mapping
      </p>

      {/* <FileOverviewPanel
        sheets={parsed.sheets}
        preservedSheetSummaries={parsed.preservedSheetSummaries}
        skippedSheetSummaries={parsed.skippedSheetSummaries}
        issues={issues}
        activeSheetIdx={activeSheetIdx}
        onSelectSheet={setActiveSheetIdx}
      /> */}

      <SheetTabs
        sheets={parsed.sheets}
        preservedSheetSummaries={parsed.preservedSheetSummaries}
        skippedSheetSummaries={parsed.skippedSheetSummaries}
        activeSheetIdx={activeSheetIdx}
        issues={issues}
        onSelectSheet={setActiveSheetIdx}
      />

      <SheetSummaryPanel
        summary={currentSummary}
        mappedCount={mappedCountForSheet(sheet.sheetName)}
        eligibility={sheet.eligibility}
        eligibilityReason={sheet.eligibilityReason}
        referenceWarningCount={currentReferenceIssues.length}
      />


      {!isPreservedSheet && hasSheetFixes && (
        <div className="fix-toolbar">
          <span>
            แก้ไขแล้ว {editedCellCount} ช่อง · ตัดออก {sheetExcludedRows.length} แถว
          </span>
          <button type="button" className="map-reset" onClick={() => resetSheetFixes(sheet.sheetName)}>
            ล้างการแก้ไขทั้งหมด
          </button>
        </div>
      )}

      <SourcePreviewTable
        sheet={sheet}
        issues={sheetIssues}
        cellOverrides={sheetCellOverrides}
        excludedRows={sheetExcludedRows}
        onToggleExcludedRow={isPreservedSheet
          ? undefined
          : (rowIndex) => toggleExcludedRow(sheet.sheetName, rowIndex)}
      />

      {isPreservedSheet ? (
        <div className="empty-export-message">
          ชีตนี้มีข้อมูลและจะถูกเก็บในไฟล์ผลลัพธ์ตามต้นฉบับ ระบบไม่ทำ Auto Mapping {TEMPLATE_COLUMNS.length} คอลัมน์เพราะโครงสร้างไม่ใช่รายการสินทรัพย์รายชิ้น
        </div>
      ) : (
        <MappingSummary
          sheet={sheet}
          sheetMap={sheetMap}
          visibleMappings={visibleMappings}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          updateMapping={updateMapping}
        />
      )}

      {!isPreservedSheet && <h3>ผลการตรวจสอบข้อมูล</h3>}
      {!isPreservedSheet && resultsStale && (
        <div className="stale-banner">
          มีการแก้ไขหลังการตรวจสอบล่าสุด {issues === null ? "" : "ผลด้านล่างเป็นของก่อนแก้ไข "}
          กด &quot;ตรวจสอบชีตที่เลือกและไป Export&quot; เพื่ออัปเดตผลล่าสุด
        </div>
      )}
      {!isPreservedSheet && issueSummary && (
        <div className="summary-grid small">
          <div className="summary-card">
            <div className="num">{issueSummary.totalRows}</div>
            <div className="label">แถวทั้งหมด</div>
          </div>
          <div className={`summary-card ${issueSummary.errorCount > 0 ? "error" : "ok"}`}>
            <div className="num">{issueSummary.errorCount}</div>
            <div className="label">ข้อผิดพลาด</div>
          </div>
          <div className="summary-card">
            <div className="num">{issueSummary.warningCount}</div>
            <div className="label">คำเตือน</div>
          </div>
        </div>
      )}
      {!isPreservedSheet && issues !== null && (
        <IssueList
          issues={sheetIssues}
          emptyText="ชีตนี้ไม่พบปัญหา พร้อม export ได้"
          cellOverrides={sheetCellOverrides}
          excludedRows={sheetExcludedRows}
          onCellOverride={(rowIndex, templateColumn, value) =>
            updateCellOverride(sheet.sheetName, rowIndex, templateColumn, value)}
          onToggleExcludedRow={(rowIndex) => toggleExcludedRow(sheet.sheetName, rowIndex)}
        />
      )}

      <div className="actions">
        <button className="btn secondary" onClick={onBack}>
          ← ย้อนกลับ
        </button>
        <button className="btn amber" disabled={loading || !canContinue} onClick={onNext}>
          {loading
            ? "กำลังตรวจสอบ..."
            : canContinue
              ? "ตรวจสอบชีตที่เลือกและไป Export →"
              : "ไม่มีชีตที่พร้อม Export"}
        </button>
      </div>
    </>
  );
}

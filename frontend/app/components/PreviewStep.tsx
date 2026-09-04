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

function buildVisibleMappings(sheet: SheetData, sheetMap: ManualMapping): VisibleMapping[] {
  return sheet.mapping
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
      const aIsMapped = Boolean(a.sourceColumn) || PARSER_MANAGED_TEMPLATE_COLUMNS.has(a.templateColumn);
      const bIsMapped = Boolean(b.sourceColumn) || PARSER_MANAGED_TEMPLATE_COLUMNS.has(b.templateColumn);
      if (aIsMapped === bIsMapped) return a.originalIndex - b.originalIndex;
      return aIsMapped ? -1 : 1;
    });
}

function reviewStatusGuidance(row: ReviewSheetRow): string {
  if (row.status === "error") {
    return "แก้ไขข้อผิดพลาดด้านล่าง แล้วตรวจสอบข้อมูลอีกครั้ง ระบบจะไม่ส่งออกชีตนี้จนกว่าข้อผิดพลาดจะถูกแก้ไข";
  }
  if (row.status === "warning") {
    return "ตรวจสอบคำเตือนและการจับคู่คอลัมน์ด้านล่าง หากข้อมูลถูกต้อง คุณยังดำเนินการต่อด้วยชีตที่พร้อมใช้งานได้";
  }
  if (row.status === "unsupported") {
    return "ระบบยังไม่รองรับโครงสร้างของชีตนี้ ชีตนี้จึงไม่รวมอยู่ในการส่งออกครั้งนี้";
  }
  if (row.status === "preserved") {
    return "ชีตนี้ไม่ใช่ข้อมูลสินทรัพย์รายชิ้น ระบบจะเก็บชีตต้นฉบับไว้ในไฟล์ผลลัพธ์โดยไม่ทำ Mapping";
  }
  if (row.status === "skipped") {
    return "ระบบข้ามชีตนี้เพราะไม่มีข้อมูลสินทรัพย์ที่ต้องแปลง ชีตนี้จะไม่รวมอยู่ในไฟล์ผลลัพธ์";
  }
  return "ชีตนี้ผ่านการตรวจสอบและพร้อมรวมอยู่ในไฟล์ผลลัพธ์";
}

function reviewIssueLabel(row: ReviewSheetRow): string {
  const labels: string[] = [];
  if (row.errorCount > 0) labels.push(`${row.errorCount.toLocaleString("th-TH")} ข้อผิดพลาด`);
  if (row.warningCount > 0) labels.push(`${row.warningCount.toLocaleString("th-TH")} คำเตือน`);
  if (labels.length > 0) return labels.join(" · ");
  if (row.status === "preserved") return "เก็บชีตต้นฉบับ";
  if (row.status === "skipped") return "ไม่รวมในการส่งออก";
  if (row.status === "unsupported") return "รูปแบบยังไม่รองรับ";
  return "ไม่พบปัญหา";
}

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
        (row) => row.status === "error" || row.status === "warning" || row.status === "unsupported",
      )
      ?? reviewRows[0]
      ?? null;
    const totalRows = reviewRows.reduce((sum, row) => sum + row.rowCount, 0);
    const previewRow = previewSheetKey === null
      ? null
      : reviewRows.find((row) => row.key === previewSheetKey) || null;
    const allReady = reviewRows.length > 0 && attentionCount === 0 && canContinue;
    const heading = canContinue ? "ตรวจสอบข้อมูล" : "ตรวจสอบและแก้ไขข้อมูล";
    const description = allReady
      ? "ข้อมูลทุกชีตพร้อมสำหรับดำเนินการ กรุณาตรวจสอบสรุปด้านล่างก่อนดำเนินการต่อ"
      : canContinue
        ? "มีบางชีตที่ต้องตรวจสอบ คุณยังดำเนินการต่อด้วยชีตที่พร้อมได้"
        : "ยังไม่มีชีตพร้อมดำเนินการต่อ กรุณาตรวจสอบรายละเอียดของแต่ละชีต";
    const selectedSheet = selectedReviewRow?.sheet || null;
    const selectedIssues = selectedReviewRow
      ? (issues || []).filter((issue) => issue.sheetName === selectedReviewRow.sheetName)
      : [];
    const selectedSheetMap = selectedSheet ? mappingState[selectedSheet.sheetName] || {} : {};
    const selectedCellOverrides = selectedSheet ? cellOverrides[selectedSheet.sheetName] || {} : {};
    const selectedExcludedRows = selectedSheet ? excludedRows[selectedSheet.sheetName] || [] : [];
    const selectedEditedCellCount = Object.values(selectedCellOverrides)
      .reduce((sum, row) => sum + Object.keys(row).length, 0);
    const selectedHasFixes = selectedEditedCellCount > 0 || selectedExcludedRows.length > 0;
    const selectedCanEdit = Boolean(
      selectedSheet
      && (selectedReviewRow?.eligibility === "exportable" || selectedReviewRow?.eligibility === "needsReview"),
    );
    const selectedMappings = selectedSheet && selectedCanEdit
      ? buildVisibleMappings(selectedSheet, selectedSheetMap)
      : [];

    const selectReviewRow = (row: ReviewSheetRow) => {
      setSelectedReviewKey(row.key);
      if (row.sheet) {
        const parsedIndex = parsed.sheets.indexOf(row.sheet);
        if (parsedIndex >= 0) setActiveSheetIdx(parsedIndex);
      }
    };

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
            <div className="review-attention-panel-heading">
              <h2 id="review-sheet-list-title" className="review-attention-panel-title">
                ชีตที่ตรวจพบ
              </h2>
              <span>{reviewRows.length.toLocaleString("th-TH")} ชีต</span>
            </div>

            {reviewRows.length > 0 ? (
              <ul className="review-sheet-list">
                {reviewRows.map((row) => {
                  const selected = selectedReviewRow?.key === row.key;
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        className={`review-sheet-option ${row.status}${selected ? " selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => selectReviewRow(row)}
                      >
                        <span className="review-sheet-option-topline">
                          <span className="review-ready-sheet-name">
                            <span className="review-ready-sheet-icon" aria-hidden="true">▦</span>
                            <span>{row.sheetName}</span>
                          </span>
                          <span className={`review-ready-status ${row.status}`}>
                            <span aria-hidden="true" />
                            {REVIEW_STATUS_META[row.status].label}
                          </span>
                        </span>
                        <span className="review-sheet-option-meta">
                          <span>{row.rowCount.toLocaleString("th-TH")} รายการ</span>
                          <span>แถวหัวตาราง {row.headerRow?.toLocaleString("th-TH") || "–"}</span>
                        </span>
                        <span className={`review-sheet-option-issues ${row.status}`}>
                          {reviewIssueLabel(row)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="review-empty-state">
                <strong>ไม่พบชีตในไฟล์นี้</strong>
                <p>ย้อนกลับไปเลือกไฟล์ Excel ที่มีข้อมูลอย่างน้อยหนึ่งชีต</p>
              </div>
            )}
          </section>

          <section
            className="review-attention-detail-panel"
            aria-labelledby="review-problem-title"
          >
            {selectedReviewRow ? (
              <>
                <header className="review-detail-heading">
                  <div>
                    <span className="review-detail-eyebrow">รายละเอียดชีต</span>
                    <h2 id="review-problem-title">{selectedReviewRow.sheetName}</h2>
                  </div>
                  <span className={`review-ready-status ${selectedReviewRow.status}`}>
                    <span aria-hidden="true" />
                    {REVIEW_STATUS_META[selectedReviewRow.status].label}
                  </span>
                </header>

                <div className="review-detail-metrics" aria-label="สรุปสถานะชีตที่เลือก">
                  <div><strong>{selectedReviewRow.rowCount.toLocaleString("th-TH")}</strong><span>รายการ</span></div>
                  <div><strong>{selectedReviewRow.errorCount.toLocaleString("th-TH")}</strong><span>ข้อผิดพลาด</span></div>
                  <div><strong>{selectedReviewRow.warningCount.toLocaleString("th-TH")}</strong><span>คำเตือน</span></div>
                </div>

                <div className={`review-status-guidance ${selectedReviewRow.status}`}>
                  <strong>{selectedReviewRow.reason || REVIEW_STATUS_META[selectedReviewRow.status].label}</strong>
                  <p>{reviewStatusGuidance(selectedReviewRow)}</p>
                </div>

                {selectedSheet ? (
                  <>
                    <div className="review-detail-toolbar">
                      <button
                        type="button"
                        className="review-ready-button secondary"
                        onClick={() => setPreviewSheetKey(selectedReviewRow.key)}
                      >
                        ดูตัวอย่างข้อมูล
                      </button>
                      {selectedCanEdit && selectedHasFixes && (
                        <button
                          type="button"
                          className="review-text-button"
                          onClick={() => resetSheetFixes(selectedSheet.sheetName)}
                        >
                          ล้างการแก้ไข {selectedEditedCellCount.toLocaleString("th-TH")} ช่อง
                          {selectedExcludedRows.length > 0
                            ? ` และคืน ${selectedExcludedRows.length.toLocaleString("th-TH")} แถว`
                            : ""}
                        </button>
                      )}
                    </div>

                    {selectedCanEdit ? (
                      <>
                        <section className="review-detail-section" aria-labelledby="review-issues-title">
                          <h3 id="review-issues-title">ผลการตรวจสอบและการแก้ไข</h3>
                          {resultsStale && (
                            <div className="stale-banner">
                              มีการแก้ไขหลังการตรวจสอบล่าสุด กดตรวจสอบอีกครั้งเพื่ออัปเดตผล
                            </div>
                          )}
                          {issues === null ? (
                            <div className="review-inline-info">
                              ยังไม่มีผล Validation แบบรายแถว ตรวจสอบ Preview และ Mapping ก่อนกดดำเนินการต่อ
                            </div>
                          ) : (
                            <IssueList
                              issues={selectedIssues}
                              emptyText="ชีตนี้ไม่พบปัญหา พร้อมส่งออกได้"
                              cellOverrides={selectedCellOverrides}
                              excludedRows={selectedExcludedRows}
                              onCellOverride={(rowIndex, templateColumn, value) =>
                                updateCellOverride(selectedSheet.sheetName, rowIndex, templateColumn, value)}
                              onToggleExcludedRow={(rowIndex) =>
                                toggleExcludedRow(selectedSheet.sheetName, rowIndex)}
                            />
                          )}
                        </section>

                        <section className="review-detail-section review-mapping-section" aria-label="การจับคู่คอลัมน์">
                          <MappingSummary
                            key={selectedSheet.sheetName}
                            sheet={selectedSheet}
                            sheetMap={selectedSheetMap}
                            visibleMappings={selectedMappings}
                            advancedOpen={advancedOpen}
                            setAdvancedOpen={setAdvancedOpen}
                            updateMapping={updateMapping}
                          />
                        </section>
                      </>
                    ) : (
                      <div className="review-inline-info">
                        ชีตสถานะ {REVIEW_STATUS_META[selectedReviewRow.status].label} เปิดดูข้อมูลได้ แต่ไม่มีเครื่องมือแก้ไข Mapping
                      </div>
                    )}
                  </>
                ) : (
                  <div className="review-empty-state compact">
                    <strong>ไม่มีข้อมูล Preview สำหรับชีตนี้</strong>
                    <p>{reviewStatusGuidance(selectedReviewRow)}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="review-empty-state compact">
                <h2 id="review-problem-title">ยังไม่มีชีตให้ตรวจสอบ</h2>
                <p>ย้อนกลับไปเลือกไฟล์ Excel ใหม่เพื่อเริ่มต้นอีกครั้ง</p>
              </div>
            )}
          </section>
        </div>

        <div className="review-ready-actions">
          <button type="button" className="review-ready-button secondary" onClick={onBack}>
            กลับไปเลือกไฟล์
          </button>
          <div className="review-continue-group">
            {!canContinue && (
              <p id="review-continue-help">ยังไม่มีชีตที่พร้อมส่งออก กรุณาแก้ไขข้อผิดพลาดหรือเลือกไฟล์ใหม่</p>
            )}
            <button
              type="button"
              className="review-ready-button primary"
              disabled={loading || !canContinue}
              aria-describedby={!canContinue ? "review-continue-help" : undefined}
              onClick={onNext}
            >
              {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบอีกครั้งและไปหน้าดาวน์โหลด"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </div>
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
                    onToggleExcludedRow={previewRow.eligibility === "exportable" || previewRow.eligibility === "needsReview"
                      ? (rowIndex) => toggleExcludedRow(previewRow.sheetName, rowIndex)
                      : undefined}
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
  const visibleMappings = buildVisibleMappings(sheet, sheetMap);

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

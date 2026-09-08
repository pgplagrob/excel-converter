"use client";

import { useEffect, useMemo, useState } from "react";
import { TEMPLATE_COLUMNS } from "@/lib/mapping";
import type { IssueSummary, ParseResponse, TransformedSheetPreview, ValidationIssue } from "@/lib/client-types";
import { displayIssueMessage, issueSeverityLabel } from "./display";

interface DownloadStepProps {
  parsed: ParseResponse;
  issues: ValidationIssue[] | null;
  issueSummary: IssueSummary | null;
  transformedSheets: TransformedSheetPreview[];
  onBack: () => void;
  onDownload: (sheetNames: string[]) => void;
  onReset: () => void;
  loading: boolean;
  error?: string | null;
}

export function DownloadStep({
  parsed,
  issues,
  issueSummary,
  transformedSheets,
  onBack,
  onDownload,
  onReset,
  loading,
  error,
}: DownloadStepProps) {
  const [previewSheetName, setPreviewSheetName] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSelection, setExportSelection] = useState<Record<string, boolean>>({});

  const availableSheets = useMemo(() => {
    const sheetsWithErrors = new Set(
      (issues || [])
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.sheetName),
    );
    return transformedSheets.filter(
      (sheet) => sheet.rowCount > 0 && !sheetsWithErrors.has(sheet.sheetName),
    );
  }, [issues, transformedSheets]);

  const selectedExportCount = availableSheets.filter(
    (sheet) => exportSelection[sheet.sheetName],
  ).length;

  const openExportDialog = () => {
    setExportSelection(Object.fromEntries(
      availableSheets.map((sheet) => [sheet.sheetName, true]),
    ));
    setExportDialogOpen(true);
  };

  const confirmExport = () => {
    const selectedNames = availableSheets
      .filter((sheet) => exportSelection[sheet.sheetName])
      .map((sheet) => sheet.sheetName);
    if (selectedNames.length === 0) return;
    setExportDialogOpen(false);
    onDownload(selectedNames);
  };

  useEffect(() => {
    if (!transformedSheets.some((sheet) => sheet.sheetName === previewSheetName)) {
      setPreviewSheetName(transformedSheets[0]?.sheetName || "");
    }
  }, [previewSheetName, transformedSheets]);

  useEffect(() => {
    if (!exportDialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [exportDialogOpen]);

  const previewSheet = transformedSheets.find((sheet) => sheet.sheetName === previewSheetName)
    || transformedSheets[0];
  const previewRows = previewSheet?.sampleRows || [];
  const previewColumns = previewRows.length > 0 ? Object.keys(previewRows[0]) : TEMPLATE_COLUMNS;
  const processedRowCount = availableSheets.reduce((total, sheet) => total + sheet.rowCount, 0);
  const hasErrors = (issueSummary?.errorCount || 0) > 0;
  const hasWarnings = (issueSummary?.warningCount || 0) > 0;

  return (
    <div className="upload-shell download-ready-shell">
      <header className="upload-topbar download-topbar">
        <div className="upload-topbar-inner">
          <a className="upload-product-name download-mobile-product-name" href="/">
            Excel Converter
          </a>
          <nav className="upload-topnav" aria-label="เมนูหลัก">
            <a className="active" href="/">Main Converter</a>
            <a href="/settings">ตั้งค่าเทมเพลต</a>
            <span>ช่วยเหลือ</span>
            <span className="download-avatar" aria-hidden="true">EC</span>
          </nav>
        </div>
      </header>

      <aside className="upload-sidebar download-sidebar">
        <div className="upload-sidebar-heading">
          <strong>Excel Converter</strong>
          <span>3-Step Process</span>
        </div>
        <nav aria-label="ขั้นตอนการแปลงไฟล์">
          <button className="upload-sidebar-step download-sidebar-button done" type="button" onClick={onReset}>
            <span className="upload-sidebar-icon">⇧</span>
            <span>อัปโหลด</span>
          </button>
          <button className="upload-sidebar-step download-sidebar-button done" type="button" onClick={onBack}>
            <span className="upload-sidebar-icon">✓</span>
            <span>ตรวจสอบ</span>
          </button>
          <div className="upload-sidebar-step active" aria-current="step">
            <span className="upload-sidebar-icon">↓</span>
            <span>ดาวน์โหลด</span>
          </div>
        </nav>
        <nav className="download-sidebar-footer" aria-label="เมนูเพิ่มเติม">
          <a className="upload-sidebar-step" href="/settings">
            <span className="upload-sidebar-icon">⚙</span>
            <span>ตั้งค่าเทมเพลต</span>
          </a>
          <span className="upload-sidebar-step">
            <span className="upload-sidebar-icon">?</span>
            <span>ช่วยเหลือ</span>
          </span>
        </nav>
      </aside>

      <main className="upload-main download-main">
        <div className="upload-main-inner download-main-inner">
          <div className="upload-progress download-progress" aria-label="ขั้นตอนที่ 3 จาก 3">
            <div className="upload-progress-line" />
            <div className="upload-progress-step done">
              <span className="upload-progress-number">✓</span>
              <span>อัปโหลด</span>
            </div>
            <div className="upload-progress-step done">
              <span className="upload-progress-number">✓</span>
              <span>ตรวจสอบ</span>
            </div>
            <div className="upload-progress-step active">
              <span className="upload-progress-number">3</span>
              <span>ดาวน์โหลด</span>
            </div>
          </div>

          {error && <div className="download-shell-error" role="alert">{error}</div>}
          {loading && (
            <div className="download-shell-loading" aria-label="กำลังสร้างไฟล์">
              <span />
            </div>
          )}

          <div className="download-page">
            <header className="download-page-heading">
              <p className="eyebrow">ขั้นตอนที่ 3 จาก 3</p>
              <h1>ไฟล์ของคุณพร้อมแล้ว</h1>
              <p>ระบบตรวจสอบและจัดรูปแบบข้อมูลเรียบร้อยแล้ว</p>
            </header>

            <div className="download-bento-grid">
              <div className="download-primary-column">
                <section className="download-action-card">
                  <div className="download-action-decoration" aria-hidden="true" />
                  <div className="download-action-content">
                    <div className="download-ready-icon" aria-hidden="true">✓</div>
                    <h2>ดาวน์โหลดข้อมูลที่แปลงแล้ว</h2>
                    <button
                      className="download-primary-action"
                      disabled={loading || availableSheets.length === 0}
                      onClick={openExportDialog}
                    >
                      <span aria-hidden="true">↓</span>
                      {loading
                        ? "กำลังสร้างไฟล์..."
                        : availableSheets.length > 0
                          ? "เลือกชีตและดาวน์โหลดไฟล์"
                          : "ไม่มีชีตที่พร้อม Export"}
                    </button>
                    <div className="download-secondary-actions">
                      <button type="button" className="download-secondary-button" onClick={onBack}>
                        <span aria-hidden="true">←</span>
                        กลับไปตรวจสอบข้อมูล
                      </button>
                      <button type="button" className="download-reset-button" onClick={onReset}>
                        <span aria-hidden="true">↻</span>
                        แปลงไฟล์อื่น
                      </button>
                    </div>
                  </div>
                </section>

                <section className="download-preview-card">
                  <div className="download-preview-heading">
                    <div>
                      <h3>ตัวอย่างข้อมูล{previewSheet ? ` (${previewSheet.sheetName})` : ""}</h3>
                      {previewSheet && (
                        <p className="download-preview-hint">
                          แสดง {previewRows.length} แถวตัวอย่างแรกจากทั้งหมด {previewSheet.rowCount.toLocaleString("th-TH")} แถว
                        </p>
                      )}
                    </div>
                    {transformedSheets.length > 0 && (
                      <label className="download-preview-selector">
                        <span>เลือกชีต</span>
                        <select
                          value={previewSheet?.sheetName || ""}
                          onChange={(event) => setPreviewSheetName(event.target.value)}
                        >
                          {transformedSheets.map((sheet) => (
                            <option key={sheet.sheetName} value={sheet.sheetName}>
                              {sheet.sheetName} ({sheet.rowCount.toLocaleString("th-TH")} แถว)
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {previewSheet ? (
                    <div className="table-wrap download-preview-table-wrap">
                      <table className="download-preview-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            {previewColumns.map((column) => <th key={column}>{column}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.length > 0 ? previewRows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              <td>{rowIndex + 1}</td>
                              {previewColumns.map((column) => {
                                const value = row[column];
                                return (
                                  <td key={column} title={value === undefined || value === null ? "" : String(value)}>
                                    {value === undefined || value === null || value === "" ? "—" : String(value)}
                                  </td>
                                );
                              })}
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={previewColumns.length + 1} className="muted-text">ไม่มีข้อมูลในชีตนี้</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="download-preview-empty">ยังไม่มีข้อมูล Preview สำหรับแสดง</div>
                  )}
                </section>

                {issues && issues.length > 0 && (
                  <section className="download-issues-section">
                    <h3>รายการที่ควรตรวจสอบ</h3>
                    <div className="issue-list">
                      {issues.slice(0, 200).map((issue, idx) => (
                        <div className={`issue-row ${issue.severity}`} key={idx}>
                          <span className="tag">{issueSeverityLabel(issue.severity)}</span>
                          <span>
                            <strong>{issue.sheetName}</strong> แถวที่ {issue.rowIndex + 1}:{" "}
                            {displayIssueMessage(issue.message)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="download-summary-card">
                <h2><span aria-hidden="true">▥</span> สรุปข้อมูล</h2>
                <dl>
                  <div>
                    <dt>Source file</dt>
                    <dd className="download-source-name"><span aria-hidden="true">▧</span>{parsed.fileName}</dd>
                  </div>
                  <div>
                    <dt>พร้อมใช้งาน</dt>
                    <dd><strong>{availableSheets.length.toLocaleString("th-TH")}</strong> ชีต</dd>
                  </div>
                  <div>
                    <dt>จำนวนรายการที่ประมวลผล</dt>
                    <dd><strong>{processedRowCount.toLocaleString("th-TH")}</strong> รายการ</dd>
                  </div>
                </dl>
                <div className={`download-status-card ${hasErrors ? "error" : hasWarnings ? "warning" : "success"}`}>
                  <span className="download-status-icon" aria-hidden="true">
                    {hasErrors ? "!" : hasWarnings ? "!" : "✓"}
                  </span>
                  <div>
                    <strong>
                      {hasErrors ? "สถานะ: มีข้อผิดพลาด" : hasWarnings ? "สถานะ: มีคำเตือน" : "สถานะ: สมบูรณ์"}
                    </strong>
                    <p>
                      {hasErrors
                        ? `พบ ${issueSummary?.errorCount.toLocaleString("th-TH")} ข้อผิดพลาดที่ต้องแก้ไข`
                        : hasWarnings
                          ? `พร้อมส่งออก โดยมี ${issueSummary?.warningCount.toLocaleString("th-TH")} คำเตือน`
                          : "ไม่พบข้อผิดพลาดระหว่างการจัดรูปแบบข้อมูล"}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>

      {exportDialogOpen && (
        <div
          className="export-dialog-backdrop"
          role="presentation"
          onClick={() => setExportDialogOpen(false)}
        >
          <section
            className="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="export-dialog-heading">
              <div>
                <p className="eyebrow">ขั้นตอนสุดท้าย</p>
                <h3 id="export-dialog-title">เลือกชีตที่ต้องการแปลง</h3>
                <p>เลือกได้มากกว่า 1 ชีต ระบบจะรวมไว้ในไฟล์เดียวกัน</p>
              </div>
              <button
                type="button"
                className="export-dialog-close"
                aria-label="ยกเลิกและปิดหน้าต่าง"
                onClick={() => setExportDialogOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="export-dialog-toolbar">
              <strong>เลือกแล้ว {selectedExportCount} จาก {availableSheets.length} ชีต</strong>
              <div>
                <button
                  type="button"
                  onClick={() => setExportSelection(Object.fromEntries(
                    availableSheets.map((sheet) => [sheet.sheetName, true]),
                  ))}
                >
                  เลือกทั้งหมด
                </button>
                <button type="button" onClick={() => setExportSelection({})}>
                  ล้างทั้งหมด
                </button>
              </div>
            </div>

            <div className="export-sheet-options">
              {availableSheets.map((sheet) => (
                <label className="export-sheet-option" key={sheet.sheetName}>
                  <input
                    type="checkbox"
                    checked={exportSelection[sheet.sheetName] === true}
                    onChange={(event) => setExportSelection((current) => ({
                      ...current,
                      [sheet.sheetName]: event.target.checked,
                    }))}
                  />
                  <span>
                    <strong>{sheet.sheetName}</strong>
                    <small>{sheet.rowCount.toLocaleString("th-TH")} แถว</small>
                  </span>
                </label>
              ))}
            </div>

            {selectedExportCount === 0 && (
              <p className="export-dialog-warning">กรุณาเลือกอย่างน้อย 1 ชีต</p>
            )}

            <div className="export-dialog-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={loading}
                onClick={() => setExportDialogOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn amber"
                disabled={loading || selectedExportCount === 0}
                onClick={confirmExport}
              >
                แปลงและดาวน์โหลด {selectedExportCount} ชีต
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

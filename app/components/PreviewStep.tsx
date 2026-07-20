"use client";

import type {
  CellOverridesBySheet,
  ExcludedRowsBySheet,
  IssueSummary,
  MappingSuggestion,
  ParseResponse,
  ValidationIssue,
} from "@/lib/client-types";
import { hasManualOverride, type ManualMapping } from "@/lib/manual-mapping";
import { TEMPLATE_COLUMNS } from "@/lib/mapping";
import { createRuntimeSheetSummary } from "./display";
import { IssueList } from "./IssueList";
import { MappingSummary } from "./MappingSummary";
import { SheetSummaryPanel } from "./SheetSummaryPanel";
import { SheetTabs } from "./SheetTabs";
import { SourcePreviewTable } from "./SourcePreviewTable";

interface PreviewStepProps {
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

type VisibleMapping = MappingSuggestion & { originalIndex: number };

export function PreviewStep({
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
  const sheet = parsed.sheets[activeSheetIdx];
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
  const visibleMappings: VisibleMapping[] = sheet.mapping
    .map((mapping, index) => {
      const manualSource = sheetMap[mapping.templateColumn];
      const isManual = hasManualOverride(sheetMap, mapping.templateColumn);
      return {
        ...mapping,
        sourceColumn: isManual ? manualSource : mapping.sourceColumn,
        status: isManual ? ("manual" as const) : mapping.status,
        confidence: isManual ? ("high" as const) : mapping.confidence,
        originalIndex: index,
      };
    })
    .sort((a, b) => {
      const aIsMapped = Boolean(a.sourceColumn);
      const bIsMapped = Boolean(b.sourceColumn);
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

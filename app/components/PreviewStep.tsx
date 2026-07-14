"use client";

import type {
  IssueSummary,
  MappingSuggestion,
  ParseResponse,
  ValidationIssue,
} from "@/lib/client-types";
import type { SheetSelection } from "@/lib/sheet-selection";
import { createRuntimeSheetSummary } from "./display";
import { IssueList } from "./IssueList";
import { MappingSummary } from "./MappingSummary";
import { SheetSummaryPanel } from "./SheetSummaryPanel";
import { SheetSelectionOverview } from "./SheetSelectionOverview";
import { SheetTabs } from "./SheetTabs";
import { SourcePreviewTable } from "./SourcePreviewTable";

interface PreviewStepProps {
  parsed: ParseResponse;
  activeSheetIdx: number;
  setActiveSheetIdx: (index: number) => void;
  mappingState: Record<string, Record<string, string>>;
  updateMapping: (sheetName: string, templateColumn: string, sourceColumn: string) => void;
  mappedCountForSheet: (sheetName: string) => number;
  sheetSelection: SheetSelection;
  updateSheetSelection: (sheetName: string, selected: boolean) => void;
  issues: ValidationIssue[] | null;
  issueSummary: IssueSummary | null;
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
  updateMapping,
  mappedCountForSheet,
  sheetSelection,
  updateSheetSelection,
  issues,
  issueSummary,
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
          ระบบแสดงผลการจำแนกทุกชีตไว้ด้านล่าง แต่ไม่มีชีตที่ผ่านนโยบายสำหรับ Validate หรือ Export
        </p>
        <SheetSelectionOverview
          sheets={parsed.sheetOverview}
          selection={sheetSelection}
          onToggle={updateSheetSelection}
          onOpenSheet={setActiveSheetIdx}
        />
        <div className="empty-export-message">
          UNKNOWN, help/template/summary และ maintenance จะไม่ถูก Export อัตโนมัติ กรุณาตรวจไฟล์ต้นทางหรือเพิ่ม parser ที่รองรับก่อน
        </div>
        <div className="actions">
          <button className="btn secondary" onClick={onBack}>← ย้อนกลับ</button>
          <button className="btn amber" disabled>ไม่มีชีตที่พร้อม Export</button>
        </div>
      </>
    );
  }
  const sheetMap = mappingState[sheet.sheetName] || {};
  const sheetIssues = (issues || []).filter((issue) => issue.sheetName === sheet.sheetName);
  const currentSummary = createRuntimeSheetSummary(sheet, sheetIssues);
  const visibleMappings: VisibleMapping[] = sheet.mapping
    .map((mapping, index) => {
      const manualSource = sheetMap[mapping.templateColumn];
      return {
        ...mapping,
        sourceColumn: manualSource !== undefined ? manualSource || null : mapping.sourceColumn,
        status: manualSource !== undefined ? ("manual" as const) : mapping.status,
        confidence: manualSource !== undefined ? ("high" as const) : mapping.confidence,
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
        ระบบจะตรวจสอบและส่งออกเฉพาะชีตที่เลือกด้านล่าง สามารถแก้ mapping เฉพาะกรณีที่จำเป็นได้จาก Advanced Mapping
      </p>

      <SheetSelectionOverview
        sheets={parsed.sheetOverview}
        selection={sheetSelection}
        onToggle={updateSheetSelection}
        onOpenSheet={setActiveSheetIdx}
      />

      <SheetTabs
        sheets={parsed.sheets}
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
        confidence={sheet.confidence}
      />

      <SourcePreviewTable sheet={sheet} issues={sheetIssues} />

      <MappingSummary
        sheet={sheet}
        sheetMap={sheetMap}
        visibleMappings={visibleMappings}
        advancedOpen={advancedOpen}
        setAdvancedOpen={setAdvancedOpen}
        updateMapping={updateMapping}
      />

      <h3>ผลการตรวจสอบข้อมูล</h3>
      {issueSummary && (
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
      <IssueList issues={sheetIssues} emptyText="ชีตนี้ไม่พบปัญหา พร้อม export ได้" />

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

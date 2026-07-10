"use client";

import type {
  IssueSummary,
  MappingSuggestion,
  ParseResponse,
  ValidationIssue,
} from "@/lib/client-types";
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
  mappingState: Record<string, Record<string, string>>;
  updateMapping: (sheetName: string, templateColumn: string, sourceColumn: string) => void;
  mappedCountForSheet: (sheetName: string) => number;
  issues: ValidationIssue[] | null;
  issueSummary: IssueSummary | null;
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  onBack: () => void;
  onNext: () => void;
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
  issues,
  issueSummary,
  advancedOpen,
  setAdvancedOpen,
  onBack,
  onNext,
  loading,
}: PreviewStepProps) {
  const sheet = parsed.sheets[activeSheetIdx];
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
        พบ {parsed.sheets.length} ชีตที่แปลงได้
        {parsed.skippedSheets.length > 0 &&
          ` และข้าม ${parsed.skippedSheets.length} ชีต (${parsed.skippedSheets.join(", ")})`}
        ระบบจับคู่คอลัมน์และตรวจสอบเบื้องต้นให้อัตโนมัติ สามารถแก้เฉพาะกรณีที่ mapping ผิดได้จาก Advanced Mapping
      </p>

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
        <button className="btn amber" disabled={loading} onClick={onNext}>
          {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบอีกครั้งและไป Export →"}
        </button>
      </div>
    </>
  );
}

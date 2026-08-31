import { useState } from "react";
import type { CellOverrides, ValidationIssue } from "@/lib/client-types";
import { TEMPLATE_COLUMNS } from "@/lib/mapping";
import {
  displayIssueColumn,
  displayIssueMessage,
  isReferenceMismatchIssue,
  issueSeverityLabel,
} from "./display";

interface IssueListProps {
  issues: ValidationIssue[];
  emptyText: string;
  cellOverrides: CellOverrides;
  excludedRows: number[];
  onCellOverride: (rowIndex: number, templateColumn: string, value: string) => void;
  onToggleExcludedRow: (rowIndex: number) => void;
}

interface CellEditorProps {
  column: string;
  currentValue: unknown;
  overrideValue: string | undefined;
  disabled: boolean;
  onCommit: (value: string) => void;
}

function CellEditor({ column, currentValue, overrideValue, disabled, onCommit }: CellEditorProps) {
  const [draft, setDraft] = useState(overrideValue ?? "");
  const [dirty, setDirty] = useState(false);
  const placeholder = currentValue === undefined || currentValue === null || currentValue === ""
    ? "พิมพ์ค่าใหม่"
    : `ค่าปัจจุบัน: ${String(currentValue)}`;

  return (
    <label className="cell-fix-field">
      <span>
        {displayIssueColumn(column)}
        {overrideValue !== undefined && <em className="edited-badge">แก้ไขแล้ว</em>}
      </span>
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (dirty) onCommit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function IssueList({
  issues,
  emptyText,
  cellOverrides,
  excludedRows,
  onCellOverride,
  onToggleExcludedRow,
}: IssueListProps) {
  if (!issues.length) {
    return (
      <div className="success-block inline">
        <div className="icon">✓</div>
        <p>{emptyText}</p>
      </div>
    );
  }

  // Reference-mismatch warnings (a value not yet in the template's Reference
  // dropdown, e.g. a department/building name) can number in the thousands
  // for a single sheet - listing them per row is unreadable and not
  // actionable per row anyway (the fix is to update the Reference list, not
  // edit each row). Collapse them into one summarized count per column+value
  // and keep the row-by-row list for issues that are actually fixable per row.
  const referenceIssues = issues.filter((issue) => issue.rowIndex >= 0 && isReferenceMismatchIssue(issue));
  const otherIssues = issues.filter((issue) => issue.rowIndex < 0 || !isReferenceMismatchIssue(issue));

  const referenceGroups = new Map<string, { column: string; message: string; count: number }>();
  for (const issue of referenceIssues) {
    const key = `${issue.column}:${issue.message}`;
    const existing = referenceGroups.get(key);
    if (existing) existing.count += 1;
    else referenceGroups.set(key, { column: issue.column, message: issue.message, count: 1 });
  }
  const sortedReferenceGroups = [...referenceGroups.values()].sort((a, b) => b.count - a.count);

  const visibleIssues = otherIssues.slice(0, 200);
  const sheetIssues = visibleIssues.filter((issue) => issue.rowIndex < 0);
  const issuesByRow = new Map<number, ValidationIssue[]>();
  for (const issue of visibleIssues) {
    if (issue.rowIndex < 0) continue;
    const rowIssues = issuesByRow.get(issue.rowIndex) || [];
    rowIssues.push(issue);
    issuesByRow.set(issue.rowIndex, rowIssues);
  }

  return (
    <div className="issue-list">
      {sortedReferenceGroups.length > 0 && (
        <details className="reference-issue-group">
          <summary>
            ค่าที่ยังไม่อยู่ใน Reference list ({referenceIssues.length.toLocaleString("th-TH")} แถว ·{" "}
            {sortedReferenceGroups.length.toLocaleString("th-TH")} รายการ) — ไม่ใช่ข้อผิดพลาดของการแปลง
            เพียงแต่ Reference list ของ template ยังไม่มีค่านี้
          </summary>
          <ul className="reference-issue-list">
            {sortedReferenceGroups.map((group) => (
              <li key={`${group.column}:${group.message}`}>
                <strong>{displayIssueColumn(group.column)}</strong>: {displayIssueMessage(group.message)}
                {" — พบ "}
                {group.count.toLocaleString("th-TH")} แถว
              </li>
            ))}
          </ul>
        </details>
      )}
      {otherIssues.length === 0 && sortedReferenceGroups.length > 0 && (
        <div className="success-block inline">
          <div className="icon">✓</div>
          <p>ไม่มีปัญหาเชิงโครงสร้างในชีตนี้ เหลือแค่ค่าที่ยังไม่อยู่ใน Reference list ด้านบน</p>
        </div>
      )}
      {sheetIssues.map((issue, index) => (
        <div className={`issue-row ${issue.severity}`} key={`sheet:${index}`}>
          <span className="tag">{issueSeverityLabel(issue.severity)}</span>
          <span>
            <strong>{issue.sheetName}</strong> ระดับชีต
            {issue.column ? ` · ${displayIssueColumn(issue.column)}` : ""}: {displayIssueMessage(issue.message)}
          </span>
        </div>
      ))}

      {[...issuesByRow.entries()].map(([rowIndex, rowIssues]) => {
        const isExcluded = excludedRows.includes(rowIndex);
        const editableColumns = [...new Set(
          rowIssues.map((issue) => issue.column).filter((column) => TEMPLATE_COLUMNS.includes(column)),
        )];
        const currentValues = new Map(
          rowIssues.map((issue) => [issue.column, issue.currentValue]),
        );
        const severity = rowIssues.some((issue) => issue.severity === "error") ? "error" : "warning";

        return (
          <div
            className={`issue-row-group ${severity}${isExcluded ? " row-excluded" : ""}`}
            key={`row:${rowIndex}`}
          >
            <div className="issue-row-heading">
              <div>
                <span className="tag">{issueSeverityLabel(severity)}</span>
                <strong>แถวที่ {rowIndex + 1}</strong>
              </div>
              <button
                type="button"
                className="row-exclude-toggle"
                aria-pressed={isExcluded}
                onClick={() => onToggleExcludedRow(rowIndex)}
              >
                {isExcluded ? "คืนแถว" : "ตัดแถวนี้ออก"}
              </button>
            </div>

            <ul className="row-issue-messages">
              {rowIssues.map((issue, index) => (
                <li key={`${issue.column}:${index}`}>
                  {issue.column ? <strong>{displayIssueColumn(issue.column)}: </strong> : null}
                  {displayIssueMessage(issue.message)}
                </li>
              ))}
            </ul>

            {editableColumns.length > 0 && (
              <div className="cell-fix-grid">
                {editableColumns.map((column) => (
                  <CellEditor
                    key={`${rowIndex}:${column}:${cellOverrides[rowIndex]?.[column] === undefined ? "empty" : "set"}`}
                    column={column}
                    currentValue={currentValues.get(column)}
                    overrideValue={cellOverrides[rowIndex]?.[column]}
                    disabled={isExcluded}
                    onCommit={(value) => onCellOverride(rowIndex, column, value)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

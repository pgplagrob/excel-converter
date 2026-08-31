import type { CellOverrides } from "./client-types";
import { TEMPLATE_COLUMNS } from "./mapping";
import type { ValidationIssue } from "./validate";

const TEMPLATE_COLUMN_SET = new Set(TEMPLATE_COLUMNS);

export interface AppliedRowFixes {
  mappedRows: Record<string, any>[];
  sourceRows: Record<string, any>[];
  originalRowIndices: number[];
}

/** Layers explicit human edits and exclusions on top of transformed rows. */
export function applyRowFixes(
  mappedRows: Record<string, any>[],
  sourceRows: Record<string, any>[],
  cellOverrides: CellOverrides = {},
  excludedRows: number[] = [],
): AppliedRowFixes {
  const editedRows = mappedRows.map((row, rowIndex) => {
    const rowOverrides = cellOverrides[rowIndex];
    if (!rowOverrides) return row;

    const nextRow = { ...row };
    for (const [column, value] of Object.entries(rowOverrides)) {
      if (TEMPLATE_COLUMN_SET.has(column) && typeof value === "string") {
        nextRow[column] = value;
      }
    }
    return nextRow;
  });

  const excluded = new Set(excludedRows);
  const keptMappedRows: Record<string, any>[] = [];
  const keptSourceRows: Record<string, any>[] = [];
  const originalRowIndices: number[] = [];

  editedRows.forEach((row, rowIndex) => {
    if (excluded.has(rowIndex)) return;
    keptMappedRows.push(row);
    keptSourceRows.push(sourceRows[rowIndex] || {});
    originalRowIndices.push(rowIndex);
  });

  return { mappedRows: keptMappedRows, sourceRows: keptSourceRows, originalRowIndices };
}

export function enrichFixedRowIssues(
  issues: ValidationIssue[],
  fixedRows: AppliedRowFixes,
): ValidationIssue[] {
  return issues.map((issue) => {
    if (issue.rowIndex < 0) return issue;
    const cell = TEMPLATE_COLUMN_SET.has(issue.column)
      ? fixedRows.mappedRows[issue.rowIndex]?.[issue.column]
      : undefined;
    return {
      ...issue,
      currentValue: cell === undefined || cell === null ? undefined : String(cell),
      rowIndex: fixedRows.originalRowIndices[issue.rowIndex] ?? issue.rowIndex,
    };
  });
}

// Pure pagination / filter / search over already-calculated rows. Used by the
// calculated-preview endpoint so the client never receives more than one
// page's worth of rows, no matter how large the workbook is (up to 15,000+
// rows per prompt's performance requirement).

import type { ReportClass } from "../domain/types";
import type { CalculatedRow } from "./types";

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export type SeverityFilter = "error" | "warning" | "needsReview";

export interface PreviewQuery {
  page?: number; // 1-based
  pageSize?: number; // clamped to [1, 100]
  classification?: ReportClass[];
  severity?: SeverityFilter[];
  search?: string; // matches assetCode or assetName (substring, case-insensitive for ASCII)
}

export interface PreviewQueryResult {
  rows: CalculatedRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function normalizePageSize(pageSize: number | undefined): number {
  if (!Number.isFinite(pageSize)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(pageSize as number)));
}

function rowHasSeverity(row: CalculatedRow, severities: SeverityFilter[]): boolean {
  return severities.some((severity) => {
    if (severity === "needsReview") return row.classification.classification === "NEEDS_REVIEW";
    if (severity === "error") return row.depreciation.blockingIssues.length > 0;
    // "warning": has reason codes beyond the primary classification reason,
    // i.e. something worth a second look even though it is not blocking.
    return (
      row.classification.classification !== "NEEDS_REVIEW" &&
      row.depreciation.blockingIssues.length === 0 &&
      row.depreciation.reasonCodes.length > 1
    );
  });
}

function rowMatchesSearch(row: CalculatedRow, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.assetCode.toLowerCase().includes(needle) ||
    row.assetName.toLowerCase().includes(needle)
  );
}

export function queryCalculatedRows(rows: CalculatedRow[], query: PreviewQuery): PreviewQueryResult {
  let filtered = rows;

  if (query.classification?.length) {
    const set = new Set(query.classification);
    filtered = filtered.filter((row) => set.has(row.classification.classification));
  }
  if (query.severity?.length) {
    const severities = query.severity;
    filtered = filtered.filter((row) => rowHasSeverity(row, severities));
  }
  if (query.search) {
    filtered = filtered.filter((row) => rowMatchesSearch(row, query.search as string));
  }

  const pageSize = normalizePageSize(query.pageSize);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(query.page || 1)), totalPages);
  const start = (page - 1) * pageSize;

  return {
    rows: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

/** Grouped warning summary (counts by reason code), for a drill-down UI. */
export interface WarningGroup {
  reasonCode: string;
  count: number;
  sampleRowKeys: string[];
}

export function groupWarnings(rows: CalculatedRow[], sampleLimit = 5): WarningGroup[] {
  const groups = new Map<string, WarningGroup>();
  for (const row of rows) {
    const codes = [...row.classification.reasonCodes, ...row.depreciation.reasonCodes];
    for (const code of new Set(codes)) {
      const existing = groups.get(code) || { reasonCode: code, count: 0, sampleRowKeys: [] };
      existing.count += 1;
      if (existing.sampleRowKeys.length < sampleLimit) existing.sampleRowKeys.push(row.rowKey);
      groups.set(code, existing);
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

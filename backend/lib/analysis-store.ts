import type { DataSourceWorkbook } from "./datasource";
import type { WorkbookSheetMatrix } from "./excel";

export interface AnalysisRecord {
  id: string;
  createdAt: number;
  expiresAt: number;
  dataSource: DataSourceWorkbook;
  sourceWorkbookBuffer?: Buffer;
  sourceWorkbookSheets?: WorkbookSheetMatrix[];
}

const TTL_MS = 30 * 60 * 1000;
const MAX_ANALYSES = 20;

declare global {
  var __excelConverterAnalysisStore: Map<string, AnalysisRecord> | undefined;
}

// Route handlers may be emitted as separate bundles. Keeping the store on
// globalThis makes parse/export share one cache for the lifetime of a process.
const store = globalThis.__excelConverterAnalysisStore ?? new Map<string, AnalysisRecord>();
globalThis.__excelConverterAnalysisStore = store;

function cleanupExpired(now = Date.now()): void {
  for (const [id, record] of store.entries()) {
    if (record.expiresAt <= now) store.delete(id);
  }
}

export function saveAnalysis(
  dataSource: DataSourceWorkbook,
  sourceWorkbookBuffer?: Buffer,
  sourceWorkbookSheets?: WorkbookSheetMatrix[],
): string {
  cleanupExpired();
  while (store.size >= MAX_ANALYSES) {
    const oldestId = store.keys().next().value as string | undefined;
    if (!oldestId) break;
    store.delete(oldestId);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  store.set(id, {
    id,
    createdAt: now,
    expiresAt: now + TTL_MS,
    dataSource,
    sourceWorkbookBuffer,
    sourceWorkbookSheets,
  });
  return id;
}

export function getAnalysis(id: string | null | undefined): AnalysisRecord | null {
  if (!id) return null;
  cleanupExpired();
  const record = store.get(id);
  if (!record) return null;

  // Keep an active conversion available while the user reviews its mappings.
  record.expiresAt = Date.now() + TTL_MS;
  store.delete(id);
  store.set(id, record);
  return record;
}

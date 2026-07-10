import type { DataSourceWorkbook } from "./datasource";

export interface AnalysisRecord {
  id: string;
  createdAt: number;
  expiresAt: number;
  dataSource: DataSourceWorkbook;
}

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, AnalysisRecord>();

function cleanupExpired(now = Date.now()): void {
  for (const [id, record] of store.entries()) {
    if (record.expiresAt <= now) store.delete(id);
  }
}

export function saveAnalysis(dataSource: DataSourceWorkbook): string {
  cleanupExpired();
  const id = crypto.randomUUID();
  const now = Date.now();
  store.set(id, {
    id,
    createdAt: now,
    expiresAt: now + TTL_MS,
    dataSource,
  });
  return id;
}

export function getAnalysis(id: string | null | undefined): AnalysisRecord | null {
  if (!id) return null;
  cleanupExpired();
  return store.get(id) ?? null;
}

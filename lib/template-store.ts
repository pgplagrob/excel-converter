import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { sanitizeWorkbookDataValidations } from "./xlsx-sanitize";
import { TEMPLATE_COLUMNS } from "./mapping";

export interface TemplateVersion {
  id: string;
  fileName: string;
  originalFileName: string;
  uploadedAt: number;
  columns: string[];
}

interface TemplateStoreIndex {
  activeId: string | null;
  versions: TemplateVersion[];
}

export interface TemplateColumnDiff {
  missing: string[];
  extra: string[];
}

export interface TemplateValidationResult {
  ok: boolean;
  error?: string;
  columns: string[];
  columnDiff: TemplateColumnDiff;
}

export interface TemplateStoreStatus {
  isOverride: boolean;
  activeId: string | null;
  active: {
    id: string;
    originalFileName: string;
    uploadedAt: number;
    columns: string[];
    columnDiff: TemplateColumnDiff;
  } | null;
  history: TemplateVersion[];
}

const MAX_VERSIONS = 5;

function storeDir(): string {
  return join(process.cwd(), "data", "templates");
}

function indexPath(): string {
  return join(storeDir(), "index.json");
}

function readIndex(): TemplateStoreIndex {
  try {
    const parsed: unknown = JSON.parse(readFileSync(indexPath(), "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { activeId: null, versions: [] };
    }
    const candidate = parsed as Partial<TemplateStoreIndex>;
    const versions = Array.isArray(candidate.versions) ? candidate.versions : [];
    return {
      activeId: typeof candidate.activeId === "string" ? candidate.activeId : null,
      versions: versions.filter(
        (version): version is TemplateVersion =>
          !!version &&
          typeof version === "object" &&
          typeof (version as TemplateVersion).id === "string" &&
          typeof (version as TemplateVersion).fileName === "string",
      ),
    };
  } catch {
    return { activeId: null, versions: [] };
  }
}

function writeIndex(index: TemplateStoreIndex): void {
  mkdirSync(storeDir(), { recursive: true });
  writeFileSync(indexPath(), JSON.stringify(index, null, 2), "utf8");
}

function computeColumnDiff(columns: string[]): TemplateColumnDiff {
  const columnSet = new Set(columns);
  return {
    missing: TEMPLATE_COLUMNS.filter((column) => !columnSet.has(column)),
    extra: columns.filter((column) => !TEMPLATE_COLUMNS.includes(column)),
  };
}

function cellText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    const cellValue = value as { richText?: { text: string }[]; text?: string };
    if (cellValue.richText) return cellValue.richText.map((part) => part.text).join("").trim();
    if (cellValue.text) return cellValue.text.trim();
  }
  return String(value).trim();
}

/**
 * Loads a candidate template buffer the same way production reads do (sanitize
 * full-column dataValidations before ExcelJS parses them) so a broken upload
 * can't hang this validation step either, then checks the minimum structure
 * the rest of the app relies on (lib/template.ts's readSheetRows/Reference use).
 */
export async function validateTemplateUpload(buffer: Buffer): Promise<TemplateValidationResult> {
  let workbook: ExcelJS.Workbook;
  try {
    const sanitized = await sanitizeWorkbookDataValidations(buffer, { clampMaxRow: 5 });
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(sanitized as unknown as ExcelJS.Buffer);
  } catch {
    return {
      ok: false,
      error: "ไม่สามารถอ่านไฟล์นี้เป็น Excel ได้ ตรวจสอบว่าไฟล์ไม่เสียหาย",
      columns: [],
      columnDiff: { missing: [], extra: [] },
    };
  }

  const sheet1 = workbook.getWorksheet("Sheet1");
  if (!sheet1) {
    return {
      ok: false,
      error: "ไฟล์นี้ไม่มีชีตชื่อ \"Sheet1\" ซึ่งเป็นชีตหลักที่ระบบใช้เขียนผลลัพธ์",
      columns: [],
      columnDiff: { missing: [], extra: [] },
    };
  }

  if (!workbook.getWorksheet("Reference")) {
    return {
      ok: false,
      error: "ไฟล์นี้ไม่มีชีตชื่อ \"Reference\" ซึ่งเก็บรายการอ้างอิง (หมวดหมู่, ประเภท ฯลฯ)",
      columns: [],
      columnDiff: { missing: [], extra: [] },
    };
  }

  const headerRow = sheet1.getRow(1);
  const columns = Array.from(
    { length: sheet1.columnCount },
    (_, index) => cellText(headerRow.getCell(index + 1).value),
  ).filter(Boolean);

  if (columns.length === 0) {
    return {
      ok: false,
      error: "แถวหัวตาราง (แถวที่ 1) ของ Sheet1 ว่างเปล่า",
      columns: [],
      columnDiff: { missing: [], extra: [] },
    };
  }

  return { ok: true, columns, columnDiff: computeColumnDiff(columns) };
}

export function saveTemplateUpload(buffer: Buffer, originalFileName: string, columns: string[]): TemplateVersion {
  const dir = storeDir();
  mkdirSync(dir, { recursive: true });

  const id = randomUUID();
  const fileName = `${Date.now()}-${id}.xlsx`;
  writeFileSync(join(dir, fileName), buffer);

  const version: TemplateVersion = {
    id,
    fileName,
    originalFileName,
    uploadedAt: Date.now(),
    columns,
  };

  const index = readIndex();
  index.versions.push(version);
  index.activeId = id;

  const overflow = index.versions.length - MAX_VERSIONS;
  if (overflow > 0) {
    const removed = index.versions.splice(0, overflow);
    for (const old of removed) {
      try {
        unlinkSync(join(dir, old.fileName));
      } catch {
        // best-effort cleanup; a missing file is not fatal
      }
    }
  }

  writeIndex(index);
  return version;
}

/** Pass `null` to revert to the factory-default template (no override active). */
export function rollbackTemplate(versionId: string | null): TemplateVersion | null {
  const index = readIndex();

  if (versionId === null) {
    index.activeId = null;
    writeIndex(index);
    return null;
  }

  const version = index.versions.find((entry) => entry.id === versionId);
  if (!version) throw new Error("ไม่พบเวอร์ชันของ template ที่ระบุ");
  if (!existsSync(join(storeDir(), version.fileName))) {
    throw new Error("ไฟล์ template เวอร์ชันนี้หายไปจากระบบแล้ว");
  }
  index.activeId = versionId;
  writeIndex(index);
  return version;
}

export function getTemplateStoreStatus(): TemplateStoreStatus {
  const index = readIndex();
  const active = index.activeId ? index.versions.find((v) => v.id === index.activeId) ?? null : null;

  return {
    isOverride: !!active,
    activeId: index.activeId,
    active: active
      ? {
          id: active.id,
          originalFileName: active.originalFileName,
          uploadedAt: active.uploadedAt,
          columns: active.columns,
          columnDiff: computeColumnDiff(active.columns),
        }
      : null,
    history: [...index.versions].sort((a, b) => b.uploadedAt - a.uploadedAt),
  };
}

/**
 * Absolute path of the currently active uploaded template, or null if none is
 * set / its file is missing (callers should fall back to the factory default).
 */
export function resolveActiveTemplateFilePath(): string | null {
  const index = readIndex();
  if (!index.activeId) return null;
  const active = index.versions.find((v) => v.id === index.activeId);
  if (!active) return null;
  const filePath = join(storeDir(), active.fileName);
  return existsSync(filePath) ? filePath : null;
}

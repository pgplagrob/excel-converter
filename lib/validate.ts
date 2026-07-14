import {
  INTERNAL,
  SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN,
  SOURCE_ASSET_ITEM_COLUMN,
  SOURCE_ASSET_NAME_COLUMN,
  SOURCE_ASSET_TYPE_COLUMN,
  SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN,
  SOURCE_PROFILE_COLUMN,
  looksLikeAssetItemGroup,
  looksLikeAssetTypeGroup,
} from "./datasource";
import { TEMPLATE_COLUMNS } from "./mapping";
import type { TemplateReferenceValues } from "./template";

export interface ValidationIssue {
  sheetName: string;
  rowIndex: number;
  column: string;
  message: string;
  severity: "error" | "warning";
}

export type SheetStatus = "success" | "warning" | "error" | "skipped";

export interface SheetSummary {
  sheetName: string;
  status: SheetStatus;
  rowCount: number;
  headerRow?: number;
  errorCount: number;
  warningCount: number;
  reason?: string;
}

const REQUIRED_COLUMNS = ["รหัสสินทรัพย์", "ชื่อสินทรัพย์"];
const DATE_COLUMNS = [
  "วันที่ได้รับ",
  "วันที่ได้รับโอน",
  "วันที่ออกจำหน่าย",
  "วันที่เริ่มรับประกัน",
  "วันที่หมดประกัน",
  "ณ วันที่ (ค่าเสื่อมยกมา)",
];
const NUMERIC_COLUMNS = ["มูลค่า", "ค่าเสื่อมสะสมยกมา"];
const VALID_STATUSES = new Set(["", "ปกติ", "ชำรุด", "รอจำหน่าย", "สูญหาย", "ไม่ได้ใช้งาน"]);
const HEADER_VALUES = new Set([
  "ที่",
  "รายการ",
  "รหัสครุภัณฑ์",
  "รหัสสินทรัพย์",
  "วันเดือนปี",
  "ราคาที่ได้มา",
  "สภาพครุภัณฑ์",
  "รวม",
  "รวมทั้งสิ้น",
]);

function text(value: any): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

function compact(value: any): string {
  return text(value).replace(/\s+/g, "");
}

function addIssue(
  issues: ValidationIssue[],
  sheetName: string,
  rowIndex: number,
  column: string,
  message: string,
  severity: "error" | "warning",
): void {
  issues.push({ sheetName, rowIndex, column, message, severity });
}

function allowedValuesFromReference(
  references: TemplateReferenceValues | undefined,
  key: keyof TemplateReferenceValues,
  fallback: Set<string>,
): Set<string> {
  const values = references?.[key];
  return values && values.size ? new Set(["", ...values]) : fallback;
}

export function validateSheetLevel(
  sheetName: string,
  rowCount: number,
  headerRow: number | undefined,
  mapping: Record<string, string | null | undefined>,
  sourceRows: Record<string, any>[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (rowCount === 0) {
    addIssue(issues, sheetName, -1, "sheet", "ชีตนี้ไม่มีข้อมูลสำหรับแปลง", "error");
  }
  if (headerRow === undefined || headerRow < 1) {
    addIssue(issues, sheetName, -1, "header", "ตรวจไม่พบแถว header ของชีต", "error");
  }
  for (const column of REQUIRED_COLUMNS) {
    const hasNormalizedValue = sourceRows.some((row) => {
      if (column === "รหัสสินทรัพย์") return Boolean(text(row.assetCode) || text(row[INTERNAL.assetCode]));
      if (column === "ชื่อสินทรัพย์") {
        return Boolean(
          text(row.assetName) ||
            text(row[INTERNAL.assetName]) ||
            text(row[SOURCE_ASSET_NAME_COLUMN]) ||
            sourceAllowsDetailOnlyAssetName(row),
        );
      }
      return false;
    });

    if (!mapping[column] && !hasNormalizedValue) {
      addIssue(
        issues,
        sheetName,
        -1,
        column,
        `ไม่พบการจับคู่คอลัมน์สำคัญ "${column}"`,
        "error",
      );
    }
  }
  return issues;
}

export function createSheetSummary(
  sheetName: string,
  rowCount: number,
  headerRow: number | undefined,
  issues: ValidationIssue[],
  reason?: string,
): SheetSummary {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const status: SheetStatus =
    reason || rowCount === 0
      ? "skipped"
      : errorCount > 0
        ? "error"
        : warningCount > 0
          ? "warning"
          : "success";
  return {
    sheetName,
    status,
    rowCount,
    headerRow,
    errorCount,
    warningCount,
    reason,
  };
}

function isValidDate(value: string): boolean {
  if (!value) return true;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1800 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function rowLooksLikeData(row: Record<string, any>): boolean {
  return Boolean(
    text(row["ชื่อสินทรัพย์"]) ||
      text(row["รายละเอียด"]) ||
      text(row["มูลค่า"]) ||
      text(row["ชนิดสินทรัพย์"]) ||
      text(row["รายการสินทรัพย์"]),
  );
}

function looksLikeLeakedHeader(row: Record<string, any>): boolean {
  const values = TEMPLATE_COLUMNS.map((column) => compact(row[column])).filter(Boolean);
  return values.some((value) => HEADER_VALUES.has(value)) || values.some((value) => value.includes("รวมทั้งสิ้น"));
}

function looksLikeLongDetailInsteadOfGroup(value: string): boolean {
  const compactValue = compact(value);
  if (!compactValue) return false;
  if (/\(\d+\)/.test(compactValue) && compactValue.length <= 80) return false;
  return (
    compactValue.length > 45 ||
    /ยี่ห้อ|รุ่น|ขนาด|หมายเลข|ทะเบียน|เครื่องยนต์|ตามอาคาร|หน้าห้อง/.test(value)
  );
}

function sourceAssetItemShouldEmit(sourceRow: Record<string, any>): boolean {
  return sourceRow[SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN] === true;
}

function sourceAssetTypeShouldEmit(sourceRow: Record<string, any>): boolean {
  const emitOnce = sourceRow[SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN];
  if (emitOnce === false) return false;
  if (emitOnce === true) return true;
  return Boolean(text(sourceRow[SOURCE_ASSET_TYPE_COLUMN]));
}

function sourceAllowsDetailOnlyAssetName(sourceRow: Record<string, any>): boolean {
  return (
    text(sourceRow[SOURCE_PROFILE_COLUMN]) === "NEW_ASSET_2567" &&
    Boolean(text(sourceRow.assetDetail) || text(sourceRow[INTERNAL.detail]))
  );
}

export function validateMappedRows(
  sheetName: string,
  rows: Record<string, any>[],
  sourceRows: Record<string, any>[] = [],
  references?: TemplateReferenceValues,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenExactRows = new Map<string, number>();
  let previousSourceAssetItem = "";
  let previousAssetItem = "";
  const validStatuses = allowedValuesFromReference(references, "statuses", VALID_STATUSES);
  const validGetByMethods = allowedValuesFromReference(references, "getByMethods", new Set([""]));
  const validSourceFunds = allowedValuesFromReference(references, "sourceFunds", new Set([""]));
  const validBooleans = allowedValuesFromReference(references, "booleans", new Set(["", "True", "False"]));

  rows.forEach((row, idx) => {
    const sourceRow = sourceRows[idx] || {};
    const allowsDetailOnlyAssetName = sourceAllowsDetailOnlyAssetName(sourceRow);
    for (const col of REQUIRED_COLUMNS) {
      if (
        !text(row[col]) &&
        !(col === "ชื่อสินทรัพย์" && text(row["รายละเอียด"]) && allowsDetailOnlyAssetName)
      ) {
        addIssue(
          issues,
          sheetName,
          idx,
          col,
          `ไม่พบข้อมูลในคอลัมน์ที่จำเป็น "${col}"`,
          "error",
        );
      }
    }

    const assetName = compact(row["ชื่อสินทรัพย์"]);
    const assetCode = compact(row["รหัสสินทรัพย์"]);
    const assetDetail = compact(row["รายละเอียด"]);
    const assetType = compact(row["ชนิดสินทรัพย์"]);
    const assetItem = compact(row["รายการสินทรัพย์"]);
    const sourceAssetItem = compact(sourceRow[SOURCE_ASSET_ITEM_COLUMN]);
    const shouldEmitSourceAssetItem = sourceAssetItemShouldEmit(sourceRow);
    const shouldEmitSourceAssetType = sourceAssetTypeShouldEmit(sourceRow);
    const rowValues = TEMPLATE_COLUMNS.map((column) => compact(row[column])).filter(Boolean);
    if (HEADER_VALUES.has(assetName)) {
      addIssue(
        issues,
        sheetName,
        idx,
        "ชื่อสินทรัพย์",
        `ชื่อสินทรัพย์ดูเหมือนหัวตารางหรือแถวรวม (${row["ชื่อสินทรัพย์"]})`,
        "error",
      );
    }

    if (looksLikeAssetItemGroup(row["ชื่อสินทรัพย์"])) {
      addIssue(
        issues,
        sheetName,
        idx,
        "ชื่อสินทรัพย์",
        "ชื่อสินทรัพย์ดูเหมือนกลุ่มรายการสินทรัพย์ที่ลงท้ายด้วยรหัสในวงเล็บ",
        "error",
      );
    }

    if (!assetCode && looksLikeAssetTypeGroup(row["ชื่อสินทรัพย์"])) {
      addIssue(
        issues,
        sheetName,
        idx,
        "ชื่อสินทรัพย์",
        "ชื่อสินทรัพย์ดูเหมือนชนิดสินทรัพย์/กลุ่มหลัก ไม่ใช่ชื่อสินทรัพย์รายตัว",
        "error",
      );
    }

    if (assetName === "44" || assetName === "45") {
      addIssue(
        issues,
        sheetName,
        idx,
        "ชื่อสินทรัพย์",
        "ชื่อสินทรัพย์เป็นค่า placeholder 44/45 แทนชื่อจริง",
        "error",
      );
    }

    if (!assetName && assetDetail && !allowsDetailOnlyAssetName) {
      addIssue(
        issues,
        sheetName,
        idx,
        "รายละเอียด",
        "รายละเอียดมีค่า แต่ชื่อสินทรัพย์ว่าง",
        "error",
      );
    }

    if (assetItem && assetName && assetItem === assetName) {
      addIssue(
        issues,
        sheetName,
        idx,
        "รายการสินทรัพย์",
        "รายการสินทรัพย์เท่ากับชื่อสินทรัพย์ ซึ่งควรเป็นกลุ่มรายการ เช่น โต๊ะ (400)",
        "error",
      );
    }

    if (!assetItem && sourceAssetItem && shouldEmitSourceAssetItem) {
      addIssue(
        issues,
        sheetName,
        idx,
        "รายการสินทรัพย์",
        "รายการสินทรัพย์ว่าง ทั้งที่ข้อมูลต้นทางมีกลุ่มรายการที่ถูก carry-forward",
        "warning",
      );
    }

    if (assetItem && sourceAssetItem && sourceAssetItem === previousSourceAssetItem && assetItem === previousAssetItem) {
      addIssue(
        issues,
        sheetName,
        idx,
        "รายการสินทรัพย์",
        "รายการสินทรัพย์ซ้ำต่อเนื่องในกลุ่มเดียวกัน ควรแสดงเฉพาะแถวแรกของกลุ่มแล้วเว้นว่างในแถวถัดไป",
        "warning",
      );
    }

    if (assetItem && looksLikeLongDetailInsteadOfGroup(text(row["รายการสินทรัพย์"]))) {
      addIssue(
        issues,
        sheetName,
        idx,
        "รายการสินทรัพย์",
        "รายการสินทรัพย์ดูเหมือนรายละเอียด/ชื่อสินทรัพย์รายตัว ไม่ใช่กลุ่มรายการ",
        "warning",
      );
    }

    if (assetCode && assetName && assetItem && !assetType && shouldEmitSourceAssetType) {
      addIssue(
        issues,
        sheetName,
        idx,
        "ชนิดสินทรัพย์",
        "แถวนี้มีรายการสินทรัพย์จากกลุ่ม แต่ชนิดสินทรัพย์ว่าง",
        "warning",
      );
    }

    if (rowValues.some((value) => value === "รวม" || value.includes("รวมทั้งสิ้น"))) {
      addIssue(
        issues,
        sheetName,
        idx,
        "ชื่อสินทรัพย์",
        "แถวส่งออกมีข้อความรวม/รวมทั้งสิ้น",
        "error",
      );
    }

    if (looksLikeLeakedHeader(row)) {
      addIssue(
        issues,
        sheetName,
        idx,
        "ชื่อสินทรัพย์",
        "แถวนี้ดูเหมือนหัวตารางหรือแถวสรุปที่รั่วเข้ามาเป็นข้อมูล",
        "error",
      );
    }

    if (!assetCode && rowLooksLikeData(row)) {
      addIssue(
        issues,
        sheetName,
        idx,
        "รหัสสินทรัพย์",
        "แถวนี้มีลักษณะเป็นข้อมูลสินทรัพย์แต่ไม่มีรหัสสินทรัพย์",
        "error",
      );
    }

    if (!assetCode && !text(row["มูลค่า"]) && text(row["รายละเอียด"]) && !text(row["ชื่อสินทรัพย์"])) {
      addIssue(
        issues,
        sheetName,
        idx,
        "รายละเอียด",
        "แถวนี้อาจเป็น continuation row ที่ถูกส่งออกเป็นแถวเดี่ยว",
        "error",
      );
    }

    const exactRowKey = JSON.stringify(TEMPLATE_COLUMNS.map((column) => text(row[column])));
    const previousExactRow = seenExactRows.get(exactRowKey);
    if (previousExactRow !== undefined) {
      addIssue(
        issues,
        sheetName,
        idx,
        "row",
        `แถวส่งออกซ้ำกับแถวที่ ${previousExactRow + 1} แบบทั้งแถว ระบบอนุญาตให้รหัสสินทรัพย์ซ้ำได้เฉพาะกรณีที่ข้อมูลช่องอื่นแตกต่างกัน`,
        "warning",
      );
    } else {
      seenExactRows.set(exactRowKey, idx);
    }

    const status = text(row["สถานะ"]);
    if (!validStatuses.has(status)) {
      addIssue(
        issues,
        sheetName,
        idx,
        "สถานะ",
        `ค่าสถานะไม่อยู่ในชุดที่รองรับ: ${status}`,
        "warning",
      );
    }

    const acquiredBy = text(row["ได้มาโดย"]);
    if (acquiredBy && !validGetByMethods.has(acquiredBy)) {
      addIssue(
        issues,
        sheetName,
        idx,
        "ได้มาโดย",
        `ค่าวิธีได้มาไม่อยู่ใน Reference: ${acquiredBy}`,
        "warning",
      );
    }

    const sourceFund = text(row["แหล่งงบประมาณ"]);
    if (sourceFund && !validSourceFunds.has(sourceFund)) {
      addIssue(
        issues,
        sheetName,
        idx,
        "แหล่งงบประมาณ",
        `ค่าแหล่งงบประมาณไม่อยู่ใน Reference: ${sourceFund}`,
        "warning",
      );
    }

    for (const col of ["ต้องตรวจนับ", "คิดค่าเสื่อม", "ของสำคัญ", "ส่งคืนสินทรัพย์"]) {
      const value = text(row[col]);
      if (value && !validBooleans.has(value)) {
        addIssue(
          issues,
          sheetName,
          idx,
          col,
          `ค่าควรเป็น True/False ตาม Reference (พบค่า: ${value})`,
          "warning",
        );
      }
    }

    for (const col of DATE_COLUMNS) {
      const value = text(row[col]);
      if (value && !isValidDate(value)) {
        addIssue(
          issues,
          sheetName,
          idx,
          col,
          `รูปแบบวันที่น่าสงสัยในคอลัมน์ "${col}" (พบค่า: ${value})`,
          "warning",
        );
      }
    }

    for (const col of NUMERIC_COLUMNS) {
      const value = text(row[col]).replace(/,/g, "");
      if (/^[\s\-–—]+$/.test(value)) continue;
      if (value && Number.isNaN(Number(value))) {
        addIssue(
          issues,
          sheetName,
          idx,
          col,
          `ค่าควรเป็นตัวเลขในคอลัมน์ "${col}" (พบค่า: ${row[col]})`,
          "warning",
        );
      }
    }

    previousSourceAssetItem = sourceAssetItem;
    previousAssetItem = assetItem;
  });

  return issues;
}

export function getTemplateColumns(): string[] {
  return TEMPLATE_COLUMNS;
}

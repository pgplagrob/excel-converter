import * as XLSX from "xlsx";
import { TEMPLATE_COLUMNS, getAllKeywords } from "./mapping";

export interface ParsedSheet {
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: ParsedSheet[];
  skippedSheets: string[];
}

// ใช้ keyword ทั้งหมด (template + aliases) เพื่อให้ตรวจจับแถวหัวตารางได้แม่นกว่าเดิม
// เรียก getAllKeywords() ครั้งเดียวตอน module load
const ALL_KEYWORDS: string[] = getAllKeywords();

function normalizeForScore(s: string): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, "")
    .replace(/[()/.\-_,]/g, "");
}

function scoreRowAsHeader(row: any[]): number {
  let score = 0;
  for (const cell of row) {
    if (cell === null || cell === undefined || cell === "") continue;
    const text = normalizeForScore(cell.toString());
    if (!text || text.length < 2) continue;

    // keyword match (template หรือ alias) — ให้คะแนนสูง
    // กำหนด min length 4 ทั้งสองทาง เพื่อไม่ให้คำสั้นๆ อย่าง "ที่" จับกับ "วันที่ได้รับ"
    const isKeyword = text.length >= 4 && ALL_KEYWORDS.some(
      (kw) => kw.length >= 4 && (text.includes(kw) || kw.includes(text))
    );

    if (isKeyword) {
      score += 5; // คะแนนสูงสำหรับคอลัมน์ที่รู้จัก
    } else if (typeof cell === "string" && text.length >= 2) {
      score += 0.2; // คะแนนเล็กน้อยสำหรับ text cell ทั่วไป
    }
  }
  return score;
}

function detectHeaderRow(matrix: any[][]): number {
  const scanLimit = Math.min(matrix.length, 15);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < scanLimit; i++) {
    const s = scoreRowAsHeader(matrix[i] || []);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function isSheetEffectivelyEmpty(matrix: any[][]): boolean {
  const nonEmptyRows = matrix.filter(
    (row) => row.some((c) => c !== null && c !== undefined && c.toString().trim() !== "")
  );
  return nonEmptyRows.length < 2;
}

export function parseWorkbookBuffer(buffer: Buffer, fileName: string): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: ParsedSheet[] = [];
  const skippedSheets: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: "",
    });

    if (isSheetEffectivelyEmpty(matrix)) {
      skippedSheets.push(sheetName);
      continue;
    }

    const headerRowIndex = detectHeaderRow(matrix);
    const rawHeaders = (matrix[headerRowIndex] || []).map((h) =>
      (h ?? "").toString().trim()
    );

    // ทำความสะอาดชื่อหัวคอลัมน์: ลบ * นำหน้า + ลบ newline
    const headers: string[] = rawHeaders.map((h, idx) => {
      const clean = h.replace(/^\*/, "").replace(/\n/g, " ").trim();
      return clean || `คอลัมน์${idx + 1}`;
    });

    const dataRows = matrix.slice(headerRowIndex + 1);
    const rows: Record<string, any>[] = [];
    for (const r of dataRows) {
      const isEmpty = r.every(
        (c) => c === null || c === undefined || c.toString().trim() === ""
      );
      if (isEmpty) continue;
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h] = normalizeCell(r[idx]);
      });
      rows.push(obj);
    }

    if (rows.length === 0) {
      skippedSheets.push(sheetName);
      continue;
    }

    sheets.push({
      sheetName,
      headerRowIndex,
      headers,
      rows,
      rowCount: rows.length,
    });
  }

  return { fileName, sheets, skippedSheets };
}

function normalizeCell(value: any): any {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return value.toString().trim();
}

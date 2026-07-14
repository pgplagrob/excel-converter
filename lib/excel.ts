import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

export interface WorkbookRowMeta {
  fillColors: string[];
}

export interface WorkbookSheetMatrix {
  sheetName: string;
  matrix: any[][];
  rowMeta: WorkbookRowMeta[];
}

export interface RawWorkbook {
  fileName: string;
  sheets: WorkbookSheetMatrix[];
}

const MAX_WORKSHEETS = 100;
const MAX_ROWS_PER_SHEET = 50_000;
const MAX_COLUMNS_PER_SHEET = 256;
const MAX_CELLS_PER_WORKBOOK = 1_000_000;

export class WorkbookLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookLimitError";
  }
}

function fillColor(cell: ExcelJS.Cell): string {
  const fill = cell.fill;
  if (fill?.type !== "pattern") return "";

  const color = fill.fgColor as { argb?: string; indexed?: number; theme?: number } | undefined;
  return (color?.argb || color?.indexed?.toString() || color?.theme?.toString() || "").toUpperCase();
}

function fallbackCellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return String(value.text ?? "");
  if ("result" in value) return fallbackCellText(value.result ?? null);
  if ("error" in value) return String(value.error ?? "");
  return "";
}

export function safeCellText(cell: Pick<ExcelJS.Cell, "text" | "value">): string {
  try {
    const text = cell.text || "";
    return text === "[object Object]" ? fallbackCellText(cell.value) : text;
  } catch {
    return fallbackCellText(cell.value);
  }
}

function validateWorkbookDimensions(workbook: ExcelJS.Workbook): void {
  if (workbook.worksheets.length > MAX_WORKSHEETS) {
    throw new WorkbookLimitError(`Workbook has more than ${MAX_WORKSHEETS} worksheets.`);
  }

  let totalCells = 0;
  for (const worksheet of workbook.worksheets) {
    if (worksheet.rowCount > MAX_ROWS_PER_SHEET) {
      throw new WorkbookLimitError(
        `Worksheet "${worksheet.name}" exceeds the ${MAX_ROWS_PER_SHEET.toLocaleString()} row limit.`,
      );
    }
    if (worksheet.columnCount > MAX_COLUMNS_PER_SHEET) {
      throw new WorkbookLimitError(
        `Worksheet "${worksheet.name}" exceeds the ${MAX_COLUMNS_PER_SHEET} column limit.`,
      );
    }

    totalCells += worksheet.rowCount * worksheet.columnCount;
    if (totalCells > MAX_CELLS_PER_WORKBOOK) {
      throw new WorkbookLimitError(
        `Workbook exceeds the ${MAX_CELLS_PER_WORKBOOK.toLocaleString()} cell limit.`,
      );
    }
  }
}

function validateSheetDimensions(
  sheetName: string,
  rowCount: number,
  columnCount: number,
  totalCells: number,
): number {
  if (rowCount > MAX_ROWS_PER_SHEET) {
    throw new WorkbookLimitError(
      `Worksheet "${sheetName}" exceeds the ${MAX_ROWS_PER_SHEET.toLocaleString()} row limit.`,
    );
  }
  if (columnCount > MAX_COLUMNS_PER_SHEET) {
    throw new WorkbookLimitError(
      `Worksheet "${sheetName}" exceeds the ${MAX_COLUMNS_PER_SHEET} column limit.`,
    );
  }

  const nextTotal = totalCells + rowCount * columnCount;
  if (nextTotal > MAX_CELLS_PER_WORKBOOK) {
    throw new WorkbookLimitError(
      `Workbook exceeds the ${MAX_CELLS_PER_WORKBOOK.toLocaleString()} cell limit.`,
    );
  }
  return nextTotal;
}

function legacyCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function readLegacyWorkbookBuffer(buffer: Buffer, fileName: string): RawWorkbook {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellStyles: true,
  });
  if (workbook.SheetNames.length > MAX_WORKSHEETS) {
    throw new WorkbookLimitError(`Workbook has more than ${MAX_WORKSHEETS} worksheets.`);
  }

  let totalCells = 0;
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const range = worksheet?.["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]!) : null;
    const rowCount = range ? range.e.r + 1 : 0;
    const columnCount = range ? range.e.c + 1 : 0;
    totalCells = validateSheetDimensions(sheetName, rowCount, columnCount, totalCells);

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    });
    const matrix = Array.from({ length: rowCount }, (_, rowIndex) =>
      Array.from({ length: columnCount }, (_, columnIndex) =>
        legacyCellText(rawRows[rowIndex]?.[columnIndex]),
      ),
    );
    const rowMeta = Array.from({ length: rowCount }, (_, rowIndex) => ({
      fillColors: Array.from({ length: columnCount }, (_, columnIndex) => {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const cell = worksheet[address] as
          | { s?: { fgColor?: { rgb?: string }; fill?: { fgColor?: { rgb?: string } } } }
          | undefined;
        return (cell?.s?.fgColor?.rgb || cell?.s?.fill?.fgColor?.rgb || "").toUpperCase();
      }),
    }));

    return { sheetName, matrix, rowMeta };
  });

  return { fileName, sheets };
}

export async function readWorkbookBuffer(buffer: Buffer, fileName: string): Promise<RawWorkbook> {
  if (/\.xls$/i.test(fileName)) return readLegacyWorkbookBuffer(buffer, fileName);

  const workbook = new ExcelJS.Workbook();
  // exceljs defines its own Buffer type in typings; cast to satisfy TypeScript
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  validateWorkbookDimensions(workbook);

  const sheets: WorkbookSheetMatrix[] = workbook.worksheets.map((worksheet) => {
    const matrix: any[][] = [];
    const rowMeta: WorkbookRowMeta[] = [];
    const rowCount = worksheet.rowCount;
    const columnCount = worksheet.columnCount;

    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      const values: string[] = [];
      const fillColors: string[] = [];

      for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
        const cell = row.getCell(columnIndex);
        values.push(safeCellText(cell));
        fillColors.push(fillColor(cell));
      }

      matrix.push(values);
      rowMeta.push({ fillColors });
    }

    return { sheetName: worksheet.name, matrix, rowMeta };
  });

  return { fileName, sheets };
}

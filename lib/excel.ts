import * as XLSX from "xlsx";

export interface WorkbookSheetMatrix {
  sheetName: string;
  matrix: any[][];
}

export interface RawWorkbook {
  fileName: string;
  sheets: WorkbookSheetMatrix[];
}

export function readWorkbookBuffer(buffer: Buffer, fileName: string): RawWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: WorkbookSheetMatrix[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: "",
    });

    sheets.push({ sheetName, matrix });
  }

  return { fileName, sheets };
}

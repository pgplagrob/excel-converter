import * as XLSX from "xlsx-js-style";

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

export function readWorkbookBuffer(buffer: Buffer, fileName: string): RawWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, cellStyles: true });
  const sheets: WorkbookSheetMatrix[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: "",
    });

    const rowMeta: WorkbookRowMeta[] = matrix.map((row, rowIndex) => {
      const fillColors: string[] = [];
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = ws[cellAddress];
        const color =
          cell?.s?.fgColor?.rgb ||
          cell?.s?.fgColor?.indexed?.toString() ||
          cell?.s?.fgColor?.theme?.toString() ||
          "";
        fillColors[colIndex] = color.toUpperCase();
      }
      return { fillColors };
    });

    sheets.push({ sheetName, matrix, rowMeta });
  }

  return { fileName, sheets };
}

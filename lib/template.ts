import path from "path";
import * as XLSX from "xlsx-js-style";

export interface TemplateReferenceValues {
  categories: Set<string>;
  getByMethods: Set<string>;
  sourceFunds: Set<string>;
  statuses: Set<string>;
  booleans: Set<string>;
}

export interface AssetTemplateMetadata {
  columns: string[];
  references: TemplateReferenceValues;
}

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "asset-template.xlsx");

function cellText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function readTemplateWorkbook(): XLSX.WorkBook {
  return XLSX.readFile(TEMPLATE_PATH, { cellDates: true, cellStyles: true });
}

function readSheetRows(ws: XLSX.WorkSheet | undefined): unknown[][] {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
}

function valuesFromReferenceColumn(rows: unknown[][], columnIndex: number): Set<string> {
  return new Set(
    rows
      .slice(1)
      .map((row) => cellText(row[columnIndex]))
      .filter(Boolean),
  );
}

export function loadAssetTemplateMetadata(): AssetTemplateMetadata {
  const wb = readTemplateWorkbook();
  const sheetRows = readSheetRows(wb.Sheets.Sheet1);
  const referenceRows = readSheetRows(wb.Sheets.Reference);
  const columns = (sheetRows[0] || []).map(cellText).filter(Boolean);

  return {
    columns,
    references: {
      categories: valuesFromReferenceColumn(referenceRows, 0),
      getByMethods: valuesFromReferenceColumn(referenceRows, 1),
      sourceFunds: valuesFromReferenceColumn(referenceRows, 2),
      statuses: valuesFromReferenceColumn(referenceRows, 3),
      booleans: valuesFromReferenceColumn(referenceRows, 4),
    },
  };
}

function cloneStyle(value: unknown): unknown {
  return value ? JSON.parse(JSON.stringify(value)) : undefined;
}

function applyTemplateStyles(
  target: XLSX.WorkSheet,
  source: XLSX.WorkSheet,
  columns: string[],
  rowCount: number,
): void {
  target["!cols"] = source["!cols"];
  target["!rows"] = source["!rows"] ? source["!rows"].slice(0, Math.max(1, rowCount + 1)) : undefined;

  for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
    const headerAddress = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    const sampleAddress = XLSX.utils.encode_cell({ r: 1, c: colIndex });
    const headerStyle = cloneStyle(source[headerAddress]?.s);
    const sampleStyle = cloneStyle(source[sampleAddress]?.s);

    if (target[headerAddress] && headerStyle) target[headerAddress].s = headerStyle;

    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!target[address]) target[address] = { t: "s", v: "" };
      if (sampleStyle) target[address].s = cloneStyle(sampleStyle);
    }
  }
}

export function buildAssetTemplateWorkbook(rows: Record<string, unknown>[]): XLSX.WorkBook {
  const wb = readTemplateWorkbook();
  const metadata = loadAssetTemplateMetadata();
  const sourceSheet = wb.Sheets.Sheet1;
  const aoa = [
    metadata.columns,
    ...rows.map((row) => metadata.columns.map((column) => row[column] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  if (sourceSheet) {
    applyTemplateStyles(ws, sourceSheet, metadata.columns, rows.length);
  }

  wb.Sheets.Sheet1 = ws;
  wb.SheetNames = ["Sheet1", ...wb.SheetNames.filter((name) => name !== "Sheet1")];
  return wb;
}

export function getAssetTemplatePath(): string {
  return TEMPLATE_PATH;
}

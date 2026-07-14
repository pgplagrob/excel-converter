import { readFile } from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";

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

export interface AssetTemplateSheetInput {
  sheetName: string;
  rows: Record<string, unknown>[];
}

type TemplateLayout = {
  columns: { width?: number; hidden?: boolean }[];
  headerStyles: unknown[];
  rowStyles: unknown[];
  headerHeight?: number;
  rowHeight?: number;
};

type WorksheetSnapshot = {
  columns: { width?: number; hidden?: boolean }[];
  rows: { height?: number; cells: { value: unknown; style: unknown }[] }[];
  merges: string[];
};

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "asset-template.xlsx");

function cellText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    const cellValue = value as { richText?: { text: string }[]; text?: string };
    if (cellValue.richText) return cellValue.richText.map((part) => part.text).join("").trim();
    if (cellValue.text) return cellValue.text.trim();
  }
  return String(value).trim();
}

async function readTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // readFile returns a Node Buffer which may differ from ExcelJS.Buffer type
  // cast through unknown to satisfy the ExcelJS type signature
  await workbook.xlsx.load((await readFile(TEMPLATE_PATH)) as unknown as ExcelJS.Buffer);
  return workbook;
}

function readSheetRows(worksheet: ExcelJS.Worksheet | undefined): unknown[][] {
  if (!worksheet) return [];

  const rows: unknown[][] = [];
  const rowCount = worksheet.rowCount;
  const columnCount = worksheet.columnCount;
  for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    rows.push(
      Array.from({ length: columnCount }, (_, columnIndex) => row.getCell(columnIndex + 1).value ?? ""),
    );
  }
  return rows;
}

function valuesFromReferenceColumn(rows: unknown[][], columnIndex: number): Set<string> {
  return new Set(
    rows
      .slice(1)
      .map((row) => cellText(row[columnIndex]))
      .filter(Boolean),
  );
}

export async function loadAssetTemplateMetadata(): Promise<AssetTemplateMetadata> {
  const workbook = await readTemplateWorkbook();
  const sheetRows = readSheetRows(workbook.getWorksheet("Sheet1"));
  const referenceRows = readSheetRows(workbook.getWorksheet("Reference"));
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

function captureTemplateLayout(source: ExcelJS.Worksheet, columnCount: number): TemplateLayout {
  const headerRow = source.getRow(1);
  const dataRow = source.getRow(2);
  return {
    columns: Array.from({ length: columnCount }, (_, index) => {
      const column = source.getColumn(index + 1);
      return { width: column.width, hidden: column.hidden };
    }),
    headerStyles: Array.from({ length: columnCount }, (_, index) => cloneStyle(headerRow.getCell(index + 1).style)),
    rowStyles: Array.from({ length: columnCount }, (_, index) => cloneStyle(dataRow.getCell(index + 1).style)),
    headerHeight: headerRow.height,
    rowHeight: dataRow.height,
  };
}

function applyTemplateSheet(
  target: ExcelJS.Worksheet,
  rows: Record<string, unknown>[],
  columns: string[],
  layout: TemplateLayout,
): void {
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = target.getColumn(columnIndex + 1);
    column.width = layout.columns[columnIndex]?.width;
    column.hidden = layout.columns[columnIndex]?.hidden;

    const headerCell = target.getRow(1).getCell(columnIndex + 1);
    headerCell.value = columns[columnIndex];
    headerCell.style = cloneStyle(layout.headerStyles[columnIndex]) as any;
  }
  target.getRow(1).height = layout.headerHeight;

  rows.forEach((row, rowOffset) => {
    const targetRow = target.getRow(rowOffset + 2);
    targetRow.height = layout.rowHeight;
    columns.forEach((column, columnIndex) => {
      const cell = targetRow.getCell(columnIndex + 1);
      cell.value = (row[column] ?? "") as any;
      cell.style = cloneStyle(layout.rowStyles[columnIndex]) as any;
    });
  });
}

function clearTemplateData(sheet: ExcelJS.Worksheet): void {
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    sheet.getRow(rowIndex).values = [];
  }
}

function captureWorksheet(source: ExcelJS.Worksheet): WorksheetSnapshot {
  return {
    columns: Array.from({ length: source.columnCount }, (_, index) => {
      const column = source.getColumn(index + 1);
      return { width: column.width, hidden: column.hidden };
    }),
    rows: Array.from({ length: source.rowCount }, (_, rowIndex) => {
      const row = source.getRow(rowIndex + 1);
      return {
        height: row.height,
        cells: Array.from({ length: source.columnCount }, (_, columnIndex) => {
          const cell = row.getCell(columnIndex + 1);
          return { value: cell.value, style: cloneStyle(cell.style) };
        }),
      };
    }),
    merges: source.model.merges || [],
  };
}

function restoreWorksheet(target: ExcelJS.Worksheet, snapshot: WorksheetSnapshot): void {
  snapshot.columns.forEach((column, index) => {
    target.getColumn(index + 1).width = column.width;
    target.getColumn(index + 1).hidden = column.hidden;
  });
  snapshot.rows.forEach((sourceRow, rowIndex) => {
    const targetRow = target.getRow(rowIndex + 1);
    targetRow.height = sourceRow.height;
    sourceRow.cells.forEach((sourceCell, columnIndex) => {
      const targetCell = targetRow.getCell(columnIndex + 1);
      targetCell.value = sourceCell.value as any;
      targetCell.style = sourceCell.style as any;
    });
  });
  snapshot.merges.forEach((range) => target.mergeCells(range));
}

function sanitizeSheetName(value: string): string {
  const cleaned = (value || "Sheet")
    .replace(/[\[\]\:\*\?\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "Sheet").slice(0, 31);
}

function uniqueSheetName(rawName: string, usedNames: Set<string>): string {
  const baseName = sanitizeSheetName(rawName);
  let name = baseName;
  let counter = 2;

  while (usedNames.has(name.toLowerCase())) {
    const suffix = ` (${counter})`;
    name = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
    counter += 1;
  }

  usedNames.add(name.toLowerCase());
  return name;
}

export async function buildAssetTemplateWorkbook(rows: Record<string, unknown>[]): Promise<ExcelJS.Workbook> {
  const workbook = await readTemplateWorkbook();
  const metadata = await loadAssetTemplateMetadata();
  const sheet = workbook.getWorksheet("Sheet1");
  if (!sheet) throw new Error("The asset template is missing Sheet1.");

  const layout = captureTemplateLayout(sheet, metadata.columns.length);
  clearTemplateData(sheet);
  applyTemplateSheet(sheet, rows, metadata.columns, layout);
  return workbook;
}

export async function buildAssetTemplateWorkbookBySheet(
  sheets: AssetTemplateSheetInput[],
): Promise<ExcelJS.Workbook> {
  const workbook = await readTemplateWorkbook();
  const metadata = await loadAssetTemplateMetadata();
  const templateSheet = workbook.getWorksheet("Sheet1");
  const referenceSheet = workbook.getWorksheet("Reference");
  if (!templateSheet) throw new Error("The asset template is missing Sheet1.");

  const layout = captureTemplateLayout(templateSheet, metadata.columns.length);
  const referenceSnapshot = referenceSheet ? captureWorksheet(referenceSheet) : undefined;
  const usedNames = new Set<string>(referenceSheet ? ["reference"] : []);

  sheets.forEach((sheet, index) => {
    const sheetName = uniqueSheetName(sheet.sheetName, usedNames);
    const target = index === 0 ? templateSheet : workbook.addWorksheet(sheetName);
    if (index === 0) {
      target.name = sheetName;
      clearTemplateData(target);
    }
    applyTemplateSheet(target, sheet.rows, metadata.columns, layout);
  });

  if (referenceSheet && referenceSnapshot) {
    workbook.removeWorksheet(referenceSheet.id);
    const restoredReference = workbook.addWorksheet("Reference");
    restoreWorksheet(restoredReference, referenceSnapshot);
  }

  return workbook;
}

export function getAssetTemplatePath(): string {
  return TEMPLATE_PATH;
}

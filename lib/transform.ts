import { TEMPLATE_COLUMNS } from "./mapping";

export type TemplateMapping = Record<string, string | null | undefined>;

export interface TransformSheetInput {
  sheetName: string;
  rows: Record<string, any>[];
  mapping: TemplateMapping;
}

const DATE_COLUMN_INDEXES = new Set([17, 18, 19, 20, 21, 34]);
const MISSING_DATE_PART = "....";

function cellText(value: any): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

function padDatePart(value: string): string {
  return /^\d$/.test(value) ? value.padStart(2, "0") : value;
}

function formatDateParts(day: string, month: string, year: string): string {
  return [day || MISSING_DATE_PART, month || MISSING_DATE_PART, year || MISSING_DATE_PART]
    .map((part, index) => (index < 2 && part !== MISSING_DATE_PART ? padDatePart(part) : part))
    .join("/");
}

function normalizeFullDateText(value: any): string | null {
  const text = cellText(value);
  if (!text) return null;

  const yearFirstMatch = text.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (yearFirstMatch) {
    return formatDateParts(yearFirstMatch[3], yearFirstMatch[2], yearFirstMatch[1]);
  }

  const dayFirstMatch = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dayFirstMatch) {
    return formatDateParts(dayFirstMatch[1], dayFirstMatch[2], dayFirstMatch[3]);
  }

  return null;
}

function looksLikeDatePart(value: string): boolean {
  return /^\d{1,4}$/.test(value);
}

function buildDateFromSourceColumns(sourceRow: Record<string, any>, sourceColumn: string): any {
  const value = sourceRow[sourceColumn] ?? "";
  const fullDate = normalizeFullDateText(value);
  if (fullDate) return fullDate;

  const keys = Object.keys(sourceRow);
  const sourceIndex = keys.indexOf(sourceColumn);
  const day = cellText(value);
  if (sourceIndex < 0 || !looksLikeDatePart(day)) return value;

  const nextValue = cellText(sourceRow[keys[sourceIndex + 1]]);
  const thirdValue = cellText(sourceRow[keys[sourceIndex + 2]]);

  if (thirdValue) {
    return formatDateParts(day, nextValue, thirdValue);
  }

  const nextIsYear = /^\d{4}$/.test(nextValue);
  const month = nextValue && !nextIsYear ? nextValue : "";
  const year = nextIsYear ? nextValue : "";

  return formatDateParts(day, month, year);
}

export function transformRowsToTemplateDataset(
  rows: Record<string, any>[],
  mapping: TemplateMapping,
): Record<string, any>[] {
  return rows.map((sourceRow) => {
    const templateRow: Record<string, any> = {};

    TEMPLATE_COLUMNS.forEach((templateColumn, templateIndex) => {
      const sourceColumn = mapping[templateColumn];
      if (!sourceColumn) {
        templateRow[templateColumn] = "";
        return;
      }

      templateRow[templateColumn] = DATE_COLUMN_INDEXES.has(templateIndex)
        ? buildDateFromSourceColumns(sourceRow, sourceColumn)
        : sourceRow[sourceColumn] ?? "";
    });

    return templateRow;
  });
}

export function logTemplateDataset(
  sheetName: string,
  rows: Record<string, any>[],
  mapping: TemplateMapping,
): void {
  console.log("[Transform] template dataset", {
    sheetName,
    rowCount: rows.length,
    mappedColumns: Object.entries(mapping)
      .filter(([, sourceColumn]) => Boolean(sourceColumn))
      .map(([templateColumn, sourceColumn]) => ({ templateColumn, sourceColumn })),
    sampleRows: rows.slice(0, 5),
  });
}

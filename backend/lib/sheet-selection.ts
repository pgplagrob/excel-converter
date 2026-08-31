import type { SheetData, SheetOverview } from "./client-types";

export type SheetSelection = Record<string, boolean>;

export function isSheetSelectedByDefault(sheet: SheetOverview): boolean {
  return (
    sheet.eligibility === "exportable" &&
    sheet.sourceProfile !== "UNKNOWN" &&
    sheet.rowCount > 0 &&
    sheet.errorCount === 0
  );
}

export function createDefaultSheetSelection(sheets: SheetOverview[]): SheetSelection {
  return Object.fromEntries(
    sheets.map((sheet) => [sheet.sheetName, isSheetSelectedByDefault(sheet)]),
  );
}

export function createParsedSheetSelection(
  sheets: SheetData[],
  overview: SheetOverview[],
): SheetSelection {
  const defaults = createDefaultSheetSelection(overview);
  return Object.fromEntries(
    sheets.map((sheet) => [sheet.sheetName, defaults[sheet.sheetName] === true]),
  );
}

export function selectedSheetCount(selection: SheetSelection): number {
  return Object.values(selection).filter(Boolean).length;
}

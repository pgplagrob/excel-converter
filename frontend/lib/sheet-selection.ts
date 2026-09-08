import type { SheetData, SheetOverview } from "./client-types";

export type SheetSelection = Record<string, boolean>;

export function isConvertibleSheet(
  sheet: Pick<SheetData | SheetOverview, "eligibility" | "rowCount">,
): boolean {
  return (
    (sheet.eligibility === "exportable" || sheet.eligibility === "needsReview")
    && sheet.rowCount > 0
  );
}

export function createEmptySheetSelection(sheets: SheetOverview[]): SheetSelection {
  return Object.fromEntries(
    sheets.map((sheet) => [sheet.sheetName, false]),
  );
}

export function createParsedSheetSelection(
  sheets: SheetData[],
  overview: SheetOverview[],
): SheetSelection {
  const selection = createEmptySheetSelection(overview);
  for (const sheet of sheets) selection[sheet.sheetName] = false;
  return selection;
}

export function selectAllConvertibleSheets(sheets: SheetData[]): SheetSelection {
  return Object.fromEntries(
    sheets.map((sheet) => [sheet.sheetName, isConvertibleSheet(sheet)]),
  );
}

export function selectedSheetCount(selection: SheetSelection): number {
  return Object.values(selection).filter(Boolean).length;
}

export function selectedConvertibleSheetCount(
  sheets: SheetData[],
  selection: SheetSelection,
): number {
  return sheets.filter(
    (sheet) => isConvertibleSheet(sheet) && selection[sheet.sheetName] === true,
  ).length;
}

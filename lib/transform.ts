import { TEMPLATE_COLUMNS } from "./mapping";

export type TemplateMapping = Record<string, string | null | undefined>;

export interface TransformSheetInput {
  sheetName: string;
  rows: Record<string, any>[];
  mapping: TemplateMapping;
}

export function transformRowsToTemplateDataset(
  rows: Record<string, any>[],
  mapping: TemplateMapping,
): Record<string, any>[] {
  return rows.map((sourceRow) => {
    const templateRow: Record<string, any> = {};

    for (const templateColumn of TEMPLATE_COLUMNS) {
      const sourceColumn = mapping[templateColumn];
      templateRow[templateColumn] = sourceColumn ? sourceRow[sourceColumn] ?? "" : "";
    }

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

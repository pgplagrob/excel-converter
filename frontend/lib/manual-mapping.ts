import { TEMPLATE_COLUMNS } from "./mapping";

export type ManualMapping = Record<string, string | null>;

export function hasManualOverride(mapping: ManualMapping, templateColumn: string): boolean {
  return Object.prototype.hasOwnProperty.call(mapping, templateColumn);
}

export function setManualMappingOverride(
  mapping: ManualMapping,
  templateColumn: string,
  sourceColumn: string | null | undefined,
): ManualMapping {
  if (sourceColumn === undefined) {
    const next = { ...mapping };
    delete next[templateColumn];
    return next;
  }
  return { ...mapping, [templateColumn]: sourceColumn };
}

export function effectiveSourceColumn(
  automaticSourceColumn: string | null,
  manualMapping: ManualMapping,
  templateColumn: string,
): string | null {
  return hasManualOverride(manualMapping, templateColumn)
    ? manualMapping[templateColumn]
    : automaticSourceColumn;
}

export function applyManualMappingPreview(
  automaticTemplateRows: Record<string, any>[],
  sourceRows: Record<string, any>[],
  manualMapping: ManualMapping,
): Record<string, any>[] {
  return automaticTemplateRows.map((automaticRow, index) => {
    const next = { ...automaticRow };
    const sourceRow = sourceRows[index] || {};
    for (const [templateColumn, sourceColumn] of Object.entries(manualMapping)) {
      if (!TEMPLATE_COLUMNS.includes(templateColumn)) continue;
      next[templateColumn] = sourceColumn === null ? "" : sourceRow[sourceColumn] ?? "";
    }
    return next;
  });
}

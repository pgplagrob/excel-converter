import type { MappingSuggestion, SheetData } from "./client-types";
import { hasManualOverride, type ManualMapping } from "./manual-mapping";

export type SourceMappingStatus = "unresolved" | "suggested" | "manual";
export type SourceMappingFilter = "all" | SourceMappingStatus;

export interface SourceFirstMapping {
  sourceColumn: string;
  sourceKind: "original" | "parser";
  sampleValues: string[];
  autoTemplateColumns: string[];
  templateColumns: string[];
  status: SourceMappingStatus;
  reason: string;
}

export interface MappingUpdate {
  templateColumn: string;
  sourceColumn: string | null | undefined;
}

function hasValue(value: unknown): boolean {
  return value !== "" && value !== undefined && value !== null;
}

export function visibleSourceColumns(headers: string[]): string[] {
  return headers.filter((header) => header.length > 0 && !header.startsWith("__"));
}

export function sourceSampleValues(
  rows: Record<string, any>[],
  sourceColumn: string,
  limit = 5,
): string[] {
  const samples: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const value = row[sourceColumn];
    if (!hasValue(value)) continue;
    const text = String(value);
    if (seen.has(text)) continue;
    seen.add(text);
    samples.push(text);
    if (samples.length === limit) break;
  }
  return samples;
}

export function effectiveMappingSource(
  mapping: MappingSuggestion,
  manualMapping: ManualMapping,
): string | null {
  return hasManualOverride(manualMapping, mapping.templateColumn)
    ? manualMapping[mapping.templateColumn]
    : mapping.sourceColumn;
}

export function buildSourceFirstMappings(
  sheet: Pick<SheetData, "headers" | "rows" | "mapping" | "templateSampleRows">,
  manualMapping: ManualMapping,
): SourceFirstMapping[] {
  const sourceColumns = visibleSourceColumns(sheet.headers);
  const internalBoundary = sheet.headers.indexOf("__sourceProfile");
  const automaticSourceByTemplate = new Map(
    sheet.mapping.map((mapping) => [
      mapping.templateColumn,
      mapping.sourceColumn || inferParserSourceColumn(
        sourceColumns,
        sheet.headers,
        sheet.rows,
        sheet.templateSampleRows || [],
        mapping.templateColumn,
      ),
    ]),
  );

  return sourceColumns
    .map((sourceColumn) => {
      const sampleValues = sourceSampleValues(sheet.rows, sourceColumn);
      if (sampleValues.length === 0) return null;

      const autoTemplateColumns = sheet.mapping
        .filter((mapping) => automaticSourceByTemplate.get(mapping.templateColumn) === sourceColumn)
        .map((mapping) => mapping.templateColumn);
      const templateColumns = sheet.mapping
        .filter((mapping) => (
          hasManualOverride(manualMapping, mapping.templateColumn)
            ? manualMapping[mapping.templateColumn]
            : automaticSourceByTemplate.get(mapping.templateColumn)
        ) === sourceColumn)
        .map((mapping) => mapping.templateColumn);
      const hasManualDecision = sheet.mapping.some((mapping) => (
        (hasManualOverride(manualMapping, mapping.templateColumn)
          && manualMapping[mapping.templateColumn] === sourceColumn)
        || (automaticSourceByTemplate.get(mapping.templateColumn) === sourceColumn
          && hasManualOverride(manualMapping, mapping.templateColumn))
      ));
      const sourceIndex = sheet.headers.indexOf(sourceColumn);
      const sourceKind = internalBoundary >= 0 && sourceIndex > internalBoundary
        ? "parser" as const
        : "original" as const;
      const status: SourceMappingStatus = templateColumns.length === 0
        ? "unresolved"
        : hasManualDecision
          ? "manual"
          : "suggested";
      const reason = status === "unresolved"
        ? "ยังไม่มีช่องในไฟล์ผลลัพธ์รับข้อมูลจากคอลัมน์นี้"
        : status === "manual"
          ? "ปลายทางนี้ถูกปรับโดยคุณ"
          : autoTemplateColumns.length > 1
            ? `กติกา Parser ใช้คอลัมน์นี้กับ ${autoTemplateColumns.length} ช่องผลลัพธ์`
            : sourceKind === "parser"
              ? "ระบบอ่านค่านี้จากโครงสร้างไฟล์แล้วแนะนำปลายทาง"
              : "ระบบจับคู่จากหัวคอลัมน์และโครงสร้างไฟล์";

      return {
        sourceColumn,
        sourceKind,
        sampleValues,
        autoTemplateColumns,
        templateColumns,
        status,
        reason,
      };
    })
    .filter((mapping): mapping is SourceFirstMapping => mapping !== null);
}

function inferParserSourceColumn(
  sourceColumns: string[],
  headers: string[],
  sourceRows: Record<string, any>[],
  templateRows: Record<string, any>[],
  templateColumn: string,
): string | null {
  const internalBoundary = headers.indexOf("__sourceProfile");
  let best: { sourceColumn: string; matches: number; parserField: boolean } | null = null;
  for (const sourceColumn of sourceColumns) {
    let matches = 0;
    let conflicts = 0;
    for (let index = 0; index < templateRows.length; index += 1) {
      const templateValue = templateRows[index]?.[templateColumn];
      const sourceValue = sourceRows[index]?.[sourceColumn];
      if (!hasValue(templateValue) || !hasValue(sourceValue)) continue;
      if (String(templateValue) === String(sourceValue)) matches += 1;
      else conflicts += 1;
    }
    if (matches === 0 || conflicts > 0) continue;
    const sourceIndex = headers.indexOf(sourceColumn);
    const parserField = internalBoundary >= 0 && sourceIndex > internalBoundary;
    if (!best
      || matches > best.matches
      || (matches === best.matches && parserField && !best.parserField)) {
      best = { sourceColumn, matches, parserField };
    }
  }
  return best?.sourceColumn || null;
}

export function destinationOwners(
  sourceMappings: SourceFirstMapping[],
): Map<string, string> {
  const owners = new Map<string, string>();
  for (const source of sourceMappings) {
    for (const templateColumn of source.templateColumns) {
      if (!owners.has(templateColumn)) owners.set(templateColumn, source.sourceColumn);
    }
  }
  return owners;
}

export function filterSourceFirstMappings(
  sourceMappings: SourceFirstMapping[],
  filter: SourceMappingFilter,
  searchText: string,
): SourceFirstMapping[] {
  const normalizedSearch = searchText.trim().toLocaleLowerCase("th-TH");
  return sourceMappings.filter((mapping) => {
    if (filter !== "all" && mapping.status !== filter) return false;
    if (!normalizedSearch) return true;
    return [
      mapping.sourceColumn,
      ...mapping.templateColumns,
      ...mapping.autoTemplateColumns,
    ].some((value) => value.toLocaleLowerCase("th-TH").includes(normalizedSearch));
  });
}

export function assignSourceDestination(
  source: SourceFirstMapping,
  templateColumn: string,
  suggestions: MappingSuggestion[],
  manualMapping: ManualMapping,
): MappingUpdate[] {
  const updates: MappingUpdate[] = [];
  for (const currentTemplateColumn of source.templateColumns) {
    if (currentTemplateColumn === templateColumn) continue;
    const suggestion = suggestions.find(
      (item) => item.templateColumn === currentTemplateColumn,
    );
    updates.push({
      templateColumn: currentTemplateColumn,
      sourceColumn: source.autoTemplateColumns.includes(currentTemplateColumn)
        ? null
        : suggestion?.sourceColumn === source.sourceColumn
          ? null
          : undefined,
    });
  }

  const currentSource = suggestions
    .map((mapping) => ({
      templateColumn: mapping.templateColumn,
      sourceColumn: effectiveMappingSource(mapping, manualMapping),
    }))
    .find((mapping) => mapping.templateColumn === templateColumn)?.sourceColumn;
  if (currentSource !== source.sourceColumn) {
    updates.push({ templateColumn, sourceColumn: source.sourceColumn });
  }
  return updates;
}

export function resetSourceToSuggestions(
  source: SourceFirstMapping,
  suggestions: MappingSuggestion[],
  manualMapping: ManualMapping,
): MappingUpdate[] {
  return suggestions
    .filter((mapping) => (
      hasManualOverride(manualMapping, mapping.templateColumn)
      && (source.autoTemplateColumns.includes(mapping.templateColumn)
        || mapping.sourceColumn === source.sourceColumn
        || manualMapping[mapping.templateColumn] === source.sourceColumn)
    ))
    .map((mapping) => ({
      templateColumn: mapping.templateColumn,
      sourceColumn: undefined,
    }));
}

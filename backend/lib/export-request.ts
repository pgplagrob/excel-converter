import type {
  CellOverrides,
  ExportMode,
  ExportRequest,
  ExportSheetInput,
  MappingSuggestion,
} from "./client-types";
import { TEMPLATE_COLUMNS } from "./mapping";

const MAX_SHEETS = 100;
const MAX_MAPPINGS = TEMPLATE_COLUMNS.length;
const MAX_NAME_LENGTH = 255;
const MAX_SOURCE_COLUMN_LENGTH = 500;
const MAX_HEADER_ROW = 50_000;
const MAX_ROW_INDEX = MAX_HEADER_ROW - 1;
const MAX_OVERRIDE_ROWS = 5_000;
const MAX_CELL_OVERRIDES = 10_000;
const MAX_EXCLUDED_ROWS = MAX_HEADER_ROW;
const MAX_CELL_VALUE_LENGTH = 32_767;
const TEMPLATE_COLUMN_SET = new Set(TEMPLATE_COLUMNS);

const MODES = new Set<ExportMode>(["validate", "download"]);
const CONFIDENCES = new Set<MappingSuggestion["confidence"]>(["high", "medium", "low", "none"]);
const STATUSES = new Set<MappingSuggestion["status"]>(["matched", "guessed", "missing", "manual"]);
const METHODS = new Set<MappingSuggestion["method"]>(["exact", "alias", "fuzzy", "profile", "none"]);

export class ExportRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportRequestValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, maxLength = MAX_NAME_LENGTH): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ExportRequestValidationError(`${field} must be a non-empty string.`);
  }
  if (value.length > maxLength) {
    throw new ExportRequestValidationError(`${field} is too long.`);
  }
  return value;
}

function optionalString(value: unknown, field: string, maxLength = MAX_NAME_LENGTH): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field, maxLength);
}

function parseMapping(value: unknown, field: string): Record<string, string | null> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new ExportRequestValidationError(`${field} must be an object.`);
  }

  const entries = Object.entries(value);
  if (entries.length > MAX_MAPPINGS) {
    throw new ExportRequestValidationError(`${field} has too many columns.`);
  }

  return Object.fromEntries(entries.map(([templateColumn, sourceColumn]) => {
    if (!TEMPLATE_COLUMN_SET.has(templateColumn)) {
      throw new ExportRequestValidationError(`${field} contains an unknown template column.`);
    }
    if (sourceColumn !== null && typeof sourceColumn !== "string") {
      throw new ExportRequestValidationError(`${field}.${templateColumn} must be a string or null.`);
    }
    if (typeof sourceColumn === "string" && sourceColumn.length > MAX_SOURCE_COLUMN_LENGTH) {
      throw new ExportRequestValidationError(`${field}.${templateColumn} is too long.`);
    }
    return [templateColumn, sourceColumn];
  }));
}

function parseSuggestion(value: unknown, field: string): MappingSuggestion {
  if (!isRecord(value)) {
    throw new ExportRequestValidationError(`${field} must be an object.`);
  }

  const templateColumn = requiredString(value.templateColumn, `${field}.templateColumn`);
  if (!TEMPLATE_COLUMN_SET.has(templateColumn)) {
    throw new ExportRequestValidationError(`${field}.templateColumn is unknown.`);
  }
  if (value.sourceColumn !== null && typeof value.sourceColumn !== "string") {
    throw new ExportRequestValidationError(`${field}.sourceColumn must be a string or null.`);
  }
  if (typeof value.sourceColumn === "string" && value.sourceColumn.length > MAX_SOURCE_COLUMN_LENGTH) {
    throw new ExportRequestValidationError(`${field}.sourceColumn is too long.`);
  }
  if (!CONFIDENCES.has(value.confidence as MappingSuggestion["confidence"])) {
    throw new ExportRequestValidationError(`${field}.confidence is invalid.`);
  }
  if (typeof value.confidenceScore !== "number" || !Number.isFinite(value.confidenceScore)) {
    throw new ExportRequestValidationError(`${field}.confidenceScore must be a finite number.`);
  }
  if (!STATUSES.has(value.status as MappingSuggestion["status"])) {
    throw new ExportRequestValidationError(`${field}.status is invalid.`);
  }
  if (!METHODS.has(value.method as MappingSuggestion["method"])) {
    throw new ExportRequestValidationError(`${field}.method is invalid.`);
  }

  return {
    templateColumn,
    sourceColumn: value.sourceColumn,
    confidence: value.confidence as MappingSuggestion["confidence"],
    confidenceScore: value.confidenceScore,
    status: value.status as MappingSuggestion["status"],
    method: value.method as MappingSuggestion["method"],
  };
}

function parseRowIndex(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_ROW_INDEX) {
    throw new ExportRequestValidationError(
      `${field} must be an integer between 0 and ${MAX_ROW_INDEX}.`,
    );
  }
  return value as number;
}

export function validateRowFixRanges(sheet: ExportSheetInput, rowCount: number): void {
  for (const rowIndexKey of Object.keys(sheet.cellOverrides || {})) {
    if (Number(rowIndexKey) >= rowCount) {
      throw new ExportRequestValidationError(
        `cellOverrides row index ${rowIndexKey} is outside sheet ${sheet.sheetName}.`,
      );
    }
  }
  for (const rowIndex of sheet.excludedRows || []) {
    if (rowIndex >= rowCount) {
      throw new ExportRequestValidationError(
        `excludedRows row index ${rowIndex} is outside sheet ${sheet.sheetName}.`,
      );
    }
  }
}

function parseCellOverrides(value: unknown, field: string): CellOverrides | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new ExportRequestValidationError(`${field} must be an object.`);
  }

  const rowEntries = Object.entries(value);
  if (rowEntries.length > MAX_OVERRIDE_ROWS) {
    throw new ExportRequestValidationError(`${field} has too many overridden rows.`);
  }

  let overrideCount = 0;
  const parsed: CellOverrides = {};
  for (const [rowIndexKey, rowValue] of rowEntries) {
    if (!/^(0|[1-9]\d*)$/.test(rowIndexKey)) {
      throw new ExportRequestValidationError(`${field} contains an invalid row index.`);
    }
    const rowIndex = parseRowIndex(Number(rowIndexKey), `${field}.${rowIndexKey}`);
    if (!isRecord(rowValue)) {
      throw new ExportRequestValidationError(`${field}.${rowIndexKey} must be an object.`);
    }

    const cellEntries = Object.entries(rowValue);
    if (cellEntries.length > MAX_MAPPINGS) {
      throw new ExportRequestValidationError(`${field}.${rowIndexKey} has too many columns.`);
    }
    overrideCount += cellEntries.length;
    if (overrideCount > MAX_CELL_OVERRIDES) {
      throw new ExportRequestValidationError(`${field} has too many cell overrides.`);
    }

    parsed[rowIndex] = Object.fromEntries(cellEntries.map(([column, cellValue]) => {
      if (!TEMPLATE_COLUMN_SET.has(column)) {
        throw new ExportRequestValidationError(`${field}.${rowIndexKey} contains an unknown template column.`);
      }
      if (typeof cellValue !== "string") {
        throw new ExportRequestValidationError(`${field}.${rowIndexKey}.${column} must be a string.`);
      }
      if (cellValue.length > MAX_CELL_VALUE_LENGTH) {
        throw new ExportRequestValidationError(`${field}.${rowIndexKey}.${column} is too long.`);
      }
      return [column, cellValue];
    }));
  }
  return parsed;
}

function parseExcludedRows(value: unknown, field: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_EXCLUDED_ROWS) {
    throw new ExportRequestValidationError(`${field} must be an array with at most ${MAX_EXCLUDED_ROWS} entries.`);
  }

  const rows = value.map((rowIndex, index) => parseRowIndex(rowIndex, `${field}[${index}]`));
  if (new Set(rows).size !== rows.length) {
    throw new ExportRequestValidationError(`${field} contains duplicate row indices.`);
  }
  return rows;
}

function parseSheet(value: unknown, index: number): ExportSheetInput {
  const field = `sheets[${index}]`;
  if (!isRecord(value)) {
    throw new ExportRequestValidationError(`${field} must be an object.`);
  }

  const sheetName = requiredString(value.sheetName, `${field}.sheetName`);
  let headerRow: number | undefined;
  if (value.headerRow !== undefined) {
    if (!Number.isInteger(value.headerRow) || (value.headerRow as number) < 1 || (value.headerRow as number) > MAX_HEADER_ROW) {
      throw new ExportRequestValidationError(`${field}.headerRow must be an integer between 1 and ${MAX_HEADER_ROW}.`);
    }
    headerRow = value.headerRow as number;
  }

  let autoMapping: MappingSuggestion[] | undefined;
  if (value.autoMapping !== undefined) {
    if (!Array.isArray(value.autoMapping) || value.autoMapping.length > MAX_MAPPINGS) {
      throw new ExportRequestValidationError(`${field}.autoMapping is invalid.`);
    }
    autoMapping = value.autoMapping.map((item, mappingIndex) =>
      parseSuggestion(item, `${field}.autoMapping[${mappingIndex}]`),
    );
  }

  return {
    sheetName,
    ...(headerRow !== undefined ? { headerRow } : {}),
    ...(autoMapping !== undefined ? { autoMapping } : {}),
    ...(value.manualMapping !== undefined
      ? { manualMapping: parseMapping(value.manualMapping, `${field}.manualMapping`) }
      : {}),
    ...(value.mapping !== undefined ? { mapping: parseMapping(value.mapping, `${field}.mapping`) } : {}),
    ...(value.cellOverrides !== undefined
      ? { cellOverrides: parseCellOverrides(value.cellOverrides, `${field}.cellOverrides`) }
      : {}),
    ...(value.excludedRows !== undefined
      ? { excludedRows: parseExcludedRows(value.excludedRows, `${field}.excludedRows`) }
      : {}),
  };
}

export function parseExportRequest(value: unknown): ExportRequest {
  if (!isRecord(value)) {
    throw new ExportRequestValidationError("Request body must be a JSON object.");
  }

  const mode = value.mode === undefined ? undefined : value.mode;
  if (mode !== undefined && !MODES.has(mode as ExportMode)) {
    throw new ExportRequestValidationError("mode must be validate or download.");
  }

  const analysisId = requiredString(value.analysisId, "analysisId", 128);
  if (!Array.isArray(value.sheets) || value.sheets.length === 0 || value.sheets.length > MAX_SHEETS) {
    throw new ExportRequestValidationError(`sheets must contain between 1 and ${MAX_SHEETS} entries.`);
  }

  const sheets = value.sheets.map(parseSheet);
  const normalizedNames = sheets.map((sheet) => sheet.sheetName.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    throw new ExportRequestValidationError("sheets contains duplicate sheet names.");
  }

  return {
    ...(mode !== undefined ? { mode: mode as ExportMode } : {}),
    analysisId,
    sourceFileName: optionalString(value.sourceFileName, "sourceFileName"),
    sheets,
  };
}

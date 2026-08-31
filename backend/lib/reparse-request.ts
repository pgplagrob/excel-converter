export interface ReparseSheetRequest {
  analysisId: string;
  sheetName: string;
  headerRow: number;
  dataStartRow?: number;
  dataEndRow?: number;
}

export class ReparseRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReparseRequestValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ReparseRequestValidationError(`${field} must be a non-empty string.`);
  }
  return value;
}

function requiredRow(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new ReparseRequestValidationError(`${field} must be a positive integer.`);
  }
  return value as number;
}

function optionalRow(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : requiredRow(value, field);
}

export function parseReparseSheetRequest(value: unknown): ReparseSheetRequest {
  if (!isRecord(value)) {
    throw new ReparseRequestValidationError("Request body must be a JSON object.");
  }

  const analysisId = requiredString(value.analysisId, "analysisId");
  const sheetName = requiredString(value.sheetName, "sheetName");
  const headerRow = requiredRow(value.headerRow, "headerRow");
  const dataStartRow = optionalRow(value.dataStartRow, "dataStartRow");
  const dataEndRow = optionalRow(value.dataEndRow, "dataEndRow");

  if (dataStartRow !== undefined && dataStartRow <= headerRow) {
    throw new ReparseRequestValidationError("dataStartRow must be greater than headerRow.");
  }
  const effectiveDataStartRow = dataStartRow ?? headerRow + 1;
  if (dataEndRow !== undefined && effectiveDataStartRow >= dataEndRow) {
    throw new ReparseRequestValidationError("dataStartRow must be less than dataEndRow.");
  }

  return {
    analysisId,
    sheetName,
    headerRow,
    ...(dataStartRow !== undefined ? { dataStartRow } : {}),
    ...(dataEndRow !== undefined ? { dataEndRow } : {}),
  };
}

export function validateReparseSheetBounds(
  request: ReparseSheetRequest,
  matrixLength: number,
): void {
  if (request.headerRow > matrixLength) {
    throw new ReparseRequestValidationError(
      `headerRow must be between 1 and ${matrixLength}.`,
    );
  }
  if (request.dataEndRow !== undefined && request.dataEndRow > matrixLength + 1) {
    throw new ReparseRequestValidationError(
      `dataEndRow must be at most ${matrixLength + 1}.`,
    );
  }
  if (request.dataStartRow !== undefined && request.dataStartRow > matrixLength + 1) {
    throw new ReparseRequestValidationError(
      `dataStartRow must be at most ${matrixLength + 1}.`,
    );
  }
}

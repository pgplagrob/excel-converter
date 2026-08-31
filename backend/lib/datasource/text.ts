export function cellText(value: any): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

export function compactText(value: any): string {
  return cellText(value).replace(/\s+/g, "");
}

export function normalizeForScore(s: string): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, "")
    .replace(/[()/.\-_,]/g, "");
}

export function isRowEmpty(row: any[]): boolean {
  return row.every((cell) => !cellText(cell));
}

export function isSheetEffectivelyEmpty(matrix: any[][]): boolean {
  const nonEmptyRows = matrix.filter((row) => !isRowEmpty(row));
  return nonEmptyRows.length === 0;
}

export function rowText(row: any[]): string {
  return row.map(cellText).filter(Boolean).join(" ");
}

export function rowContainsAny(row: any[], tokens: string[]): boolean {
  const text = rowText(row).replace(/\s+/g, "");
  return tokens.some((token) => text.includes(token));
}

export function rowContainsAll(row: any[], tokens: string[]): boolean {
  const text = rowText(row).replace(/\s+/g, "").toLowerCase();
  return tokens.every((token) => text.includes(token.toLowerCase().replace(/\s+/g, "")));
}

export function isTotalOrSummaryRow(row: any[]): boolean {
  const cells = row.map((cell) => compactText(cell)).filter(Boolean);
  return cells.some((cell) => cell === "รวม" || cell.includes("รวมทั้งสิ้น"));
}

export function isNumericSequence(value: any): boolean {
  return /^\d+$/.test(compactText(value));
}

export function looksLikeAssetCode(value: any): boolean {
  const text = compactText(value);
  if (!text || /^(รหัส|เลข|รวม)/.test(text)) return false;
  return /\d/.test(text) && /[-/]/.test(text);
}

export function sheetLooksAssetLike(matrix: any[][]): boolean {
  const scanRows = matrix.slice(0, Math.min(matrix.length, 80));
  const hasAssetHeader = scanRows.some((row) =>
    rowContainsAny(row, ["รหัสสินทรัพย์", "รหัสครุภัณฑ์", "AssetCode"]) &&
    rowContainsAny(row, ["ชื่อ", "รายการ", "ModelName", "รายละเอียด"]),
  );
  const hasAssetRows = scanRows.some((row) => {
    const cells = row.map(cellText);
    return cells.some(looksLikeAssetCode) && cells.some((cell) => cell.length >= 3 && !looksLikeAssetCode(cell));
  });
  return hasAssetHeader || hasAssetRows;
}

export function looksLikeAssetType(text: string): boolean {
  return (
    (looksLikeAssetTypeGroup(text) || /^สินทรัพย์/.test(text)) &&
    !looksLikeAssetItemGroup(text)
  );
}

export function looksLikeAssetItemGroup(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return /\(\d{2,4}\)$/.test(text);
}

export function looksLikeAssetTypeGroup(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return /^(ครุภัณฑ์|อสังหาริมทรัพย์|อาคาร|สิ่งปลูกสร้าง)/.test(text);
}

export function findHeaderRowByTokens(matrix: any[][], requiredTokens: string[]): number {
  return matrix.findIndex((row) => rowContainsAll(row, requiredTokens));
}

export function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedCandidates = candidates.map(normalizeForScore);
  return headers.findIndex((header) => normalizedCandidates.includes(normalizeForScore(header)));
}

export function valueAt(sourceRow: any[], index: number): any {
  return index >= 0 ? sourceRow[index] : "";
}

export function countMatchingRows(
  matrix: any[][],
  predicate: (row: any[]) => boolean,
  limit = 250,
): number {
  return matrix.slice(0, Math.min(matrix.length, limit)).filter(predicate).length;
}

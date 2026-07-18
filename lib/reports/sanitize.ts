// Formula-injection guard for text written into report worksheets.
//
// ExcelJS stores plain JS strings as proper string cells (not formulas), so a
// value assigned via `cell.value = someString` is not executed as a formula
// by Excel today. Even so, downstream tools (CSV re-export, copy/paste into
// another sheet, older Excel builds) have historically treated a leading
// =, +, -, or @ as the start of a formula (the classic "CSV/DDE injection"
// class of bug). We defend in depth: any source-derived text that starts
// with one of those characters gets a literal leading apostrophe, the
// standard Excel "treat as text" escape, before it is written to a cell.

const DANGEROUS_LEADING_CHARS = new Set(["=", "+", "-", "@"]);

export function sanitizeCellText(value: string): string {
  if (!value) return value;
  const firstChar = value.charAt(0);
  if (DANGEROUS_LEADING_CHARS.has(firstChar)) {
    return `'${value}`;
  }
  return value;
}

/** Sanitizes every string value in a row object (non-string values pass through). */
export function sanitizeRowText<T extends Record<string, unknown>>(row: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = typeof value === "string" ? sanitizeCellText(value) : value;
  }
  return result as T;
}

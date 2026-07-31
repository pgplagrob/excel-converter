import JSZip from "jszip";

// ExcelJS expands each <dataValidation sqref="H2:H1048576"> into one map
// entry per cell address (see exceljs data-validations-xform.js). A
// full-column dropdown range (common in Excel templates) makes that
// expansion iterate over a million+ addresses and freezes the process.
// We rewrite the sheet XML before handing the buffer to ExcelJS so the
// range it sees stays small.

const SHEET_XML_PATTERN = /^xl\/worksheets\/sheet\d+\.xml$/i;
const DATA_VALIDATIONS_BLOCK = /<dataValidations\b[^>]*>[\s\S]*?<\/dataValidations>/g;
const SELF_CLOSING_DATA_VALIDATIONS = /<dataValidations\b[^>]*\/>/g;

function clampRangeToken(token: string, maxRow: number): string {
  const [start, end] = token.split(":");
  if (!end) return token;
  const startMatch = start.match(/^([A-Z]+)(\d+)$/i);
  const endMatch = end.match(/^([A-Z]+)(\d+)$/i);
  if (!startMatch || !endMatch) return token;
  const endRow = Math.min(Number(endMatch[2]), maxRow);
  if (endRow <= Number(startMatch[2])) return start;
  return `${startMatch[1]}${startMatch[2]}:${endMatch[1]}${endRow}`;
}

function clampSqref(xml: string, maxRow: number): string {
  return xml.replace(/sqref="([^"]+)"/g, (_match, sqref: string) =>
    `sqref="${sqref.split(/\s+/).map((token) => clampRangeToken(token, maxRow)).join(" ")}"`,
  );
}

export async function sanitizeWorkbookDataValidations(
  buffer: Buffer,
  mode: "strip" | { clampMaxRow: number },
): Promise<Buffer> {
  // Buffer's ArrayBufferLike (SharedArrayBuffer-inclusive) doesn't structurally
  // match JSZip's stricter ArrayBuffer typing; cast through unknown like the
  // ExcelJS.Buffer casts elsewhere in this codebase.
  const zip = await JSZip.loadAsync(buffer as unknown as ArrayBuffer);
  const sheetFiles = Object.keys(zip.files).filter((name) => SHEET_XML_PATTERN.test(name));

  let touched = false;
  for (const name of sheetFiles) {
    const original = await zip.file(name)!.async("string");
    if (!original.includes("dataValidation")) continue;
    const updated = mode === "strip"
      ? original.replace(DATA_VALIDATIONS_BLOCK, "").replace(SELF_CLOSING_DATA_VALIDATIONS, "")
      : clampSqref(original, mode.clampMaxRow);
    if (updated !== original) {
      zip.file(name, updated);
      touched = true;
    }
  }

  if (!touched) return buffer;
  return zip.generateAsync({ type: "nodebuffer" });
}

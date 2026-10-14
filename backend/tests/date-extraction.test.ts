import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { normalizeThaiDate, createDataSourceWorkbook } from "../src/datasource";
import { readWorkbookBuffer } from "../src/parse/excel";
import { PythonExtractorUnavailableError } from "../src/parse/python-extractor";
import { mappingSuggestionsToRecord, suggestMapping } from "../src/mapping/mapping";
import { transformRowsToTemplateDataset } from "../src/export/transform";
import { validateMappedRows } from "../src/export/validate";
import { buildAssetTemplateWorkbookBySheet } from "../src/template/template";

test("normalizes extractor ISO timestamps without shifting the calendar date", () => {
  for (const timestamp of [
    "2024-01-15T00:00:00",
    "2024-01-15T00:00:00.000Z",
    "2024-01-15T00:00:00+07:00",
    "2024-01-15T23:00:00-07:00",
  ]) {
    assert.equal(normalizeThaiDate(timestamp), "15/01/2024", timestamp);
  }
});

test("normalizes Excel Date objects in UTC rather than the server timezone", () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ["Asia/Bangkok", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      assert.equal(normalizeThaiDate(new Date("2024-01-15T00:00:00Z")), "15/01/2024");
      assert.equal(normalizeThaiDate(new Date("2024-12-31T23:00:00Z")), "31/12/2024");
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

for (const mode of ["python", "typescript"] as const) {
  test(`${mode} reader preserves real Excel dates through parsing, validation and export`, async (t) => {
    const workbook = new ExcelJS.Workbook();
    const input = workbook.addWorksheet("AssetData");
    input.addRow(["AssetCode", "ModelName", "PurchaseDate", "PurchasePrice"]);
    const dates = ["2024-01-15T00:00:00Z", "2024-02-29T00:00:00Z", "2024-12-31T23:00:00Z"];
    const expected = ["15/01/2024", "29/02/2024", "31/12/2024"];
    dates.forEach((date, index) => {
      input.addRow([`A-${index + 1}`, "Computer", new Date(date), 1000]);
      input.getCell(index + 2, 3).numFmt = "dd/mm/yyyy";
    });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const previousMode = process.env.WORKBOOK_EXTRACTOR;
    try {
      process.env.WORKBOOK_EXTRACTOR = mode;
      const raw = await readWorkbookBuffer(buffer, "dates.xlsx");
      const sheet = createDataSourceWorkbook(raw.fileName, raw.sheets).sheets[0];
      assert.equal(sheet.sourceProfile, "ASSET_DATA");
      const mapping = mappingSuggestionsToRecord(suggestMapping(sheet.headers));
      const rows = transformRowsToTemplateDataset(sheet.rows, mapping);
      assert.deepEqual(rows.map((row) => row["วันที่ได้รับ"]), expected);
      assert.deepEqual(
        validateMappedRows(sheet.sheetName, rows, sheet.rows)
          .filter((issue) => issue.column === "วันที่ได้รับ"),
        [],
      );
      const output = await buildAssetTemplateWorkbookBySheet([{ sheetName: sheet.sheetName, rows }]);
      const reloaded = new ExcelJS.Workbook();
      await reloaded.xlsx.load(await output.xlsx.writeBuffer());
      const exported = reloaded.getWorksheet(sheet.sheetName)!;
      const column = (exported.getRow(1).values as unknown[]).indexOf("วันที่ได้รับ");
      assert.ok(column > 0);
      assert.deepEqual(expected.map((_, index) => exported.getCell(index + 2, column).value), expected);
    } catch (error) {
      if (mode === "python" && error instanceof PythonExtractorUnavailableError) {
        t.skip("Python/openpyxl is optional and unavailable in this environment.");
        return;
      }
      throw error;
    } finally {
      if (previousMode === undefined) delete process.env.WORKBOOK_EXTRACTOR;
      else process.env.WORKBOOK_EXTRACTOR = previousMode;
    }
  });
}

import * as fs from "fs";
import * as path from "path";
import { readWorkbookBuffer } from "../lib/excel";
import { createDataSourceWorkbook } from "../lib/datasource";
import { suggestMapping } from "../lib/mapping";
import { transformRowsToTemplateDataset } from "../lib/transform";
import { validateMappedRows } from "../lib/validate";

const DEFAULT_FIXTURES = [
  "C:/Users/kxxka/OneDrive/Desktop/work/เทศบาลนครลำปาง/3 งบทรัพย์สินกองการเจ้าหน้าที่ ปี 67 อัพเดท 13 .xlsx",
  "C:/Users/kxxka/OneDrive/Desktop/work/เทศบาลนครลำปาง/ครุภัณฑ์สำนักปลัดเทศบาล67 แบบ กข แก้ไข15-11-67.xlsx",
];

function text(value: any): string {
  return value === undefined || value === null ? "" : value.toString().trim();
}

function compact(value: any): string {
  return text(value).replace(/\s+/g, "");
}

function looksLikeLongDetailText(value: any): boolean {
  const raw = text(value);
  const valueText = compact(value);
  if (!valueText) return false;
  if (/\(\d+\)/.test(valueText) && valueText.length <= 80) return false;
  return (
    valueText.length > 45 ||
    /ยี่ห้อ|รุ่น|ขนาด|หมายเลข|ทะเบียน|เครื่องยนต์|ตามอาคาร|หน้าห้อง/.test(raw)
  );
}

function hasHeaderOrSummaryLeak(row: Record<string, any>): boolean {
  return Object.values(row).some((value) => {
    const valueText = compact(value);
    return (
      valueText === "ที่" ||
      valueText === "รายการ" ||
      valueText === "รหัสครุภัณฑ์" ||
      valueText === "รหัสสินทรัพย์" ||
      valueText === "รวม" ||
      valueText.includes("รวมทั้งสิ้น")
    );
  });
}

function hasPlaceholder44Or45(row: Record<string, any>): boolean {
  return Object.values(row).some((value) => {
    const valueText = compact(value);
    return valueText === "44" || valueText === "45";
  });
}

function mappingForHeaders(headers: string[]): Record<string, string> {
  return Object.fromEntries(
    suggestMapping(headers).map((item) => [item.templateColumn, item.sourceColumn || ""]),
  );
}

function printSheet(sheet: any): {
  rows: number;
  emptyNames: number;
  placeholderNames: number;
  detailWithoutName: number;
  itemEqualsName: number;
  itemLooksLong: number;
  emptyTypes: number;
  emptyItemsWithGroup: number;
  headerLeaks: number;
  placeholderCells: number;
  validationErrors: number;
  validationWarnings: number;
} {
  const exportedRows = transformRowsToTemplateDataset(sheet.rows, mappingForHeaders(sheet.headers));
  const issues = validateMappedRows(sheet.sheetName, exportedRows);

  const counters = {
    rows: exportedRows.length,
    emptyNames: 0,
    placeholderNames: 0,
    detailWithoutName: 0,
    itemEqualsName: 0,
    itemLooksLong: 0,
    emptyTypes: 0,
    emptyItemsWithGroup: 0,
    headerLeaks: 0,
    placeholderCells: 0,
    validationErrors: issues.filter((issue) => issue.severity === "error").length,
    validationWarnings: issues.filter((issue) => issue.severity === "warning").length,
  };

  for (let index = 0; index < exportedRows.length; index += 1) {
    const exportedRow = exportedRows[index];
    const sourceRow = sheet.rows[index] || {};
    const assetName = compact(exportedRow["ชื่อสินทรัพย์"]);
    const assetDetail = compact(exportedRow["รายละเอียด"]);
    const assetType = compact(exportedRow["ชนิดสินทรัพย์"]);
    const assetItem = compact(exportedRow["รายการสินทรัพย์"]);

    if (!assetName) counters.emptyNames += 1;
    if (assetName === "44" || assetName === "45") counters.placeholderNames += 1;
    if (assetDetail && !assetName) counters.detailWithoutName += 1;
    if (assetItem && assetName && assetItem === assetName) counters.itemEqualsName += 1;
    if (assetItem && looksLikeLongDetailText(exportedRow["รายการสินทรัพย์"])) counters.itemLooksLong += 1;
    if (!assetType) counters.emptyTypes += 1;
    if (compact(sourceRow.sourceAssetItem) && !assetItem) counters.emptyItemsWithGroup += 1;
    if (hasHeaderOrSummaryLeak(exportedRow)) counters.headerLeaks += 1;
    if (hasPlaceholder44Or45(exportedRow)) counters.placeholderCells += 1;
  }

  console.log(`\nSheet: ${sheet.sheetName}`);
  console.log(`  detected profile: ${sheet.sourceProfile}`);
  console.log(`  parsed rows: ${sheet.rowCount}`);
  console.log("  first 5 normalized rows:");
  console.table(
    sheet.rows.slice(0, 5).map((row: Record<string, any>) => ({
      assetCode: row.assetCode,
      assetName: row.assetName,
      assetDetail: row.assetDetail,
      sourceAssetType: row.sourceAssetType,
      sourceAssetItem: row.sourceAssetItem,
    })),
  );
  console.log(`  exported rows: ${counters.rows}`);
  console.log(`  empty ชื่อสินทรัพย์: ${counters.emptyNames}`);
  console.log(`  ชื่อสินทรัพย์ is 44/45: ${counters.placeholderNames}`);
  console.log(`  any exported cell is 44/45: ${counters.placeholderCells}`);
  console.log(`  รายละเอียด has value while ชื่อสินทรัพย์ empty: ${counters.detailWithoutName}`);
  console.log(`  รายการสินทรัพย์ equals ชื่อสินทรัพย์: ${counters.itemEqualsName}`);
  console.log(`  รายการสินทรัพย์ looks like long detail: ${counters.itemLooksLong}`);
  console.log(`  empty ชนิดสินทรัพย์: ${counters.emptyTypes}`);
  console.log(`  empty รายการสินทรัพย์ while group available: ${counters.emptyItemsWithGroup}`);
  console.log(`  header/summary leaks: ${counters.headerLeaks}`);
  console.log(`  validation errors: ${counters.validationErrors}`);
  console.log(`  validation warnings: ${counters.validationWarnings}`);

  return counters;
}

function main(): void {
  const files = process.argv.slice(2);
  const fixturePaths = files.length ? files : DEFAULT_FIXTURES;

  for (const fixturePath of fixturePaths) {
    if (!fs.existsSync(fixturePath)) {
      console.warn(`Skipping missing fixture: ${fixturePath}`);
      continue;
    }

    const rawWorkbook = readWorkbookBuffer(fs.readFileSync(fixturePath), path.basename(fixturePath));
    const datasource = createDataSourceWorkbook(rawWorkbook.fileName, rawWorkbook.sheets);
    const totals = {
      rows: 0,
      emptyNames: 0,
      placeholderNames: 0,
      detailWithoutName: 0,
      itemEqualsName: 0,
      itemLooksLong: 0,
      emptyTypes: 0,
      emptyItemsWithGroup: 0,
      headerLeaks: 0,
      placeholderCells: 0,
      validationErrors: 0,
      validationWarnings: 0,
    };

    console.log(`\n=== ${fixturePath} ===`);
    console.log(`Skipped sheets: ${datasource.skippedSheets.join(", ") || "(none)"}`);

    for (const sheet of datasource.sheets) {
      const sheetCounters = printSheet(sheet);
      for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
        totals[key] += sheetCounters[key];
      }
    }

    console.log("\nWorkbook totals:");
    console.log(totals);
  }
}

main();

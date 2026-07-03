import * as fs from "fs";
import * as path from "path";
import { readWorkbookBuffer } from "../lib/excel";
import { createDataSourceWorkbook } from "../lib/datasource";
import { TEMPLATE_COLUMNS, suggestMapping } from "../lib/mapping";
import { transformRowsToTemplateDataset } from "../lib/transform";
import { validateMappedRows } from "../lib/validate";

const DEFAULT_FIXTURES = [
  "C:/Users/kxxka/OneDrive/Desktop/work/เทศบาลนครลำปาง/3 งบทรัพย์สินกองการเจ้าหน้าที่ ปี 67 อัพเดท 13 .xlsx",
  "C:/Users/kxxka/OneDrive/Desktop/work/เทศบาลนครลำปาง/ครุภัณฑ์สำนักปลัดเทศบาล67 แบบ กข แก้ไข15-11-67.xlsx",
];

const COL_ASSET_CODE = "รหัสสินทรัพย์";
const COL_ASSET_TYPE = "ชนิดสินทรัพย์";
const COL_ASSET_ITEM = "รายการสินทรัพย์";
const COL_ASSET_NAME = "ชื่อสินทรัพย์";
const COL_ASSET_DETAIL = "รายละเอียด";
const COL_VALUE = "มูลค่า";
const COL_UNIT = "หน่วยนับ";

const GROUP_CATEGORY = "ครุภัณฑ์สำนักงาน";
const GROUP_ITEM = "โต๊ะ (400)";
const ASSET_NAME = "โต๊ะทำงาน";
const DUPLICATE_ASSET_NAME = "เก้าอี้ทำงาน";
const DUPLICATE_ASSET_CODE = "400-32-1871";

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

function assertNoTemplateSampleValueLeak(): void {
  const unmappedMapping = Object.fromEntries(TEMPLATE_COLUMNS.map((column) => [column, ""]));
  const [row] = transformRowsToTemplateDataset(
    [
      {
        assetCode: "sample-asset-1",
        assetName: "เครื่องทดสอบ",
        assetDetail: "เครื่องทดสอบ",
        value: "100",
      },
    ],
    unmappedMapping,
  );

  if (!row) throw new Error("Expected one exported row for template sample value regression");
  if (text(row[COL_UNIT])) {
    throw new Error(`Expected unmapped ${COL_UNIT} to stay blank, got ${row[COL_UNIT]}`);
  }

  const leakedColumns = Object.entries(row)
    .filter(([, value]) => text(value) === "44")
    .map(([column]) => column);
  if (leakedColumns.length) {
    throw new Error(`Unmapped template sample value 44 leaked into: ${leakedColumns.join(", ")}`);
  }
}

function assertRequestedConverterRegressions(): void {
  assertNoTemplateSampleValueLeak();

  const rawWorkbook = {
    fileName: "requested-regressions.xlsx",
    sheets: [
      {
        sheetName: "ทะเบียนครุภัณฑ์",
        matrix: [
          ["ที่", "รายการ", "รหัสครุภัณฑ์", "วันที่ได้รับ", "มูลค่า", "ผู้รับผิดชอบ", "สภาพครุภัณฑ์"],
          [],
          [],
          ["", GROUP_CATEGORY, ""],
          ["", GROUP_ITEM, ""],
          ["1", ASSET_NAME, DUPLICATE_ASSET_CODE, "", "100", "", "x"],
          ["2", DUPLICATE_ASSET_NAME, DUPLICATE_ASSET_CODE, "", "200", "", "x"],
        ],
      },
    ],
  };
  const datasource = createDataSourceWorkbook(rawWorkbook.fileName, rawWorkbook.sheets);
  const sheet = datasource.sheets[0];
  if (!sheet) throw new Error("Requested regression sheet was not parsed");

  const exportedRows = transformRowsToTemplateDataset(sheet.rows, mappingForHeaders(sheet.headers));
  if (exportedRows.length !== 2) {
    throw new Error(`Expected duplicate asset code rows to both export, got ${exportedRows.length}`);
  }

  const [firstRow, secondRow] = exportedRows;
  const expectedFirstRow = {
    [COL_ASSET_TYPE]: GROUP_CATEGORY,
    [COL_ASSET_ITEM]: GROUP_ITEM,
    [COL_ASSET_NAME]: ASSET_NAME,
    [COL_ASSET_CODE]: DUPLICATE_ASSET_CODE,
    [COL_VALUE]: "100",
  };
  for (const [column, expectedValue] of Object.entries(expectedFirstRow)) {
    if (text(firstRow[column]) !== expectedValue) {
      throw new Error(`Expected ${column} to be ${expectedValue}, got ${firstRow[column] || "(blank)"}`);
    }
  }

  if (text(firstRow[COL_ASSET_DETAIL]) === GROUP_ITEM) {
    throw new Error(`${COL_ASSET_DETAIL} must not use the asset group label`);
  }
  if (text(secondRow[COL_ASSET_CODE]) !== DUPLICATE_ASSET_CODE) {
    throw new Error("Expected the second duplicate asset-code row to keep the same asset code");
  }
  if (text(secondRow[COL_ASSET_NAME]) !== DUPLICATE_ASSET_NAME || text(secondRow[COL_VALUE]) !== "200") {
    throw new Error("Rows with the same asset code but different names/prices must export separately");
  }

  const duplicateIssues = validateMappedRows(sheet.sheetName, exportedRows, sheet.rows).filter((issue) =>
    issue.message.includes("Exact duplicate exported row"),
  );
  if (duplicateIssues.length) {
    throw new Error("Different rows sharing an asset code must not be treated as exact duplicates");
  }
}

function assertThaiAssetGroupRegression(): void {
  const rawWorkbook = {
    fileName: "thai-asset-group-regression.xlsx",
    sheets: [
      {
        sheetName: "ทะเบียนครุภัณฑ์",
        matrix: [
          ["ที่", "รายการ", "รหัสครุภัณฑ์", "วันที่ได้รับ", "มูลค่า", "ผู้รับผิดชอบ", "สภาพครุภัณฑ์"],
          [],
          [],
          ["", "ครุภัณฑ์สำนักงาน", ""],
          ["", "โต๊ะ (400)", ""],
          ["1", "โต๊ะทำงาน", "400-32-1871", "", "100", "", "✓"],
          ["2", "เก้าอี้ทำงาน", "400-32-1871", "", "200", "", "✓"],
        ],
      },
    ],
  };
  const datasource = createDataSourceWorkbook(rawWorkbook.fileName, rawWorkbook.sheets);
  const sheet = datasource.sheets[0];
  if (!sheet) throw new Error("Regression sheet was not parsed");

  const exportedRows = transformRowsToTemplateDataset(sheet.rows, mappingForHeaders(sheet.headers));
  if (exportedRows.length !== 2) {
    throw new Error("Expected two exported real asset rows, got " + exportedRows.length);
  }
  if (sheet.rows[0].__rowKey === sheet.rows[1].__rowKey) {
    throw new Error("Duplicate asset-code rows must have different composite row keys");
  }

  const row = exportedRows[0];
  const expected = {
    "ชนิดสินทรัพย์": "ครุภัณฑ์สำนักงาน",
    "รายการสินทรัพย์": "โต๊ะ (400)",
    "ชื่อสินทรัพย์": "โต๊ะทำงาน",
    "รายละเอียด": "โต๊ะทำงาน",
    "รหัสสินทรัพย์": "400-32-1871",
  };

  for (const [column, value] of Object.entries(expected)) {
    if (row[column] !== value) {
      throw new Error("Expected " + column + " to be " + value + ", got " + (row[column] || "(blank)"));
    }
  }

  if (row["รายละเอียด"] === row["รายการสินทรัพย์"]) {
    throw new Error("รายละเอียด must not use the asset group label");
  }

  const secondRow = exportedRows[1];
  if (secondRow["รหัสสินทรัพย์"] !== row["รหัสสินทรัพย์"] || secondRow["ชื่อสินทรัพย์"] === row["ชื่อสินทรัพย์"]) {
    throw new Error("Rows with the same asset code but different details must export separately");
  }

  const duplicateIssues = validateMappedRows(sheet.sheetName, exportedRows, sheet.rows).filter((issue) =>
    issue.message.includes("Exact duplicate exported row"),
  );
  if (duplicateIssues.length) {
    throw new Error("Different rows sharing an asset code must not be treated as exact duplicates");
  }
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
  const issues = validateMappedRows(sheet.sheetName, exportedRows, sheet.rows);

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
  assertRequestedConverterRegressions();
  assertThaiAssetGroupRegression();

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

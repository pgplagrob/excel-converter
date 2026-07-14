import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { readWorkbookBuffer, safeCellText, WorkbookLimitError } from "../lib/excel";
import { createDataSourceWorkbook } from "../lib/datasource";
import { mappingSuggestionsToRecord, suggestMapping } from "../lib/mapping";
import { buildAssetTemplateWorkbook, buildAssetTemplateWorkbookBySheet, loadAssetTemplateMetadata } from "../lib/template";
import { transformRowsToTemplateDataset } from "../lib/transform";
import { validateMappedRows, validateSheetLevel } from "../lib/validate";

function worksheetRows(worksheet: ExcelJS.Worksheet): unknown[][] {
  return Array.from({ length: worksheet.actualRowCount }, (_, rowIndex) => {
    const row = worksheet.getRow(rowIndex + 1);
    return Array.from({ length: worksheet.columnCount }, (_, columnIndex) => row.getCell(columnIndex + 1).value ?? "");
  });
}

async function readWorkbook(workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const output = new ExcelJS.Workbook();
  await output.xlsx.load(await workbook.xlsx.writeBuffer());
  return output;
}

test("reads xlsx input and retains cell fill metadata", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AssetData");
  const header = sheet.getCell("A1");
  header.value = "AssetCode";
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0000" } };
  sheet.getCell("B1").value = "ModelName";
  sheet.getCell("A2").value = "A-001";

  const raw = await readWorkbookBuffer(Buffer.from(await workbook.xlsx.writeBuffer()), "asset-data.xlsx");

  assert.equal(raw.sheets[0].matrix[0][0], "AssetCode");
  assert.equal(raw.sheets[0].matrix[1][0], "A-001");
  assert.equal(raw.sheets[0].rowMeta[0].fillColors[0], "FFFF0000");
});

test("treats a broken empty merged cell as blank", () => {
  const brokenCell = {
    get text(): string {
      throw new TypeError("merge master is null");
    },
    value: null,
  };

  assert.equal(safeCellText(brokenCell), "");
});

test("uses structured cell values when ExcelJS exposes object text", () => {
  assert.equal(
    safeCellText({ text: "[object Object]", value: { result: "A-001" } as ExcelJS.CellFormulaValue }),
    "A-001",
  );
});

test("rejects worksheets with implausibly large dimensions", async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Sparse").getCell(50_001, 1).value = "too far";
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  await assert.rejects(() => readWorkbookBuffer(buffer, "sparse.xlsx"), WorkbookLimitError);
});

test("classifies assetData as exportable input and skips help/unknown non-asset sheets", () => {
  const workbook = createDataSourceWorkbook("asset-data.xlsx", [
    {
      sheetName: "AssetData",
      matrix: [
        ["AssetCode", "ModelName", "AssetTypeName", "PurchaseDate", "PurchasePrice", "Price", "LocationName"],
        ["A-001", "เครื่องคอมพิวเตอร์", "ครุภัณฑ์คอมพิวเตอร์", "2024-01-05", "", 25000, "อาคาร 1"],
      ],
    },
    {
      sheetName: "Help",
      matrix: [
        ["Help"],
        ["คำอธิบายการใช้งานไฟล์"],
      ],
    },
    {
      sheetName: "Random",
      matrix: [
        ["หัวข้อ", "หมายเหตุ"],
        ["สรุป", "ไม่มีข้อมูลสินทรัพย์"],
      ],
    },
  ]);

  assert.equal(workbook.sheets.length, 1);
  assert.equal(workbook.sheets[0].sourceProfile, "ASSET_DATA");
  assert.equal(workbook.sheets[0].rows[0].assetCode, "A-001");
  assert.deepEqual(workbook.skippedSheets.sort(), ["Help", "Random"]);
});

test("assetData mapping uses normalized fields and PurchasePrice fallback rule", () => {
  const workbook = createDataSourceWorkbook("asset-data.xlsx", [
    {
      sheetName: "AssetData",
      matrix: [
        ["AssetCode", "ModelName", "AssetTypeName", "PurchaseDate", "PurchasePrice", "Price", "LocationName"],
        ["A-001", "เครื่องคอมพิวเตอร์", "ครุภัณฑ์คอมพิวเตอร์", "2024-01-05", "", 25000, "อาคาร 1"],
      ],
    },
  ]);
  const sheet = workbook.sheets[0];
  const mapping = mappingSuggestionsToRecord(suggestMapping(sheet.headers));
  const rows = transformRowsToTemplateDataset(sheet.rows, mapping);

  assert.equal(rows[0]["รหัสสินทรัพย์"], "A-001");
  assert.equal(rows[0]["ชื่อสินทรัพย์"], "เครื่องคอมพิวเตอร์");
  assert.equal(rows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์คอมพิวเตอร์");
  assert.equal(rows[0]["มูลค่า"], 25000);
  assert.equal(rows[0]["อาคาร"], "อาคาร 1");
});

test("new asset sheets derive asset names from item groups", () => {
  const workbook = createDataSourceWorkbook("new-assets.xlsx", [
    {
      sheetName: "ครุภัณฑ์ใหม่2567",
      matrix: [
        ["ลำดับ", "รหัสสินทรัพย์", "ชนิดสินทรัพย์", "รายละเอียดสินทรัพย์", "วันที่ได้มา", "", "", "ราคาสินทรัพย์"],
        ["", "", "ครุภัณฑ์สำนักงาน"],
        ["", "", "เครื่องปรับอากาศ (420)"],
        [1, "420-67-0001", "ครุภัณฑ์สำนักงาน", "เครื่องปรับอากาศ 24,000 BTU", 1, 5, 2567, 25000],
      ],
    },
  ]);
  const rows = transformRowsToTemplateDataset(workbook.sheets[0].rows, {});

  assert.equal(rows[0]["รหัสสินทรัพย์"], "420-67-0001");
  assert.equal(rows[0]["ชื่อสินทรัพย์"], "เครื่องปรับอากาศ");
  assert.equal(rows[0]["รายละเอียด"], "เครื่องปรับอากาศ 24,000 BTU");
});

test("parses supported headerless positional asset layouts", () => {
  const workbook = createDataSourceWorkbook("headerless.xlsx", [
    {
      sheetName: "DepartmentRows",
      matrix: [
        ["กองคลัง", "ครุภัณฑ์สำนักงาน", "โต๊ะทำงาน", "400-67-0001", 1, 5, 2567, 1200, "งานพัสดุ", "ผู้ถือครอง 1", "", "ปกติ"],
        ["กองคลัง", "ครุภัณฑ์สำนักงาน", "เก้าอี้ทำงาน", "401-67-0002", 2, 5, 2567, 900, "งานพัสดุ", "ผู้ถือครอง 2", "", "ปกติ"],
      ],
    },
    {
      sheetName: "ครุภัณฑ์สำนักงาน รวมทุกงาน",
      matrix: [
        ["ปั๊มน้ำ", "055", "66", "0281", "7 ก.ย. 66", 6420, "งานสวนสาธารณะ", "", "ปกติ"],
        ["ปั๊มน้ำ", "055", "66", "0282", "7 ก.ย. 66", 6420, "งานสวนสาธารณะ", "", "ปกติ"],
      ],
    },
    {
      sheetName: "Consolidated",
      matrix: [
        ["กองการเจ้าหน้าที่", "ครุภัณฑ์สำนักงาน", "MONO", "A1", "เก้าอี้ทำงาน", "เก้าอี้ทำงาน MONO", "401-65-9822", "24/12/2021", 2900, "กองการเจ้าหน้าที่", "", "", "ปกติ"],
        ["กองการเจ้าหน้าที่", "ครุภัณฑ์สำนักงาน", "MONO", "A2", "โต๊ะทำงาน", "โต๊ะทำงาน MONO", "400-65-9823", "24/12/2021", 3900, "กองการเจ้าหน้าที่", "", "", "ปกติ"],
      ],
    },
  ]);

  assert.equal(workbook.sheets.length, 3);
  for (const sheet of workbook.sheets) {
    assert.equal(sheet.sourceProfile, "FLEXIBLE_ASSET_TABLE");
    assert.equal(sheet.eligibility, "exportable");
  }

  const departmentRows = transformRowsToTemplateDataset(workbook.sheets[0].rows, {});
  const splitCodeRows = transformRowsToTemplateDataset(workbook.sheets[1].rows, {});
  const consolidatedRows = transformRowsToTemplateDataset(workbook.sheets[2].rows, {});
  assert.equal(departmentRows[0]["รหัสสินทรัพย์"], "400-67-0001");
  assert.equal(departmentRows[0]["ชื่อสินทรัพย์"], "โต๊ะทำงาน");
  assert.equal(splitCodeRows[0]["รหัสสินทรัพย์"], "055-66-0281");
  assert.equal(splitCodeRows[0]["วันที่ได้รับ"], "07/09/2023");
  assert.equal(consolidatedRows[0]["รหัสสินทรัพย์"], "401-65-9822");
  assert.equal(consolidatedRows[0]["ชื่อสินทรัพย์"], "เก้าอี้ทำงาน");
});

test("parses two-row standard asset tables and maps funding columns", () => {
  const workbook = createDataSourceWorkbook("standard.xlsx", [
    {
      sheetName: "Sheet3",
      matrix: [
        ["ลำดับ", "ประเภทสินทรัพย์", "ชนิดสินทรัพย์", "รหัสสินทรัพย์ Elaas", "รหัสสินทรัพย์", "ชื่อสินทรัพย์", "รายละเอียดสินทรัพย์", "วันที่ได้มา", "ราคาสินทรัพย์", "สถานะ", "", "งานที่รับผิดชอบ"],
        ["", "", "", "", "", "", "", "", "", "", "เงินงบประมาณ", ""],
        [1, "ครุภัณฑ์", "ครุภัณฑ์สำนักงาน", "ELAAS-1", "400-67-0001", "โต๊ะทำงาน", "โต๊ะเหล็ก", "1/5/2567", 1200, "ใช้งาน", 1200, "งานพัสดุ"],
      ],
    },
  ]);
  const sheet = workbook.sheets[0];
  const mapping = mappingSuggestionsToRecord(suggestMapping(sheet.headers));
  const rows = transformRowsToTemplateDataset(sheet.rows, mapping);

  assert.equal(sheet.sourceProfile, "FLEXIBLE_ASSET_TABLE");
  assert.equal(rows[0]["รหัสสินทรัพย์"], "400-67-0001");
  assert.equal(rows[0]["ชื่อสินทรัพย์"], "โต๊ะทำงาน");
  assert.equal(rows[0]["สถานะ"], "ปกติ");
  assert.equal(rows[0]["เงินงบประมาณ"], 1200);
});

test("reads legacy xls workbooks", async () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["AssetCode", "ModelName", "AssetTypeName", "PurchaseDate", "PurchasePrice"],
    ["A-001", "เครื่องคอมพิวเตอร์", "ครุภัณฑ์คอมพิวเตอร์", "1/5/2567", 25000],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "AssetData");
  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "biff8" }));

  const raw = await readWorkbookBuffer(buffer, "legacy.xls");
  assert.equal(raw.sheets[0].matrix[0][0], "AssetCode");
  assert.equal(raw.sheets[0].matrix[1][0], "A-001");
});

test("registry group and item labels emit once and do not become asset names", () => {
  const workbook = createDataSourceWorkbook("registry.xlsx", [
    {
      sheetName: "ทะเบียน",
      matrix: [
        ["ลำดับ", "รายการ", "รหัสครุภัณฑ์", "วันเดือนปี", "ราคาที่ได้มา", "หน่วยงาน", "สภาพครุภัณฑ์"],
        ["", "", "", "", "", "", "ปกติ", "ชำรุด"],
        ["", "", "", "", "", "", ""],
        ["", "ครุภัณฑ์สำนักงาน", "", "", "", "", ""],
        ["", "โต๊ะ(400)", "", "", "", "", ""],
        [1, "โต๊ะทำงาน", "400-001", "1/1/2567", 1000, "สำนักปลัด", "x"],
        [2, "โต๊ะประชุม", "400-002", "2/1/2567", 2000, "สำนักปลัด", "x"],
        [3, "รายการที่ยังไม่มีรหัส", "", "3/1/2567", 3000, "สำนักปลัด", "x"],
      ],
    },
  ]);
  const sheet = workbook.sheets[0];
  const rows = transformRowsToTemplateDataset(sheet.rows, {});

  assert.equal(rows[0]["ชื่อสินทรัพย์"], "โต๊ะทำงาน");
  assert.equal(rows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์สำนักงาน");
  assert.equal(rows[0]["รายการสินทรัพย์"], "โต๊ะ(400)");
  assert.equal(rows[1]["ชื่อสินทรัพย์"], "โต๊ะประชุม");
  assert.equal(rows[1]["ชนิดสินทรัพย์"], "");
  assert.equal(rows[1]["รายการสินทรัพย์"], "");
  assert.equal(rows.length, 2);
  assert.equal(sheet.warnings.some((warning) => warning.includes("ไม่มีรหัสสินทรัพย์")), true);
});

test("registry parser composes asset codes split across columns", () => {
  const workbook = createDataSourceWorkbook("split-register.xlsx", [
    {
      sheetName: "ทะเบียน",
      matrix: [
        ["ลำดับ", "รายการ", "รหัสครุภัณฑ์", "", "", "วันเดือนปี", "ราคาที่ได้มา", "สถานที่ใช้งาน", "สภาพครุภัณฑ์"],
        ["", "", "", "", "", "ที่ได้มา", "", "", "ใช้ได้", "ชำรุด"],
        ["", "", "", "", "", "", "", "", ""],
        [1, "รถยนต์กระบะ", "3", "002", "37", "0032", "21-Nov-37", 407000, "งานอนามัย", "P"],
        [2, "โต๊ะทำงาน", "400", "43", "3921", "Sat Aug 07 1943 07:00:00 GMT+0700", 5460, "งานสวนสาธารณะ", "P"],
      ],
    },
  ]);
  const rows = transformRowsToTemplateDataset(workbook.sheets[0].rows, {});

  assert.equal(rows[0]["รหัสสินทรัพย์"], "3-002-37-0032");
  assert.equal(rows[0]["วันที่ได้รับ"], "21/11/1994");
  assert.equal(rows[0]["มูลค่า"], 407000);
  assert.equal(rows[1]["รหัสสินทรัพย์"], "400-43-3921");
  assert.equal(rows[1]["วันที่ได้รับ"], "07/08/2000");
});

test("template output keeps Sheet1 at 44 columns and preserves Reference sheet", async () => {
  const metadata = await loadAssetTemplateMetadata();
  const wb = await buildAssetTemplateWorkbook([
    {
      "รหัสสินทรัพย์": "A-001",
      "ชื่อสินทรัพย์": "เครื่องคอมพิวเตอร์",
      "ประเภทสินทรัพย์": "ครุภัณฑ์",
      "มูลค่า": 25000,
      "สถานะ": "ปกติ",
    },
  ]);
  const readBack = await readWorkbook(wb);
  const sheetRows = worksheetRows(readBack.getWorksheet("Sheet1")!);

  assert.equal(metadata.columns.length, 44);
  assert.equal(sheetRows[0].length, 44);
  assert.equal(readBack.getWorksheet("Reference") !== undefined, true);
  assert.equal(sheetRows.slice(1).filter((row) => row.some((value) => value !== "")).length, 1);
  assert.equal(sheetRows[1][2], "A-001");
});

test("split template output creates one worksheet per exportable source sheet", async () => {
  const wb = await buildAssetTemplateWorkbookBySheet([
    {
      sheetName: "ครุภัณฑ์ใหม่2567",
      rows: [
        {
          "รหัสสินทรัพย์": "A-001",
          "ชื่อสินทรัพย์": "เครื่องคอมพิวเตอร์",
        },
      ],
    },
    {
      sheetName: "สำนักงาน",
      rows: [
        {
          "รหัสสินทรัพย์": "B-001",
          "ชื่อสินทรัพย์": "โต๊ะทำงาน",
        },
      ],
    },
  ]);
  const readBack = await readWorkbook(wb);
  const firstRows = worksheetRows(readBack.getWorksheet("ครุภัณฑ์ใหม่2567")!);
  const secondRows = worksheetRows(readBack.getWorksheet("สำนักงาน")!);

  assert.deepEqual(readBack.worksheets.map((sheet) => sheet.name), ["ครุภัณฑ์ใหม่2567", "สำนักงาน", "Reference"]);
  assert.equal(firstRows[0].length, 44);
  assert.equal(secondRows[0].length, 44);
  assert.equal(firstRows[1][2], "A-001");
  assert.equal(secondRows[1][2], "B-001");
});

test("validation blocks rows with missing required asset identity", async () => {
  const metadata = await loadAssetTemplateMetadata();
  const rows = [
    {
      "รหัสสินทรัพย์": "",
      "ชื่อสินทรัพย์": "รวมทั้งสิ้น",
      "สถานะ": "ไม่อยู่ในระบบ",
    },
  ];
  const sheetIssues = validateSheetLevel("Bad", rows.length, 1, {}, []);
  const rowIssues = validateMappedRows("Bad", rows, [], metadata.references);

  assert.equal(sheetIssues.some((issue) => issue.column === "รหัสสินทรัพย์"), true);
  assert.equal(rowIssues.some((issue) => issue.severity === "error"), true);
  assert.equal(rowIssues.some((issue) => issue.column === "สถานะ"), true);
});

import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { readWorkbookBuffer, safeCellText, WorkbookLimitError } from "../lib/excel";
import { createDataSourceWorkbook } from "../lib/datasource";
import { decideProfileEligibility } from "../lib/datasource/eligibility";
import { detectSourceProfile } from "../lib/datasource/profile";
import { COLUMN_ALIASES, mappingSuggestionsToRecord, mergeMapping, suggestMapping } from "../lib/mapping";
import { buildAssetTemplateWorkbook, buildAssetTemplateWorkbookBySheet, loadAssetTemplateMetadata } from "../lib/template";
import { transformRowsToTemplateDataset } from "../lib/transform";
import { shouldValidateSheet, validateMappedRows, validateSheetLevel } from "../lib/validate";
import { createDefaultSheetSelection, selectedSheetCount } from "../lib/sheet-selection";

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

test("keeps unknown sheets for review but skips non-asset help sheets", () => {
  const workbook = createDataSourceWorkbook("asset-data.xlsx", [
    {
      sheetName: "AssetData",
      matrix: [
        ["AssetCode", "ModelName", "AssetTypeName", "PurchaseDate", "PurchasePrice", "Price", "LocationName", "Status"],
        ["A-001", "เครื่องคอมพิวเตอร์", "ครุภัณฑ์คอมพิวเตอร์", "2024-01-05", "", 25000, "อาคาร 1", "เสื่อมสภาพ"],
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

  assert.equal(workbook.sheets.length, 2);
  const assetData = workbook.sheets.find((sheet) => sheet.sheetName === "AssetData");
  const random = workbook.sheets.find((sheet) => sheet.sheetName === "Random");
  assert.equal(assetData?.sourceProfile, "ASSET_DATA");
  assert.equal(assetData?.rows[0].assetCode, "A-001");
  assert.equal(random?.sourceProfile, "UNKNOWN");
  assert.equal(random?.eligibility, "unsupported");
  assert.equal(random?.rows.length, 1);
  assert.deepEqual(workbook.preservedSheets, []);
  assert.deepEqual(workbook.skippedSheets, ["Help"]);
});

test("does not preserve empty or non-tabular one-row sheets in template output", () => {
  const workbook = createDataSourceWorkbook("mixed.xlsx", [
    { sheetName: "Blank", matrix: [["", null], [undefined, ""]] },
    { sheetName: "One row", matrix: [["มีข้อมูล", 123]] },
  ]);

  assert.deepEqual(workbook.skippedSheets, ["Blank", "One row"]);
  assert.deepEqual(workbook.preservedSheets, []);
  assert.equal(workbook.sheets.length, 0);
});

test("detects every datasource profile and applies non-export eligibility policy", () => {
  const cases: Array<{
    expected: ReturnType<typeof detectSourceProfile>;
    sheetName: string;
    matrix: any[][];
  }> = [
    {
      expected: "NEW_ASSET_2567",
      sheetName: "ครุภัณฑ์ใหม่ 2567",
      matrix: [
        ["รหัสสินทรัพย์", "ชนิดสินทรัพย์", "รายละเอียดสินทรัพย์", "ราคาสินทรัพย์"],
        ["A-001", "ครุภัณฑ์สำนักงาน", "โต๊ะ", 1000],
      ],
    },
    {
      expected: "REGISTER_3_ROW_HEADER",
      sheetName: "ทะเบียน",
      matrix: [
        ["ลำดับ", "รายการ", "รหัสครุภัณฑ์", "วันเดือนปี", "สภาพครุภัณฑ์"],
        [1, "โต๊ะ", "1-01-001", "1/1/2567", "ปกติ"],
      ],
    },
    {
      expected: "TRANSFER_2567",
      sheetName: "รับโอน",
      matrix: [
        ["เลขที่หนังสือ", "รายการ", "หมวดครุภัณฑ์", "รหัสครุภัณฑ์", "หน่วยงาน"],
        ["1/2567", "โต๊ะ", "สำนักงาน", "1-01-001", "กองคลัง"],
      ],
    },
    {
      expected: "ASSET_DATA",
      sheetName: "AssetData",
      matrix: [
        ["AssetCode", "ModelName", "AssetTypeName", "PurchaseDate", "PurchasePrice"],
        ["A-001", "Computer", "IT", "2024-01-01", 25000],
      ],
    },
    {
      expected: "FLEXIBLE_ASSET_TABLE",
      sheetName: "ข้อมูลสินทรัพย์",
      matrix: [
        ["รหัสสินทรัพย์", "ชื่อสินทรัพย์", "วันที่ได้มา", "มูลค่า"],
        ["A-001", "โต๊ะ", "1/1/2567", 1000],
      ],
    },
    {
      expected: "HELP_OR_TEMPLATE_SKIP",
      sheetName: "Help",
      matrix: [["วิธีใช้"], ["อัปโหลดไฟล์ Excel"]],
    },
    {
      expected: "SUMMARY_SKIP",
      sheetName: "แบบ กข",
      matrix: [["ประเภททรัพย์สิน", "รหัสพัสดุ"], ["ครุภัณฑ์", "001"]],
    },
    {
      expected: "REVIEW_MAINTENANCE",
      sheetName: "แผนซ่อมบำรุง",
      matrix: [["วันที่ซ่อม", "แจ้งซ่อม"], ["1/1/2567", "เปลี่ยนอะไหล่"]],
    },
    {
      expected: "UNKNOWN",
      sheetName: "ข้อมูลอื่น",
      matrix: [["หัวข้อ", "ค่า"], ["ข้อมูล", "อื่น ๆ"]],
    },
  ];

  for (const item of cases) {
    assert.equal(detectSourceProfile(item.sheetName, item.matrix), item.expected, item.sheetName);
  }

  assert.deepEqual(decideProfileEligibility("SUMMARY_SKIP", 1), {
    eligibility: "skipped",
    reason: "ชีตสรุปอ้างอิงยอดจากชีตสินทรัพย์อื่นและไม่มีข้อมูลรายทรัพย์สิน จึงไม่แปลงซ้ำเข้า Template",
    shouldParse: false,
  });
  assert.equal(decideProfileEligibility("HELP_OR_TEMPLATE_SKIP", 1).eligibility, "skipped");
  assert.equal(decideProfileEligibility("REVIEW_MAINTENANCE", 0.8).eligibility, "unsupported");
  assert.equal(decideProfileEligibility("UNKNOWN", 0).eligibility, "unsupported");
  assert.equal(decideProfileEligibility("ASSET_DATA", 0.9).eligibility, "exportable");
});

test("assetData mapping uses normalized fields and PurchasePrice fallback rule", () => {
  const workbook = createDataSourceWorkbook("asset-data.xlsx", [
    {
      sheetName: "AssetData",
      matrix: [
        [
          "AssetCode",
          "ModelName",
          "AssetTypeName",
          "PurchaseDate",
          "PurchasePrice",
          "Price",
          "LocationName",
          "Status",
          "BrandName",
        ],
        [
          "A-001",
          "เครื่องคอมพิวเตอร์",
          "ครุภัณฑ์คอมพิวเตอร์",
          "2024-01-05",
          "",
          25000,
          "อาคาร 1",
          "เสื่อมสภาพ",
          "SAMSUNG",
        ],
      ],
    },
  ]);
  const sheet = workbook.sheets[0];
  const mapping = mappingSuggestionsToRecord(suggestMapping(sheet.headers));
  const rows = transformRowsToTemplateDataset(sheet.rows, mapping);
  const manualMapping = { "ชื่อสินทรัพย์": "BrandName" };
  const manualRows = transformRowsToTemplateDataset(
    sheet.rows,
    mergeMapping(mapping, manualMapping),
    manualMapping,
  );
  const clearedRows = transformRowsToTemplateDataset(
    sheet.rows,
    mergeMapping(mapping, { "ชื่อสินทรัพย์": "" }),
    { "ชื่อสินทรัพย์": "" },
  );

  assert.equal(rows[0]["รหัสสินทรัพย์"], "A-001");
  assert.equal(rows[0]["ชื่อสินทรัพย์"], "เครื่องคอมพิวเตอร์");
  assert.equal(rows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์คอมพิวเตอร์");
  assert.equal(rows[0]["ประเภทสินทรัพย์"], "");
  assert.equal(rows[0]["มูลค่า"], 25000);
  assert.equal(rows[0]["อาคาร"], "อาคาร 1");
  assert.equal(rows[0]["สถานะ"], "รอจำหน่าย");
  assert.equal(rows[0]["ต้องตรวจนับ"], "");
  assert.equal(rows[0]["คิดค่าเสื่อม"], "");
  assert.equal(rows[0]["ของสำคัญ"], "");
  assert.equal(manualRows[0]["ชื่อสินทรัพย์"], "SAMSUNG");
  assert.equal(clearedRows[0]["ชื่อสินทรัพย์"], "");
});

test("mapping aliases cover source-system headers without crossing authoritative fields", () => {
  const mapping = mappingSuggestionsToRecord(
    suggestMapping([
      "AssetCode",
      "ModelName",
      "AssetTypeName",
      "LocationName",
      "DepartmentName",
      "PurchasePrice",
      "PurchaseDate",
      "Status",
      "Serial",
      "BrandName",
      "ResponsibleUnit",
      "BudgetSource",
    ]),
  );

  assert.equal(mapping["รหัสสินทรัพย์"], "AssetCode");
  assert.equal(mapping["อาคาร"], "LocationName");
  assert.equal(mapping["สำนัก"], "DepartmentName");
  assert.equal(mapping["มูลค่า"], "PurchasePrice");
  assert.equal(mapping["วันที่ได้รับ"], "PurchaseDate");
  assert.equal(mapping["สถานะ"], "Status");
  assert.equal(mapping["งานที่รับผิดชอบ"], "ResponsibleUnit");
  assert.equal(mapping["แหล่งงบประมาณ"], "BudgetSource");

  for (const templateColumn of ["ชื่อสินทรัพย์", "รายละเอียด", "ชนิดสินทรัพย์", "รายการสินทรัพย์"]) {
    assert.equal(mapping[templateColumn], "", `${templateColumn} must use normalized parser fields`);
  }
  assert.equal(COLUMN_ALIASES["รายละเอียด"].includes("Serial"), true);
  assert.equal(COLUMN_ALIASES["รายละเอียด"].includes("BrandName"), true);
  assert.equal(COLUMN_ALIASES["มูลค่า"].includes("Cost"), true);
});

test("auto mapping requires an exact header or explicit unambiguous alias", () => {
  const partial = mappingSuggestionsToRecord(
    suggestMapping(["อาคารสินทรัพย์", "ข้อมูลราคาที่ได้มาเดิม", "หน่วยงาน"]),
  );
  const explicit = mappingSuggestionsToRecord(
    suggestMapping(["สถานที่ใช้งาน", "ราคาที่ได้มา", "ResponsibleUnit"]),
  );

  assert.equal(partial["อาคาร"], "");
  assert.equal(partial["มูลค่า"], "");
  assert.equal(partial["สำนัก"], "");
  assert.equal(explicit["อาคาร"], "สถานที่ใช้งาน");
  assert.equal(explicit["มูลค่า"], "ราคาที่ได้มา");
  assert.equal(explicit["งานที่รับผิดชอบ"], "ResponsibleUnit");
});

test("new asset sheets keep missing asset names blank and preserve source item/detail", () => {
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
  assert.equal(rows[0]["ชื่อสินทรัพย์"], "");
  assert.equal(rows[0]["รายละเอียด"], "เครื่องปรับอากาศ 24,000 BTU");
  assert.equal(rows[0]["รายการสินทรัพย์"], "เครื่องปรับอากาศ (420)");
  assert.equal(rows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์สำนักงาน");
  assert.equal(rows[0]["ประเภทสินทรัพย์"], "");
  assert.equal(rows[0]["สถานะ"], "");
  assert.equal(rows[0]["ต้องตรวจนับ"], "");
  assert.equal(rows[0]["คิดค่าเสื่อม"], "");
  assert.equal(rows[0]["ของสำคัญ"], "");
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
  assert.equal(departmentRows[0]["วันที่ได้รับ"], "01/05/2024");
  assert.equal(departmentRows[0]["มูลค่า"], 1200);
  assert.equal(departmentRows[0]["งานที่รับผิดชอบ"], "งานพัสดุ");
  assert.equal(splitCodeRows[0]["รหัสสินทรัพย์"], "055-66-0281");
  assert.equal(splitCodeRows[0]["วันที่ได้รับ"], "07/09/2023");
  assert.equal(splitCodeRows[0]["มูลค่า"], 6420);
  assert.equal(splitCodeRows[0]["ประเภทสินทรัพย์"], "");
  assert.equal(splitCodeRows[0]["ชนิดสินทรัพย์"], "");
  assert.equal(consolidatedRows[0]["รหัสสินทรัพย์"], "401-65-9822");
  assert.equal(consolidatedRows[0]["ชื่อสินทรัพย์"], "เก้าอี้ทำงาน");
  assert.equal(consolidatedRows[0]["รายละเอียด"], "เก้าอี้ทำงาน MONO");
  assert.equal(consolidatedRows[0]["งานที่รับผิดชอบ"], "กองการเจ้าหน้าที่");
  assert.equal(consolidatedRows[0]["ประเภทสินทรัพย์"], "");
  assert.equal(consolidatedRows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์สำนักงาน");
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
  assert.equal(rows[0]["ประเภทสินทรัพย์"], "ครุภัณฑ์");
  assert.equal(rows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์สำนักงาน");
  assert.equal(rows[0]["สถานะ"], "ปกติ");
  assert.equal(rows[0]["เงินงบประมาณ"], 1200);
  assert.equal(rows[0]["แหล่งงบประมาณ"], "เงินงบประมาณ");
  assert.equal(rows[0]["ส่งคืนสินทรัพย์"], "");
});

test("flexible transform keeps enum fields out of fuzzy mappings and normalizes deterioration", () => {
  const workbook = createDataSourceWorkbook("funding-status.xlsx", [
    {
      sheetName: "Sheet3",
      matrix: [
        ["ลำดับ", "ประเภทสินทรัพย์", "ชนิดสินทรัพย์", "รหัสสินทรัพย์ Elaas", "รหัสสินทรัพย์", "ชื่อสินทรัพย์", "รายละเอียดสินทรัพย์", "วันที่ได้มา", "ราคาสินทรัพย์", "ค่าเสื่อมราคาสะสม", "สถานะ", "แหล่งเงิน", "", "สภาพสินทรัพย์"],
        ["", "", "", "", "", "", "", "", "", "", "", "เงินงบประมาณ", "เงินสะสม/เงินทุนสำรองเงินสะสม", ""],
        [1, "ครุภัณฑ์", "ครุภัณฑ์สำนักงาน", "ELAAS-1", "400-67-0001", "โต๊ะทำงาน", "โต๊ะเหล็ก", "1/5/2567", 1200, 100, "เสื่อมสภาพ", 1200, 0, "ใช้งานได้"],
      ],
    },
  ]);
  const sheet = workbook.sheets[0];
  const suggestions = suggestMapping(sheet.headers);
  const mapping = mappingSuggestionsToRecord(suggestions);
  const rows = transformRowsToTemplateDataset(sheet.rows, mapping);

  assert.equal(mapping["ส่งคืนสินทรัพย์"], "");
  assert.equal(mapping["คิดค่าเสื่อม"], "");
  assert.equal(rows[0]["ชื่อสินทรัพย์"], "โต๊ะทำงาน");
  assert.equal(rows[0]["รายละเอียด"], "โต๊ะเหล็ก");
  assert.equal(rows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์สำนักงาน");
  assert.equal(rows[0]["แหล่งงบประมาณ"], "เงินงบประมาณ");
  assert.equal(rows[0]["สถานะ"], "รอจำหน่าย");
  assert.equal(rows[0]["ส่งคืนสินทรัพย์"], "");
  assert.equal(rows[0]["คิดค่าเสื่อม"], "");
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
  assert.equal(rows[0]["ประเภทสินทรัพย์"], "");
  assert.equal(rows[1]["ชื่อสินทรัพย์"], "โต๊ะประชุม");
  assert.equal(rows[1]["ชนิดสินทรัพย์"], "");
  assert.equal(rows[1]["รายการสินทรัพย์"], "");
  assert.equal(rows.length, 2);
  assert.equal(sheet.warnings.some((warning) => warning.includes("ไม่มีรหัสสินทรัพย์")), true);
});

test("registry data rows win over category-like words in complete asset names", () => {
  const workbook = createDataSourceWorkbook("buildings.xlsx", [
    {
      sheetName: "อาคาร",
      matrix: [
        ["ลำดับ", "รายการ", "รหัสครุภัณฑ์", "วันเดือนปี", "ราคาที่ได้มา", "หน่วยงาน", "สภาพครุภัณฑ์"],
        ["", "", "", "", "", "", "ปกติ", "ชำรุด"],
        ["", "", "", "", "", "", ""],
        ["", "อสังหาริมทรัพย์", "", "", "", "", ""],
        [1, "อาคารหอปูมละกอน", "005-94-0001", "5 ม.ค. 2494", 440000, "งานท่องเที่ยว", "/"],
        [2, "สิ่งปลูกสร้างเพื่อการท่องเที่ยว (005)", "005-67-0002", "1/5/2567", 120000, "งานท่องเที่ยว", "/"],
      ],
    },
  ]);
  const sheet = workbook.sheets[0];
  const rows = transformRowsToTemplateDataset(sheet.rows, {});

  assert.equal(sheet.rowCount, 2);
  assert.equal(rows[0]["ชื่อสินทรัพย์"], "อาคารหอปูมละกอน");
  assert.equal(rows[1]["ชื่อสินทรัพย์"], "สิ่งปลูกสร้างเพื่อการท่องเที่ยว (005)");
  assert.equal(rows[0]["ชนิดสินทรัพย์"], "อสังหาริมทรัพย์");
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
        [3, "เก้าอี้สำนักงาน", "1", "401", "67", "10088", "21-Feb-67", 4800, "งานตลาด", "P"],
        ["", "งานสาธารณูปโภคบำรุงรักษาทางและสะพาน", "15500", "15500", "15500", "", "", "", ""],
      ],
    },
  ]);
  const rows = transformRowsToTemplateDataset(workbook.sheets[0].rows, {});

  assert.equal(rows[0]["รหัสสินทรัพย์"], "3-002-37-0032");
  assert.equal(rows[0]["วันที่ได้รับ"], "21/11/1994");
  assert.equal(rows[0]["มูลค่า"], 407000);
  assert.equal(rows[1]["รหัสสินทรัพย์"], "400-43-3921");
  assert.equal(rows[1]["วันที่ได้รับ"], "07/08/2000");
  assert.equal(rows[2]["รหัสสินทรัพย์"], "1-401-67-10088");
  assert.equal(rows[2]["วันที่ได้รับ"], "21/02/2024");
  assert.equal(rows[2]["มูลค่า"], 4800);
  assert.equal(rows[2]["งานที่รับผิดชอบ"], "งานตลาด");
  assert.equal(rows.length, 3);
});

test("registry parser supports a single header row without dropping early assets", () => {
  const workbook = createDataSourceWorkbook("one-row-register.xlsx", [
    {
      sheetName: "ทะเบียน",
      matrix: [
        ["ลำดับ", "รายการ", "รหัสครุภัณฑ์", "วันเดือนปี", "ราคาที่ได้มา", "หน่วยงาน", "สภาพครุภัณฑ์"],
        [1, "โต๊ะทำงาน", "400-67-0001", "1/5/2567", 1200, "งานพัสดุ", "x"],
        [2, "เก้าอี้ทำงาน", "401-67-0002", "2/5/2567", 900, "งานพัสดุ", "x"],
      ],
    },
  ]);
  const sheet = workbook.sheets[0];
  const rows = transformRowsToTemplateDataset(sheet.rows, {});

  assert.equal(sheet.sourceProfile, "REGISTER_3_ROW_HEADER");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]["รหัสสินทรัพย์"], "400-67-0001");
  assert.equal(rows[0]["ชื่อสินทรัพย์"], "โต๊ะทำงาน");
  assert.equal(rows[0]["วันที่ได้รับ"], "01/05/2024");
  assert.equal(rows[0]["มูลค่า"], 1200);
  assert.equal(rows[0]["งานที่รับผิดชอบ"], "งานพัสดุ");
});

test("registry parser reads split day month year before value and responsible unit", () => {
  const workbook = createDataSourceWorkbook("split-date-register.xlsx", [
    {
      sheetName: "ทะเบียน",
      matrix: [
        ["ลำดับ", "รายการ", "รหัสครุภัณฑ์", "วัน", "เดือน", "ปี", "ราคาที่ได้มา", "หน่วยงาน", "สภาพครุภัณฑ์"],
        ["", "", "", "", "", "", "", "", "ปกติ", "ชำรุด"],
        ["", "", "", "", "", "", "", "", ""],
        [1, "เครื่องคอมพิวเตอร์", "416-42-0052", 30, 7, 2542, 75435, "งานแผนที่", "x"],
      ],
    },
  ]);
  const rows = transformRowsToTemplateDataset(workbook.sheets[0].rows, {});

  assert.equal(rows.length, 1);
  assert.equal(rows[0]["วันที่ได้รับ"], "30/07/1999");
  assert.equal(rows[0]["มูลค่า"], 75435);
  assert.equal(rows[0]["งานที่รับผิดชอบ"], "งานแผนที่");
  assert.equal(rows[0]["สถานะ"], "ปกติ");
});

test("manual mapping overrides profile-derived responsible unit and can explicitly clear it", () => {
  const workbook = createDataSourceWorkbook("manual-register.xlsx", [
    {
      sheetName: "ทะเบียน",
      matrix: [
        ["ลำดับ", "รายการ", "รหัสครุภัณฑ์", "วันเดือนปี", "ราคาที่ได้มา", "หน่วยงาน", "สภาพครุภัณฑ์", "", "", "", "", "", "หมายเหตุ"],
        ["", "", "", "", "", "", "ปกติ", "ชำรุด", "เสื่อม", "สูญหาย", "เก็บไว้นาน", "ไม่จำเป็น", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", ""],
        [1, "โต๊ะทำงาน", "400-67-0001", "1/5/2567", 1200, "กองการเจ้าหน้าที่", "x", "", "", "", "", "", "งานพัสดุ"],
      ],
    },
  ]);
  const sheet = workbook.sheets[0];
  const autoMapping = mappingSuggestionsToRecord(suggestMapping(sheet.headers));

  const remappedRows = transformRowsToTemplateDataset(
    sheet.rows,
    { ...autoMapping, "งานที่รับผิดชอบ": "note" },
    { "งานที่รับผิดชอบ": "note" },
  );
  const clearedRows = transformRowsToTemplateDataset(
    sheet.rows,
    { ...autoMapping, "งานที่รับผิดชอบ": "" },
    { "งานที่รับผิดชอบ": "" },
  );

  assert.equal(remappedRows[0]["งานที่รับผิดชอบ"], "งานพัสดุ");
  assert.equal(clearedRows[0]["งานที่รับผิดชอบ"], "");
});

test("manual mapping copies source values exactly without date normalization", () => {
  const sourceRows = [{
    __sourceProfile: "UNKNOWN",
    rawDatePart: 18,
    rawText: "เก้าอี้อเนกประสงค์ ยี่ห้อ TK รุ่น LK-16",
  }];
  const manualMapping = {
    "ชื่อสินทรัพย์": "rawText",
    "รายละเอียด": "rawText",
    "วันที่ได้รับ": "rawDatePart",
  };
  const rows = transformRowsToTemplateDataset(sourceRows, manualMapping, manualMapping);

  assert.equal(rows[0]["ชื่อสินทรัพย์"], sourceRows[0].rawText);
  assert.equal(rows[0]["รายละเอียด"], sourceRows[0].rawText);
  assert.equal(rows[0]["วันที่ได้รับ"], 18);
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

test("split template output preserves every source sheet that was not converted", async () => {
  const source = new ExcelJS.Workbook();
  const summary = source.addWorksheet("แบบกข.");
  summary.getCell("A1").value = "งบทรัพย์สินเทศบาลนครลำปาง";
  summary.getCell("A2").value = { formula: "1+1", result: 2 };
  summary.getCell("A1").font = { bold: true };
  summary.mergeCells("A1:F1");
  const review = source.addWorksheet("ต้องตรวจสอบ");
  review.getCell("A1").value = "ข้อมูลเดิม";

  const wb = await buildAssetTemplateWorkbookBySheet(
    [{ sheetName: "อาคาร", rows: [{ "รหัสสินทรัพย์": "005-94-0001", "ชื่อสินทรัพย์": "อาคารหอปูมละกอน" }] }],
    {
      sourceWorkbookBuffer: Buffer.from(await source.xlsx.writeBuffer()),
      preservedSheetNames: ["แบบกข.", "ต้องตรวจสอบ"],
      sourceSheetOrder: ["แบบกข.", "อาคาร", "ต้องตรวจสอบ"],
    },
  );
  const readBack = await readWorkbook(wb);

  assert.deepEqual(readBack.worksheets.map((sheet) => sheet.name), ["แบบกข.", "อาคาร", "ต้องตรวจสอบ", "Reference"]);
  assert.equal(readBack.getWorksheet("แบบกข.")?.getCell("A1").value, "งบทรัพย์สินเทศบาลนครลำปาง");
  assert.equal(readBack.getWorksheet("แบบกข.")?.getCell("A2").value, 2);
  assert.equal(readBack.getWorksheet("แบบกข.")?.getCell("A1").font.bold, true);
  assert.equal(readBack.getWorksheet("ต้องตรวจสอบ")?.getCell("A1").value, "ข้อมูลเดิม");
});

test("split template output preserves legacy source matrices when no xlsx buffer exists", async () => {
  const wb = await buildAssetTemplateWorkbookBySheet(
    [{ sheetName: "ข้อมูล", rows: [{ "รหัสสินทรัพย์": "A-001", "ชื่อสินทรัพย์": "โต๊ะ" }] }],
    {
      sourceWorkbookSheets: [{ sheetName: "สรุปเดิม", matrix: [["หัวข้อ", "ยอด"], ["อาคาร", "6"]] }],
      preservedSheetNames: ["สรุปเดิม"],
    },
  );
  const readBack = await readWorkbook(wb);

  assert.equal(readBack.getWorksheet("สรุปเดิม")?.getCell("A1").value, "หัวข้อ");
  assert.equal(readBack.getWorksheet("สรุปเดิม")?.getCell("B2").value, "6");
});

test("split template output sanitizes unique names, reserves Reference, and preserves cell types", async () => {
  const longUnsafeName = "ข้อมูล/ครุภัณฑ์:*?ที่มีชื่อยาวเกินกว่าสามสิบเอ็ดตัวอักษร";
  const wb = await buildAssetTemplateWorkbookBySheet([
    {
      sheetName: longUnsafeName,
      rows: [
        {
          "รหัสสินทรัพย์": "001-01-0001",
          "ชื่อสินทรัพย์": "โต๊ะทำงาน",
          "มูลค่า": 1234.5,
          "วันที่ได้รับ": "01/05/2024",
        },
      ],
    },
    { sheetName: longUnsafeName, rows: [] },
    { sheetName: "Reference", rows: [] },
  ]);
  const readBack = await readWorkbook(wb);
  const dataSheets = readBack.worksheets.filter((sheet) => sheet.name !== "Reference");
  const names = dataSheets.map((sheet) => sheet.name);
  const firstRows = worksheetRows(dataSheets[0]);
  const metadata = await loadAssetTemplateMetadata();
  const referenceRows = worksheetRows(readBack.getWorksheet("Reference")!);

  assert.equal(names.length, 3);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 3);
  assert.equal(names.every((name) => name.length <= 31 && !/[\[\]:*?/\\]/.test(name)), true);
  assert.equal(names[2], "Reference (2)");
  assert.equal(readBack.worksheets.at(-1)?.name, "Reference");
  assert.equal(referenceRows[1][0], [...metadata.references.categories][0]);
  assert.equal(firstRows[1][2], "001-01-0001");
  assert.equal(typeof firstRows[1][2], "string");
  assert.equal(firstRows[1][16], 1234.5);
  assert.equal(typeof firstRows[1][16], "number");
  assert.equal(firstRows[1][17], "01/05/2024");
  assert.equal(typeof firstRows[1][17], "string");
});

test("validation policy checks exportable profiles and ignores non-export asset policies", () => {
  for (const sourceProfile of [
    "REGISTER_3_ROW_HEADER",
    "ASSET_DATA",
    "FLEXIBLE_ASSET_TABLE",
  ] as const) {
    assert.equal(
      shouldValidateSheet({ sourceProfile, eligibility: "exportable" }),
      true,
      sourceProfile,
    );
  }

  for (const [sourceProfile, eligibility] of [
    ["UNKNOWN", "unsupported"],
    ["HELP_OR_TEMPLATE_SKIP", "skipped"],
    ["SUMMARY_SKIP", "skipped"],
    ["REVIEW_MAINTENANCE", "unsupported"],
  ] as const) {
    assert.equal(shouldValidateSheet({ sourceProfile, eligibility }), false, sourceProfile);
  }
  assert.equal(
    shouldValidateSheet({ sourceProfile: "ASSET_DATA", eligibility: "exportable", selected: false }),
    false,
  );

  const normalizedRows = [{ assetCode: "A-001", assetName: "โต๊ะทำงาน" }];
  assert.deepEqual(
    validateSheetLevel(
      "Data",
      1,
      1,
      {},
      normalizedRows,
      { sourceProfile: "ASSET_DATA", eligibility: "exportable" },
    ),
    [],
  );
  assert.deepEqual(
    validateMappedRows(
      "Unknown",
      Array.from({ length: 100 }, () => ({ "รหัสสินทรัพย์": "", "ชื่อสินทรัพย์": "" })),
      [],
      undefined,
      { sourceProfile: "UNKNOWN", eligibility: "unsupported" },
    ),
    [],
  );
});

test("sheet selection defaults include only validated exportable profiles", () => {
  const selection = createDefaultSheetSelection([
    {
      sheetName: "Ready",
      sourceProfile: "ASSET_DATA",
      detectedProfile: "assetData",
      eligibility: "exportable",
      reason: "ready",
      rowCount: 10,
      errorCount: 0,
      warningCount: 0,
      confidence: 1,
    },
    {
      sheetName: "Warning",
      sourceProfile: "FLEXIBLE_ASSET_TABLE",
      detectedProfile: "unknown",
      eligibility: "exportable",
      reason: "warnings only",
      rowCount: 5,
      errorCount: 0,
      warningCount: 2,
      confidence: 0.9,
    },
    {
      sheetName: "Unknown",
      sourceProfile: "UNKNOWN",
      detectedProfile: "unknown",
      eligibility: "unsupported",
      reason: "manual review",
      rowCount: 5,
      errorCount: 0,
      warningCount: 0,
      confidence: 0,
    },
    {
      sheetName: "Maintenance",
      sourceProfile: "REVIEW_MAINTENANCE",
      detectedProfile: "maintenance",
      eligibility: "unsupported",
      reason: "not an asset export",
      rowCount: 0,
      errorCount: 0,
      warningCount: 0,
      confidence: 0.9,
    },
    {
      sheetName: "Help",
      sourceProfile: "HELP_OR_TEMPLATE_SKIP",
      detectedProfile: "help",
      eligibility: "skipped",
      reason: "help sheet",
      rowCount: 0,
      errorCount: 0,
      warningCount: 0,
      confidence: 1,
    },
  ]);

  assert.deepEqual(selection, {
    Ready: true,
    Warning: true,
    Unknown: false,
    Maintenance: false,
    Help: false,
  });
  assert.equal(selectedSheetCount(selection), 2);
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

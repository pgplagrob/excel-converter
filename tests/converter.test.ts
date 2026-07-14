import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx-js-style";
import { createDataSourceWorkbook } from "../lib/datasource";
import { mappingSuggestionsToRecord, suggestMapping } from "../lib/mapping";
import { buildAssetTemplateWorkbook, buildAssetTemplateWorkbookBySheet, loadAssetTemplateMetadata } from "../lib/template";
import { transformRowsToTemplateDataset } from "../lib/transform";
import { validateMappedRows, validateSheetLevel } from "../lib/validate";

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
});

test("template output keeps Sheet1 at 44 columns and preserves Reference sheet", () => {
  const metadata = loadAssetTemplateMetadata();
  const wb = buildAssetTemplateWorkbook([
    {
      "รหัสสินทรัพย์": "A-001",
      "ชื่อสินทรัพย์": "เครื่องคอมพิวเตอร์",
      "ประเภทสินทรัพย์": "ครุภัณฑ์",
      "มูลค่า": 25000,
      "สถานะ": "ปกติ",
    },
  ]);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const readBack = XLSX.read(buffer, { type: "buffer" });
  const sheetRows = XLSX.utils.sheet_to_json(readBack.Sheets.Sheet1, { header: 1, defval: "" }) as unknown[][];

  assert.equal(metadata.columns.length, 44);
  assert.equal(sheetRows[0].length, 44);
  assert.equal(readBack.SheetNames.includes("Reference"), true);
  assert.equal(sheetRows.length, 2);
  assert.equal(sheetRows[1][2], "A-001");
});

test("split template output creates one worksheet per exportable source sheet", () => {
  const wb = buildAssetTemplateWorkbookBySheet([
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
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const readBack = XLSX.read(buffer, { type: "buffer" });
  const firstRows = XLSX.utils.sheet_to_json(readBack.Sheets["ครุภัณฑ์ใหม่2567"], { header: 1, defval: "" }) as unknown[][];
  const secondRows = XLSX.utils.sheet_to_json(readBack.Sheets["สำนักงาน"], { header: 1, defval: "" }) as unknown[][];

  assert.deepEqual(readBack.SheetNames, ["ครุภัณฑ์ใหม่2567", "สำนักงาน", "Reference"]);
  assert.equal(firstRows[0].length, 44);
  assert.equal(secondRows[0].length, 44);
  assert.equal(firstRows[1][2], "A-001");
  assert.equal(secondRows[1][2], "B-001");
});

test("validation blocks rows with missing required asset identity", () => {
  const metadata = loadAssetTemplateMetadata();
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

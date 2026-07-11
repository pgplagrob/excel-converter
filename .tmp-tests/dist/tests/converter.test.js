"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const XLSX = __importStar(require("xlsx-js-style"));
const datasource_1 = require("../lib/datasource");
const mapping_1 = require("../lib/mapping");
const template_1 = require("../lib/template");
const transform_1 = require("../lib/transform");
const validate_1 = require("../lib/validate");
(0, node_test_1.default)("classifies assetData as exportable input and skips help/unknown non-asset sheets", () => {
    const workbook = (0, datasource_1.createDataSourceWorkbook)("asset-data.xlsx", [
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
    strict_1.default.equal(workbook.sheets.length, 1);
    strict_1.default.equal(workbook.sheets[0].sourceProfile, "ASSET_DATA");
    strict_1.default.equal(workbook.sheets[0].rows[0].assetCode, "A-001");
    strict_1.default.deepEqual(workbook.skippedSheets.sort(), ["Help", "Random"]);
});
(0, node_test_1.default)("assetData mapping uses normalized fields and PurchasePrice fallback rule", () => {
    const workbook = (0, datasource_1.createDataSourceWorkbook)("asset-data.xlsx", [
        {
            sheetName: "AssetData",
            matrix: [
                ["AssetCode", "ModelName", "AssetTypeName", "PurchaseDate", "PurchasePrice", "Price", "LocationName"],
                ["A-001", "เครื่องคอมพิวเตอร์", "ครุภัณฑ์คอมพิวเตอร์", "2024-01-05", "", 25000, "อาคาร 1"],
            ],
        },
    ]);
    const sheet = workbook.sheets[0];
    const mapping = (0, mapping_1.mappingSuggestionsToRecord)((0, mapping_1.suggestMapping)(sheet.headers));
    const rows = (0, transform_1.transformRowsToTemplateDataset)(sheet.rows, mapping);
    strict_1.default.equal(rows[0]["รหัสสินทรัพย์"], "A-001");
    strict_1.default.equal(rows[0]["ชื่อสินทรัพย์"], "เครื่องคอมพิวเตอร์");
    strict_1.default.equal(rows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์คอมพิวเตอร์");
    strict_1.default.equal(rows[0]["มูลค่า"], 25000);
    strict_1.default.equal(rows[0]["อาคาร"], "อาคาร 1");
});
(0, node_test_1.default)("registry group and item labels emit once and do not become asset names", () => {
    const workbook = (0, datasource_1.createDataSourceWorkbook)("registry.xlsx", [
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
    const rows = (0, transform_1.transformRowsToTemplateDataset)(sheet.rows, {});
    strict_1.default.equal(rows[0]["ชื่อสินทรัพย์"], "โต๊ะทำงาน");
    strict_1.default.equal(rows[0]["ชนิดสินทรัพย์"], "ครุภัณฑ์สำนักงาน");
    strict_1.default.equal(rows[0]["รายการสินทรัพย์"], "โต๊ะ(400)");
    strict_1.default.equal(rows[1]["ชื่อสินทรัพย์"], "โต๊ะประชุม");
    strict_1.default.equal(rows[1]["ชนิดสินทรัพย์"], "");
    strict_1.default.equal(rows[1]["รายการสินทรัพย์"], "");
});
(0, node_test_1.default)("template output keeps Sheet1 at 44 columns and preserves Reference sheet", () => {
    const metadata = (0, template_1.loadAssetTemplateMetadata)();
    const wb = (0, template_1.buildAssetTemplateWorkbook)([
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
    const sheetRows = XLSX.utils.sheet_to_json(readBack.Sheets.Sheet1, { header: 1, defval: "" });
    strict_1.default.equal(metadata.columns.length, 44);
    strict_1.default.equal(sheetRows[0].length, 44);
    strict_1.default.equal(readBack.SheetNames.includes("Reference"), true);
    strict_1.default.equal(sheetRows.length, 2);
    strict_1.default.equal(sheetRows[1][2], "A-001");
});
(0, node_test_1.default)("split template output creates one worksheet per exportable source sheet", () => {
    const wb = (0, template_1.buildAssetTemplateWorkbookBySheet)([
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
    const firstRows = XLSX.utils.sheet_to_json(readBack.Sheets["ครุภัณฑ์ใหม่2567"], { header: 1, defval: "" });
    const secondRows = XLSX.utils.sheet_to_json(readBack.Sheets["สำนักงาน"], { header: 1, defval: "" });
    strict_1.default.deepEqual(readBack.SheetNames, ["ครุภัณฑ์ใหม่2567", "สำนักงาน", "Reference"]);
    strict_1.default.equal(firstRows[0].length, 44);
    strict_1.default.equal(secondRows[0].length, 44);
    strict_1.default.equal(firstRows[1][2], "A-001");
    strict_1.default.equal(secondRows[1][2], "B-001");
});
(0, node_test_1.default)("validation blocks rows with missing required asset identity", () => {
    const metadata = (0, template_1.loadAssetTemplateMetadata)();
    const rows = [
        {
            "รหัสสินทรัพย์": "",
            "ชื่อสินทรัพย์": "รวมทั้งสิ้น",
            "สถานะ": "ไม่อยู่ในระบบ",
        },
    ];
    const sheetIssues = (0, validate_1.validateSheetLevel)("Bad", rows.length, 1, {}, []);
    const rowIssues = (0, validate_1.validateMappedRows)("Bad", rows, [], metadata.references);
    strict_1.default.equal(sheetIssues.some((issue) => issue.column === "รหัสสินทรัพย์"), true);
    strict_1.default.equal(rowIssues.some((issue) => issue.severity === "error"), true);
    strict_1.default.equal(rowIssues.some((issue) => issue.column === "สถานะ"), true);
});

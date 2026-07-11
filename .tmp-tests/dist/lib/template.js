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
exports.loadAssetTemplateMetadata = loadAssetTemplateMetadata;
exports.buildAssetTemplateWorkbook = buildAssetTemplateWorkbook;
exports.buildAssetTemplateWorkbookBySheet = buildAssetTemplateWorkbookBySheet;
exports.getAssetTemplatePath = getAssetTemplatePath;
const path_1 = __importDefault(require("path"));
const XLSX = __importStar(require("xlsx-js-style"));
const TEMPLATE_PATH = path_1.default.join(process.cwd(), "assets", "asset-template.xlsx");
function cellText(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}
function readTemplateWorkbook() {
    return XLSX.readFile(TEMPLATE_PATH, { cellDates: true, cellStyles: true });
}
function readSheetRows(ws) {
    if (!ws)
        return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}
function valuesFromReferenceColumn(rows, columnIndex) {
    return new Set(rows
        .slice(1)
        .map((row) => cellText(row[columnIndex]))
        .filter(Boolean));
}
function loadAssetTemplateMetadata() {
    const wb = readTemplateWorkbook();
    const sheetRows = readSheetRows(wb.Sheets.Sheet1);
    const referenceRows = readSheetRows(wb.Sheets.Reference);
    const columns = (sheetRows[0] || []).map(cellText).filter(Boolean);
    return {
        columns,
        references: {
            categories: valuesFromReferenceColumn(referenceRows, 0),
            getByMethods: valuesFromReferenceColumn(referenceRows, 1),
            sourceFunds: valuesFromReferenceColumn(referenceRows, 2),
            statuses: valuesFromReferenceColumn(referenceRows, 3),
            booleans: valuesFromReferenceColumn(referenceRows, 4),
        },
    };
}
function cloneStyle(value) {
    return value ? JSON.parse(JSON.stringify(value)) : undefined;
}
function applyTemplateStyles(target, source, columns, rowCount) {
    target["!cols"] = source["!cols"];
    target["!rows"] = source["!rows"] ? source["!rows"].slice(0, Math.max(1, rowCount + 1)) : undefined;
    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
        const headerAddress = XLSX.utils.encode_cell({ r: 0, c: colIndex });
        const sampleAddress = XLSX.utils.encode_cell({ r: 1, c: colIndex });
        const headerStyle = cloneStyle(source[headerAddress]?.s);
        const sampleStyle = cloneStyle(source[sampleAddress]?.s);
        if (target[headerAddress] && headerStyle)
            target[headerAddress].s = headerStyle;
        for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
            const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            if (!target[address])
                target[address] = { t: "s", v: "" };
            if (sampleStyle)
                target[address].s = cloneStyle(sampleStyle);
        }
    }
}
function buildTemplateSheet(rows, columns, sourceSheet) {
    const aoa = [
        columns,
        ...rows.map((row) => columns.map((column) => row[column] ?? "")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (sourceSheet) {
        applyTemplateStyles(ws, sourceSheet, columns, rows.length);
    }
    return ws;
}
function sanitizeSheetName(value) {
    const cleaned = (value || "Sheet")
        .replace(/[\[\]\:\*\?\/\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return (cleaned || "Sheet").slice(0, 31);
}
function uniqueSheetName(rawName, usedNames) {
    const baseName = sanitizeSheetName(rawName);
    let name = baseName;
    let counter = 2;
    while (usedNames.has(name.toLowerCase())) {
        const suffix = ` (${counter})`;
        name = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
        counter += 1;
    }
    usedNames.add(name.toLowerCase());
    return name;
}
function buildAssetTemplateWorkbook(rows) {
    const wb = readTemplateWorkbook();
    const metadata = loadAssetTemplateMetadata();
    const sourceSheet = wb.Sheets.Sheet1;
    const ws = buildTemplateSheet(rows, metadata.columns, sourceSheet);
    wb.Sheets.Sheet1 = ws;
    wb.SheetNames = ["Sheet1", ...wb.SheetNames.filter((name) => name !== "Sheet1")];
    return wb;
}
function buildAssetTemplateWorkbookBySheet(sheets) {
    const wb = readTemplateWorkbook();
    const metadata = loadAssetTemplateMetadata();
    const sourceSheet = wb.Sheets.Sheet1;
    const preservedSheetNames = wb.SheetNames.filter((name) => name !== "Sheet1");
    const usedNames = new Set(preservedSheetNames.map((name) => name.toLowerCase()));
    const outputSheetNames = [];
    delete wb.Sheets.Sheet1;
    for (const sheet of sheets) {
        const safeName = uniqueSheetName(sheet.sheetName, usedNames);
        wb.Sheets[safeName] = buildTemplateSheet(sheet.rows, metadata.columns, sourceSheet);
        outputSheetNames.push(safeName);
    }
    wb.SheetNames = [...outputSheetNames, ...preservedSheetNames];
    return wb;
}
function getAssetTemplatePath() {
    return TEMPLATE_PATH;
}

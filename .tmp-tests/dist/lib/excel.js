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
Object.defineProperty(exports, "__esModule", { value: true });
exports.readWorkbookBuffer = readWorkbookBuffer;
const XLSX = __importStar(require("xlsx-js-style"));
function readWorkbookBuffer(buffer, fileName) {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, cellStyles: true });
    const sheets = [];
    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            raw: false,
            defval: "",
        });
        const rowMeta = matrix.map((row, rowIndex) => {
            const fillColors = [];
            for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
                const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                const cell = ws[cellAddress];
                const color = cell?.s?.fgColor?.rgb ||
                    cell?.s?.fgColor?.indexed?.toString() ||
                    cell?.s?.fgColor?.theme?.toString() ||
                    "";
                fillColors[colIndex] = color.toUpperCase();
            }
            return { fillColors };
        });
        sheets.push({ sheetName, matrix, rowMeta });
    }
    return { fileName, sheets };
}

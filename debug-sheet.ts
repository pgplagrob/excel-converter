/**
 * Debug script: จำลอง pipeline จริงของโปรเจกต์กับไฟล์ Excel จริง
 * Run:  bun debug-sheet.ts [sheetName]        (default: สำนักงาน)
 *
 * pipeline:  readWorkbookBuffer -> createDataSourceWorkbook -> transformRowsToTemplateDataset
 * โชว์ค่า "หลัง transform" (ค่าที่ export ออกจริง) ไม่ใช่ค่าดิบภายใน
 */
import { readFileSync } from "fs";
import { readWorkbookBuffer } from "./lib/excel";
import { createDataSourceWorkbook } from "./lib/datasource";
import { suggestMapping, mappingSuggestionsToRecord } from "./lib/mapping";
import { transformRowsToTemplateDataset } from "./lib/transform";

const FILE = "ครุภัณฑ์สำนักปลัดเทศบาล67-แบบ-กข-แก้ไข15-11-67.xlsx";
const TARGET = process.argv[2] ?? "สำนักงาน";

const raw = await readWorkbookBuffer(readFileSync(FILE), FILE);
const ds = createDataSourceWorkbook(raw.fileName, raw.sheets);

const sheet = ds.sheets.find((s) => s.sheetName === TARGET);
if (!sheet) {
  console.log(`ไม่พบ sheet "${TARGET}". มี:`, ds.sheets.map((s) => s.sheetName));
  process.exit(1);
}

const CODE = "รหัสสินทรัพย์";
const NAME = "ชื่อสินทรัพย์";
const ITEM = "รายการสินทรัพย์";
const mapping = mappingSuggestionsToRecord(suggestMapping(sheet.headers));
const rows = transformRowsToTemplateDataset(sheet.rows, mapping); // ← output จริง

const bar = "=".repeat(72);
console.log(bar);
console.log(`SHEET: ${sheet.sheetName}   profile: ${sheet.sourceProfile}   headerRow: ${sheet.headerRowIndex + 1}`);
console.log(`parsed: ${sheet.rowCount}   ->   transform output: ${rows.length}   ${rows.length === sheet.rowCount ? "OK" : "⚠️ จำนวนแถวเปลี่ยน!"}`);
console.log(bar);

// --- CHECK 1: รหัสซ้ำ (ปัญหาจากไฟล์ต้นฉบับ) ---
const counts = new Map<string, string[]>();
let noCode = 0;
sheet.rows.forEach((r) => {
  const c = String(r["assetCode"] ?? "").trim();
  if (c) (counts.get(c) ?? counts.set(c, []).get(c)!).push(String(r.__excelRow));
  else noCode++;
});
const dupes = [...counts.entries()].filter(([, v]) => v.length > 1);
console.log(`\n[รหัสซ้ำ] ${dupes.length} รหัส   [แถวไม่มีรหัส] ${noCode}`);
dupes.forEach(([c, v]) => console.log(`   ${c}  ->  excelRows ${v.join(", ")}`));

// --- CHECK 2: ยอดรวมในไฟล์ (แถว "รวมทั้งสิ้น") ตรงกับที่ parse ได้ไหม ---
const rawSheet = raw.sheets.find((x) => x.sheetName === TARGET)!;
let stated: number | null = null;
for (const r of rawSheet.matrix) {
  const hasGrand = r.some((c) => /รวมทั้งสิ้น/.test(String(c ?? "")));
  if (hasGrand) {
    const num = r.map((c) => parseInt(String(c ?? "").replace(/[, ]/g, ""), 10)).find((n) => !isNaN(n));
    if (num != null) stated = num;
  }
}
if (stated != null) {
  const diff = stated - sheet.rowCount;
  console.log(`\n[ยอดรวมในไฟล์] "รวมทั้งสิ้น" = ${stated}   |   parse ได้ = ${sheet.rowCount}   |   ${diff === 0 ? "ตรง ✅" : `ต่าง ${diff} ⚠️ (ยอดในไฟล์ผิด)`}`);
} else {
  console.log(`\n[ยอดรวมในไฟล์] ไม่พบแถว "รวมทั้งสิ้น"`);
}

// --- CHECK 3: ชื่อสั้นผิดปกติ (คนกรอกตกหล่น) ---
const shortNames = rows.filter((r) => {
  const n = String(r[NAME] ?? "").trim();
  return n.length > 0 && n.length <= 5;
});
console.log(`\n[ชื่อสั้นผิดปกติ <=5 ตัว] ${shortNames.length} แถว`);
shortNames.slice(0, 10).forEach((r) => console.log(`   code=${r[CODE]}  name="${r[NAME]}"`));

// --- CHECK 4: 8 แถวแรก = ค่าที่ export ออกจริง ---
console.log(`\n[OUTPUT จริง 8 แถวแรก]  รหัส | ชื่อสินทรัพย์ | รายการสินทรัพย์:`);
for (const r of rows.slice(0, 8)) {
  console.log(
    "  " +
      String(r[CODE] ?? "").padEnd(13) + " | " +
      String(r[NAME] ?? "").slice(0, 34).padEnd(34) + " | [" +
      String(r[ITEM] ?? "") + "]",
  );
}

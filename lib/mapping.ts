// Master list of the 44 template columns (in required order)
// ← ตรงกับ asset-template.xlsx ทุกคอลัมน์ (col 3 ของจริงคือ "รหัสสินทรัพย์" ไม่ใช่ "สินทรัพย์")
export const TEMPLATE_COLUMNS: string[] = [
  "RFID/QR CODE",
  "รหัสสินทรัพย์ Elaas",
  "รหัสสินทรัพย์",
  "รหัสสินทรัพย์ (ส่วนประกอบ)",
  "ชื่อสินทรัพย์",
  "รายละเอียด",
  "ระบุอื่น ๆ",
  "ประเภทสินทรัพย์",
  "ชนิดสินทรัพย์",
  "รายการสินทรัพย์",
  "หน่วยนับ",
  "อาคาร",
  "ห้อง",
  "ได้มาโดย",
  "ได้มาจาก",
  "แหล่งงบประมาณ",
  "มูลค่า",
  "วันที่ได้รับ",
  "วันที่ได้รับโอน",
  "วันที่ออกจำหน่าย",
  "วันที่เริ่มรับประกัน",
  "วันที่หมดประกัน",
  "อายุการรับประกัน",
  "อายุการใช้งาน",
  "ผู้ถือครอง",
  "สำนัก",
  "ฝ่าย",
  "งาน",
  "งานที่รับผิดชอบ",
  "สถานะ",
  "ต้องตรวจนับ",
  "คิดค่าเสื่อม",
  "ของสำคัญ",
  "ค่าเสื่อมสะสมยกมา",
  "ณ วันที่ (ค่าเสื่อมยกมา)",
  "ส่งคืนสินทรัพย์",
  "เงินงบประมาณ",
  "เงินสะสม/เงินทุนสำรองเงินสะสม",
  "เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ",
  "เงินรับฝาก",
  "รับโอน/รับบริจาค",
  "เงินกู้",
  "รายได้สะสม",
  "ทุนดำเนินการ",
];

// ---------------------------------------------------------------------------
// ALIASES — เพิ่มคำพ้องที่พบในไฟล์ต้นทางจริง (ครุภัณฑ์สำนักปลัดเทศบาล67)
// ไฟล์มี 2 รูปแบบหัวตาราง:
//   Pattern A (ครุภัณฑ์ใหม่2567, ต่ำกว่าเกณฑ์): row เดียว ชื่อคอลัมน์มี * นำหน้า
//   Pattern B (สำนักงาน, ยานพาหนะ ฯลฯ):  2 rows: row3="รายการ/รหัสครุภัณฑ์/..." row4=sub-header
// ---------------------------------------------------------------------------
const ALIASES: Record<string, string[]> = {
  "RFID/QR CODE": [
    "rfid",
    "qr code",
    "qrcode",
    "rfid/qr",
    "บาร์โค้ด",
    "บาร์โค๊ด",
  ],

  "รหัสสินทรัพย์ Elaas": [
    "รหัส elaas",
    "elaas",
    "รหัสสินทรัพย์(elaas)",
    "เลขครุภัณฑ์ elaas",
  ],

  รหัสสินทรัพย์: [
    "asset code",
    "asset id",
    "รหัสครุภัณฑ์",
    "รหัสพัสดุ",
    "เลขครุภัณฑ์",
    // Pattern A  — "รหัสสินทรัพย์" อาจตรงกันตรงๆ แต่เผื่อมี suffix
    "รหัสสินทรัพย์2",
  ],

  "รหัสสินทรัพย์ (ส่วนประกอบ)": [
    "รหัสสินทรัพย์ส่วนประกอบ",
    "รหัสครุภัณฑ์ย่อย",
    "รหัสส่วนประกอบ",
  ],

  ชื่อสินทรัพย์: [
    "sourceAssetName",
    "ชื่อครุภัณฑ์",
    "asset name",
    "ชื่อทรัพย์สิน",
  ],

  รายละเอียด: [
    "description",
    "spec",
    "สเปค",
    "รายการ",
    // Pattern A
    "รายละเอียดสินทรัพย์",
    "รายละเอียดครุภัณฑ์",
  ],

  "ระบุอื่น ๆ": ["ระบุอื่นๆ", "อื่นๆ", "other", "หมายเหตุอื่นๆ", "หมายเหตุ"],

  ประเภทสินทรัพย์: ["asset type", "ประเภท", "ประเภทครุภัณฑ์"],

  ชนิดสินทรัพย์: [
    "sourceAssetType",
    "asset category",
    "ชนิด",
    "หมวดสินทรัพย์",
    // Pattern A — "*ชนิดสินทรัพย์" (มี * นำหน้า)
    "*ชนิดสินทรัพย์",
    "ชนิดครุภัณฑ์",
    "หมวดครุภัณฑ์",
  ],

  รายการสินทรัพย์: ["asset item"],

  หน่วยนับ: ["unit", "หน่วย"],

  อาคาร: [
    "building",
    "ตึก",
    // Pattern A
    "สถานที่ตั้ง",
    // Pattern B sub-header row
    "สถานที่ใช้งาน",
    "หน่วยงาน",
  ],

  ห้อง: ["room", "ห้องที่ตั้ง"],

  ได้มาโดย: [
    "acquired by",
    "วิธีได้มา",
    // Pattern A — "*ได้มาโดย"
    "*ได้มาโดย",
  ],

  ได้มาจาก: ["acquired from", "ผู้ขาย", "supplier", "ได้มาจาก"],

  แหล่งงบประมาณ: [
    "budget source",
    "งบประมาณ",
    // โอน2567 มีคอลัมน์ "แหล่งที่มา"
    "แหล่งที่มา",
  ],

  มูลค่า: [
    "value",
    "ราคา",
    "มูลค่าสินทรัพย์",
    "amount",
    // Pattern A
    "*ราคาสินทรัพย์ (ราคาทุน) (บาท)",
    "ราคาสินทรัพย์",
    "ราคาทุน",
    // Pattern B
    "ราคาที่ได้มา",
  ],

  วันที่ได้รับ: [
    "received date",
    "วันรับ",
    // Pattern A — "*วันที่ได้มา\n(วว/ดด/ปปปป)"  (merged 3 sub-cols วัน/เดือน/ปี)
    "*วันที่ได้มา",
    "วันที่ได้มา",
    "วันที่ได้มา(วว/ดด/ปปปป)",
    // Pattern B header row3
    "วัน เดือน ปี",
    "วันเดือนปี",
  ],

  วันที่ได้รับโอน: ["transfer date", "วันโอน", "วัน เดือน ปีที่โอน"],
  วันที่ออกจำหน่าย: ["disposal date", "วันจำหน่าย"],
  วันที่เริ่มรับประกัน: ["warranty start", "วันเริ่มประกัน"],
  วันที่หมดประกัน: ["warranty end", "วันหมดประกัน", "วันสิ้นสุดประกัน"],
  อายุการรับประกัน: ["warranty period", "ระยะเวลาประกัน"],
  อายุการใช้งาน: ["useful life", "อายุใช้งาน"],

  ผู้ถือครอง: ["holder", "ผู้ครอบครอง", "ผู้ดูแล"],

  สำนัก: ["office", "สำนักงาน"],
  ฝ่าย: ["division", "department"],
  งาน: [],

  งานที่รับผิดชอบ: [
    "responsible unit",
    "ผู้รับผิดชอบ",
    // Pattern A มีตรงๆ
    "งานที่รับผิดชอบ",
  ],

  สถานะ: ["status", "สภาพ", "สภาพครุภัณฑ์"],

  ต้องตรวจนับ: ["need count", "ตรวจนับ"],
  คิดค่าเสื่อม: ["depreciation flag", "ค่าเสื่อม"],
  ของสำคัญ: ["important item", "สำคัญ"],
  ค่าเสื่อมสะสมยกมา: [
    "accumulated depreciation brought forward",
    "ค่าเสื่อมยกมา",
  ],
  "ณ วันที่ (ค่าเสื่อมยกมา)": ["as of date", "ณ วันที่"],
  ส่งคืนสินทรัพย์: ["return asset", "คืนสินทรัพย์"],

  เงินงบประมาณ: ["budget fund", "เงินงบ"],
  "เงินสะสม/เงินทุนสำรองเงินสะสม": ["เงินสะสม", "เงินทุนสำรองเงินสะสม"],
  "เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ": ["เงินอุดหนุน", "เฉพาะกิจ"],
  เงินรับฝาก: ["deposit fund"],
  "รับโอน/รับบริจาค": ["รับโอน", "รับบริจาค", "donation"],
  เงินกู้: ["loan fund"],
  รายได้สะสม: ["accumulated income"],
  ทุนดำเนินการ: ["operating capital"],
};

function normalizeText(s: string): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\*/g, "") // ลบ * นำหน้า (Pattern A)
    .replace(/\n/g, "") // ลบ newline ในหัวตาราง
    .replace(/\s+/g, "")
    .replace(/[()/.\-_,]/g, "");
}

// ส่งออก keyword ทั้งหมด (template + aliases) เพื่อใช้ใน detectHeaderRow ใน excel.ts
export function getAllKeywords(): string[] {
  const all = new Set<string>();
  for (const col of TEMPLATE_COLUMNS) {
    const n = normalizeText(col);
    if (n.length >= 3) all.add(n);
    for (const alias of ALIASES[col] || []) {
      const na = normalizeText(alias);
      if (na.length >= 3) all.add(na);
    }
  }
  return Array.from(all);
}

// Simple Levenshtein distance for fuzzy fallback matching
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

export interface MappingSuggestion {
  templateColumn: string;
  sourceColumn: string | null;
  confidence: number; // 0-100
  method: "exact" | "alias" | "fuzzy" | "none";
}

// Build a lookup of normalized template/alias strings -> template column
const EXACT_ONLY_TEMPLATE_COLUMNS = new Set([
  "รหัสสินทรัพย์ Elaas",
  "รหัสสินทรัพย์ (ส่วนประกอบ)",
  "ชื่อสินทรัพย์",
  "งาน",
]);

const LOOKUP: Map<string, string> = new Map();
for (const col of TEMPLATE_COLUMNS) {
  LOOKUP.set(normalizeText(col), col);
  for (const alias of ALIASES[col] || []) {
    LOOKUP.set(normalizeText(alias), col);
  }
}

export function suggestMapping(sourceHeaders: string[]): MappingSuggestion[] {
  const usedSources = new Set<string>();
  const results: MappingSuggestion[] = [];

  for (const templateCol of TEMPLATE_COLUMNS) {
    let best: MappingSuggestion = {
      templateColumn: templateCol,
      sourceColumn: null,
      confidence: 0,
      method: "none",
    };

    const candidates = [
      normalizeText(templateCol),
      ...(ALIASES[templateCol] || []).map(normalizeText),
    ];

    for (const src of sourceHeaders) {
      if (usedSources.has(src)) continue;
      const normSrc = normalizeText(src);
      if (!normSrc) continue;

      // exact match
      if (candidates.includes(normSrc)) {
        best = {
          templateColumn: templateCol,
          sourceColumn: src,
          confidence: 100,
          method: "exact",
        };
        break;
      }
      // substring match
      const isSyntheticGroupSource = src === "sourceAssetName" || src === "sourceAssetType";
      const allowsPartialMatch = !EXACT_ONLY_TEMPLATE_COLUMNS.has(templateCol);
      const containsMatch =
        !isSyntheticGroupSource &&
        allowsPartialMatch &&
        candidates.some(
          (c) => c.length >= 3 && normSrc.length >= 3 && normSrc.includes(c),
        );
      if (containsMatch && best.confidence < 85) {
        best = {
          templateColumn: templateCol,
          sourceColumn: src,
          confidence: 85,
          method: "alias",
        };
        continue;
      }
      // fuzzy match via levenshtein
      const dist = levenshtein(normSrc, normalizeText(templateCol));
      const maxLen = Math.max(normSrc.length, templateCol.length, 1);
      const ratio = 1 - dist / maxLen;
      const score = Math.round(ratio * 100);
      if (!isSyntheticGroupSource && allowsPartialMatch && score > 60 && score > best.confidence) {
        best = {
          templateColumn: templateCol,
          sourceColumn: src,
          confidence: score,
          method: "fuzzy",
        };
      }
    }

    if (best.sourceColumn) usedSources.add(best.sourceColumn);
    results.push(best);
  }

  return results;
}

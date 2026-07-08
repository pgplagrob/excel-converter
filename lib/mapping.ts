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

export const COLUMN_ALIASES: Record<string, string[]> = {
  "RFID/QR CODE": ["rfid", "qr code", "qrcode", "บาร์โค้ด"],
  "รหัสสินทรัพย์ Elaas": ["รหัส elaas", "elaas"],
  "รหัสสินทรัพย์": [
    "รหัสสินทรัพย์",
    "asset code",
    "asset id",
    "รหัสครุภัณฑ์",
    "รหัสพัสดุ",
    "เลขครุภัณฑ์",
  ],
  "รหัสสินทรัพย์ (ส่วนประกอบ)": ["รหัสส่วนประกอบ", "รหัสครุภัณฑ์ย่อย"],
  "ชื่อสินทรัพย์": ["asset name", "ชื่อครุภัณฑ์", "ชื่อทรัพย์สิน", "รายการ","ModelName"],
  "รายละเอียด": ["description", "spec", "รายละเอียดสินทรัพย์", "รายละเอียดครุภัณฑ์", "รายการครุภัณฑ์"],
  "ระบุอื่น ๆ": ["หมายเหตุ", "อื่นๆ", "อื่น ๆ", "รายละเอียดเพิ่มเติม"],
  "ประเภทสินทรัพย์": ["asset type", "ประเภท", "ประเภทครุภัณฑ์"],
  "ชนิดสินทรัพย์": ["asset category", "ชนิด", "หมวดครุภัณฑ์", "ชนิดครุภัณฑ์"],
  "รายการสินทรัพย์": ["asset item", "รายการสินทรัพย์", "หมวดรายการ"],
  "หน่วยนับ": ["unit", "หน่วย"],
  "อาคาร": ["building", "สถานที่ตั้ง", "สถานที่ใช้งาน", "หน่วยงาน"],
  "ห้อง": ["room", "ห้องที่ตั้ง"],
  "ได้มาโดย": ["acquired by", "วิธีได้มา", "ได้มาโดย", "ซื้อ/จ้าง"],
  "ได้มาจาก": ["acquired from", "ผู้ขาย", "supplier", "ได้มาจาก", "โอนให้"],
  "แหล่งงบประมาณ": ["budget source", "งบประมาณ", "แหล่งที่มา"],
  "มูลค่า": ["value", "ราคา", "ราคาที่ได้มา", "ราคาทุน", "มูลค่าสินทรัพย์", "ราคาสินทรัพย์", "จำนวนเงิน"],
  "วันที่ได้รับ": ["received date", "วัน เดือน ปี", "วันที่ได้มา", "วันที่ได้รับ", "วันเดือนปีที่ได้มา"],
  "วันที่ได้รับโอน": ["transfer date", "วันโอน", "วันที่โอน"],
  "วันที่ออกจำหน่าย": ["disposal date", "วันจำหน่าย"],
  "วันที่เริ่มรับประกัน": ["warranty start"],
  "วันที่หมดประกัน": ["warranty end"],
  "อายุการรับประกัน": ["warranty period"],
  "อายุการใช้งาน": ["useful life"],
  "ผู้ถือครอง": ["holder", "ผู้ครอบครอง", "ผู้ดูแล"],
  "สำนัก": ["office", "สำนัก", "หน่วยงาน", "ส่วนราชการ"],
  "ฝ่าย": ["division", "ฝ่าย"],
  "งาน": ["งาน", "งานที่รับผิดชอบ"],
  "งานที่รับผิดชอบ": ["responsible unit", "ผู้รับผิดชอบ", "งานที่รับผิดชอบ"],
  "สถานะ": ["status", "สภาพ", "สภาพครุภัณฑ์", "สถานะสินทรัพย์"],
  "ต้องตรวจนับ": ["need count", "ตรวจนับ"],
  "คิดค่าเสื่อม": ["depreciation flag", "ค่าเสื่อม"],
  "ของสำคัญ": ["important item", "สำคัญ"],
  "ค่าเสื่อมสะสมยกมา": ["accumulated depreciation brought forward"],
  "ณ วันที่ (ค่าเสื่อมยกมา)": ["as of date"],
  "ส่งคืนสินทรัพย์": ["return asset"],
  "เงินงบประมาณ": ["budget fund", "เงินงบ"],
  "เงินสะสม/เงินทุนสำรองเงินสะสม": ["เงินสะสม", "เงินทุนสำรองเงินสะสม"],
  "เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ": ["เงินอุดหนุน", "เฉพาะกิจ"],
  "เงินรับฝาก": ["deposit fund"],
  "รับโอน/รับบริจาค": ["รับโอน", "รับบริจาค", "donation"],
  "เงินกู้": ["loan fund"],
  "รายได้สะสม": ["accumulated income"],
  "ทุนดำเนินการ": ["operating capital"],
};

function normalizeText(s: string): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, "")
    .replace(/[()/.\-_,]/g, "");
}

export function getAllKeywords(): string[] {
  const all = new Set<string>();
  for (const col of TEMPLATE_COLUMNS) {
    const normalizedColumn = normalizeText(col);
    if (normalizedColumn.length >= 3) all.add(normalizedColumn);
    for (const alias of COLUMN_ALIASES[col] || []) {
      const normalizedAlias = normalizeText(alias);
      if (normalizedAlias.length >= 3) all.add(normalizedAlias);
    }
  }
  return Array.from(all);
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

export interface MappingSuggestion {
  templateColumn: string;
  sourceColumn: string | null;
  confidence: MappingConfidence;
  confidenceScore: number;
  status: MappingStatus;
  method: "exact" | "alias" | "fuzzy" | "none";
}

export type MappingConfidence = "high" | "medium" | "low" | "none";
export type MappingStatus = "matched" | "guessed" | "missing" | "manual";
export type TemplateMapping = Record<string, string | null | undefined>;

function confidenceFromScore(score: number): MappingConfidence {
  if (score >= 85) return "high";
  if (score >= 70) return "medium";
  if (score > 0) return "low";
  return "none";
}

function statusFromMethod(method: MappingSuggestion["method"]): MappingStatus {
  if (method === "exact") return "matched";
  if (method === "alias" || method === "fuzzy") return "guessed";
  return "missing";
}

function buildSuggestion(
  templateColumn: string,
  sourceColumn: string | null,
  confidenceScore: number,
  method: MappingSuggestion["method"],
): MappingSuggestion {
  return {
    templateColumn,
    sourceColumn,
    confidence: confidenceFromScore(confidenceScore),
    confidenceScore,
    status: statusFromMethod(method),
    method,
  };
}

const EXACT_ONLY_TEMPLATE_COLUMNS = new Set([
  "รหัสสินทรัพย์ Elaas",
  "รหัสสินทรัพย์ (ส่วนประกอบ)",
  "ชื่อสินทรัพย์",
  "งาน",
]);

const AUTHORITATIVE_TEMPLATE_COLUMNS = new Set([
  "ชื่อสินทรัพย์",
  "รายละเอียด",
  "ชนิดสินทรัพย์",
  "รายการสินทรัพย์",
]);

export function suggestMapping(sourceHeaders: string[]): MappingSuggestion[] {
  const usedSources = new Set<string>();
  const results: MappingSuggestion[] = [];

  for (const templateCol of TEMPLATE_COLUMNS) {
    if (AUTHORITATIVE_TEMPLATE_COLUMNS.has(templateCol)) {
      results.push(buildSuggestion(templateCol, null, 0, "none"));
      continue;
    }

    let best: MappingSuggestion = buildSuggestion(templateCol, null, 0, "none");

    const candidates = [
      normalizeText(templateCol),
      ...(COLUMN_ALIASES[templateCol] || []).map(normalizeText),
    ];

    for (const source of sourceHeaders) {
      if (usedSources.has(source)) continue;
      const normalizedSource = normalizeText(source);
      if (!normalizedSource) continue;

      if (candidates.includes(normalizedSource)) {
        best = buildSuggestion(templateCol, source, 100, "exact");
        break;
      }

      const isInternalSource = source.startsWith("__") || source.startsWith("sourceAsset");
      const allowsPartialMatch = !EXACT_ONLY_TEMPLATE_COLUMNS.has(templateCol);
      const containsMatch =
        !isInternalSource &&
        allowsPartialMatch &&
        candidates.some(
          (candidate) =>
            candidate.length >= 3 &&
            normalizedSource.length >= 3 &&
            (normalizedSource.includes(candidate) || candidate.includes(normalizedSource)),
        );
      if (containsMatch && best.confidenceScore < 85) {
        best = buildSuggestion(templateCol, source, 85, "alias");
        continue;
      }

      const dist = levenshtein(normalizedSource, normalizeText(templateCol));
      const maxLen = Math.max(normalizedSource.length, normalizeText(templateCol).length, 1);
      const score = Math.round((1 - dist / maxLen) * 100);
      if (!isInternalSource && allowsPartialMatch && score > 60 && score > best.confidenceScore) {
        best = buildSuggestion(templateCol, source, score, "fuzzy");
      }
    }

    if (best.sourceColumn) usedSources.add(best.sourceColumn);
    results.push(best);
  }

  return results;
}

export function mergeMapping(
  autoMapping: TemplateMapping,
  manualMapping: TemplateMapping = {},
): TemplateMapping {
  return {
    ...autoMapping,
    ...Object.fromEntries(
      Object.entries(manualMapping).filter(([, sourceColumn]) => sourceColumn !== undefined),
    ),
  };
}

export function mappingSuggestionsToRecord(mapping: MappingSuggestion[]): TemplateMapping {
  return Object.fromEntries(
    mapping.map((item) => [item.templateColumn, item.sourceColumn || ""]),
  );
}

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
  "ชั้น",
  "ห้อง",
  "เลขที่ห้อง",
  "ผู้ถือครอง",
  "สำนัก",
  "ฝ่าย",
  "งาน",
  "งานที่รับผิดชอบ",
  "ได้มาโดย",
  "ได้มาจาก",
  "เงินงบประมาณ",
  "เงินสะสม/เงินทุนสำรองเงินสะสม",
  "เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ",
  "เงินรับฝาก",
  "รับโอน/รับบริจาค",
  "เงินกู้",
  "รายได้สะสม",
  "ทุนดำเนินการ",
  "มูลค่า",
  "ค่าเสื่อมสะสม ณ ยกมา",
  "วันที่ยกมา",
  "อายุการใช้งาน",
  "วันที่ได้รับ",
  "วันที่ได้รับโอน",
  "วันที่ออกจำหน่าย",
  "อายุการรับประกัน",
  "วันที่เริ่มรับประกัน",
  "วันที่หมดประกัน",
  "วันหมดอายุ (ส่วนประกอบ)",
  "License Key (ส่วนประกอบ)",
  "สถานะ",
  "ต้องตรวจนับ",
  "คิดค่าเสื่อม",
  "ดึงอายุจากค่ากลาง",
  "ของสำคัญ",
  "ส่งคืนสินทรัพย์",
  "ละติจูด",
  "ลองจิจูด",
  "หมายเลขเครื่อง (S/N)",
  "ยี่ห้อ",
  "พกพาได้",
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
  "ชื่อสินทรัพย์": ["asset name", "ชื่อครุภัณฑ์", "ชื่อทรัพย์สิน", "รายการ", "ModelName"],
  "รายละเอียด": [
    "description",
    "spec",
    "รายละเอียดสินทรัพย์",
    "รายละเอียดครุภัณฑ์",
    "รายการครุภัณฑ์",
  ],
  "ระบุอื่น ๆ": ["หมายเหตุ", "อื่นๆ", "อื่น ๆ", "รายละเอียดเพิ่มเติม"],
  "ประเภทสินทรัพย์": ["asset type", "ประเภท", "ประเภทครุภัณฑ์"],
  "ชนิดสินทรัพย์": [
    "asset category",
    "ชนิด",
    "หมวดครุภัณฑ์",
    "ชนิดครุภัณฑ์",
    "AssetTypeName",
  ],
  "รายการสินทรัพย์": ["asset item", "รายการสินทรัพย์", "หมวดรายการ"],
  "หน่วยนับ": ["unit", "หน่วย"],
  "อาคาร": ["building", "สถานที่ตั้ง", "สถานที่ใช้งาน", "LocationName"],
  "ชั้น": ["floor", "ชั้นที่"],
  "ห้อง": ["room", "ชื่อห้อง", "ห้องที่ตั้ง"],
  "เลขที่ห้อง": ["room number", "เลขห้อง", "หมายเลขห้อง"],
  "ได้มาโดย": ["acquired by", "วิธีได้มา", "ได้มาโดย", "ซื้อ/จ้าง"],
  "ได้มาจาก": ["acquired from", "ผู้ขาย", "supplier", "ได้มาจาก", "โอนให้"],
  "มูลค่า": [
    "value",
    "ราคา",
    "ราคาที่ได้มา",
    "ราคาทุน",
    "มูลค่าสินทรัพย์",
    "ราคาสินทรัพย์",
    "จำนวนเงิน",
    "Cost",
    "PurchasePrice",
  ],
  "วันที่ได้รับ": [
    "received date",
    "วัน เดือน ปี",
    "วันที่ได้มา",
    "วันที่ได้รับ",
    "วันเดือนปีที่ได้มา",
    "PurchaseDate",
  ],
  "วันที่ได้รับโอน": ["transfer date", "วันโอน", "วันที่โอน"],
  "วันที่ออกจำหน่าย": ["disposal date", "วันจำหน่าย"],
  "วันที่เริ่มรับประกัน": ["warranty start"],
  "วันที่หมดประกัน": ["warranty end"],
  "อายุการรับประกัน": ["warranty period"],
  "วันหมดอายุ (ส่วนประกอบ)": ["component expiration date", "วันหมดอายุส่วนประกอบ"],
  "License Key (ส่วนประกอบ)": ["license key", "license key ส่วนประกอบ"],
  "อายุการใช้งาน": ["useful life"],
  "ผู้ถือครอง": ["holder", "ผู้ครอบครอง", "ผู้ดูแล"],
  "สำนัก": ["office", "สำนัก", "ส่วนราชการ", "DepartmentName"],
  "ฝ่าย": ["division", "ฝ่าย"],
  "งาน": ["งาน", "งานที่รับผิดชอบ"],
  "งานที่รับผิดชอบ": [
    "responsible unit",
    "ผู้รับผิดชอบ",
    "งานที่รับผิดชอบ",
    "ResponsibleUnit",
  ],
  "สถานะ": ["status", "สภาพ", "สภาพครุภัณฑ์", "สถานะสินทรัพย์"],
  "ต้องตรวจนับ": ["need count", "ตรวจนับ"],
  "คิดค่าเสื่อม": ["depreciation flag", "ค่าเสื่อม"],
  "ดึงอายุจากค่ากลาง": ["use reference useful life", "ใช้อายุจากค่ากลาง"],
  "ของสำคัญ": ["important item", "สำคัญ"],
  "ค่าเสื่อมสะสม ณ ยกมา": ["ค่าเสื่อมสะสมยกมา", "accumulated depreciation brought forward"],
  "วันที่ยกมา": ["ณ วันที่ (ค่าเสื่อมยกมา)", "as of date"],
  "ส่งคืนสินทรัพย์": ["return asset"],
  "เงินงบประมาณ": ["budget fund", "เงินงบ"],
  "เงินสะสม/เงินทุนสำรองเงินสะสม": ["เงินสะสม", "เงินทุนสำรองเงินสะสม"],
  "เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ": ["เงินอุดหนุน", "เฉพาะกิจ"],
  "เงินรับฝาก": ["deposit fund"],
  "รับโอน/รับบริจาค": ["รับโอน", "รับบริจาค", "donation"],
  "เงินกู้": ["loan fund"],
  "รายได้สะสม": ["accumulated income"],
  "ทุนดำเนินการ": ["operating capital"],
  "ละติจูด": ["latitude", "lat"],
  "ลองจิจูด": ["longitude", "lng", "lon"],
  "หมายเลขเครื่อง (S/N)": ["serial", "serial number", "serial no", "s/n", "หมายเลขเครื่อง", "เลขเครื่อง"],
  "ยี่ห้อ": ["brand", "brand name", "BrandName"],
  "พกพาได้": ["portable", "พกพา", "เคลื่อนย้ายได้"],
};

export function normalizeText(s: string): string {
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

export interface MappingSuggestion {
  templateColumn: string;
  sourceColumn: string | null;
  confidence: MappingConfidence;
  confidenceScore: number;
  status: MappingStatus;
  method: "exact" | "alias" | "fuzzy" | "profile" | "none";
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
  if (method === "alias" || method === "fuzzy" || method === "profile") return "guessed";
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

export const AUTHORITATIVE_TEMPLATE_COLUMNS = new Set<string>([
  "ชื่อสินทรัพย์",
  "รายละเอียด",
  "ชนิดสินทรัพย์",
  "รายการสินทรัพย์",
]);

const EXACT_SOURCE_OWNERS = new Map<string, Set<string>>();
for (const templateColumn of TEMPLATE_COLUMNS) {
  for (const candidate of [templateColumn, ...(COLUMN_ALIASES[templateColumn] || [])]) {
    const normalizedCandidate = normalizeText(candidate);
    if (!normalizedCandidate) continue;
    const owners = EXACT_SOURCE_OWNERS.get(normalizedCandidate) || new Set<string>();
    owners.add(templateColumn);
    EXACT_SOURCE_OWNERS.set(normalizedCandidate, owners);
  }
}

const EXACT_TEMPLATE_OWNER = new Map(
  TEMPLATE_COLUMNS.map((templateColumn) => [normalizeText(templateColumn), templateColumn]),
);

export function suggestMapping(sourceHeaders: string[]): MappingSuggestion[] {
  const usedSources = new Set<string>();
  const results: MappingSuggestion[] = [];

  for (const templateCol of TEMPLATE_COLUMNS) {
    if (AUTHORITATIVE_TEMPLATE_COLUMNS.has(templateCol)) {
      results.push(buildSuggestion(templateCol, null, 0, "none"));
      continue;
    }

    let best: MappingSuggestion = buildSuggestion(templateCol, null, 0, "none");

    const normalizedTemplate = normalizeText(templateCol);
    const aliases = (COLUMN_ALIASES[templateCol] || []).map(normalizeText);

    for (const source of sourceHeaders) {
      if (usedSources.has(source)) continue;
      const normalizedSource = normalizeText(source);
      if (!normalizedSource) continue;

      if (normalizedSource === normalizedTemplate) {
        best = buildSuggestion(templateCol, source, 100, "exact");
        break;
      }

      // Auto-mapping is deliberately exact.  A source header must equal one
      // explicit alias; containing a word such as "อาคาร" is not enough.
      if (!aliases.includes(normalizedSource)) continue;

      const exactTemplateOwner = EXACT_TEMPLATE_OWNER.get(normalizedSource);
      if (exactTemplateOwner && exactTemplateOwner !== templateCol) continue;

      const exactOwners = EXACT_SOURCE_OWNERS.get(normalizedSource);
      if (!exactOwners?.has(templateCol) || exactOwners.size > 1) continue;

      best = buildSuggestion(templateCol, source, 95, "alias");
      break;
    }

    if (best.sourceColumn) usedSources.add(best.sourceColumn);
    results.push(best);
  }

  return results;
}

export function applyMappingProfile(
  suggestions: MappingSuggestion[],
  sourceHeaders: string[],
  profileMapping: Record<string, string> | undefined,
): MappingSuggestion[] {
  if (!profileMapping || Object.keys(profileMapping).length === 0) return suggestions;

  const rawHeaderByNormalized = new Map<string, string>();
  for (const rawHeader of sourceHeaders) {
    const normalizedHeader = normalizeText(rawHeader);
    if (normalizedHeader && !rawHeaderByNormalized.has(normalizedHeader)) {
      rawHeaderByNormalized.set(normalizedHeader, rawHeader);
    }
  }

  const usedSources = new Set(
    suggestions.flatMap((suggestion) =>
      suggestion.sourceColumn === null ? [] : [suggestion.sourceColumn],
    ),
  );

  return suggestions.map((suggestion) => {
    if (
      suggestion.sourceColumn !== null ||
      AUTHORITATIVE_TEMPLATE_COLUMNS.has(suggestion.templateColumn)
    ) {
      return suggestion;
    }

    const rememberedHeader = profileMapping[suggestion.templateColumn];
    if (!rememberedHeader) return suggestion;

    const rawHeader = rawHeaderByNormalized.get(rememberedHeader);
    if (!rawHeader || usedSources.has(rawHeader)) return suggestion;

    usedSources.add(rawHeader);
    return buildSuggestion(suggestion.templateColumn, rawHeader, 90, "profile");
  });
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

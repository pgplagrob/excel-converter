export type SourceSheetProfile =
  | "registry"
  | "newAsset"
  | "transfer"
  | "disposal"
  | "realEstate"
  | "assetData"
  | "maintenance"
  | "summary"
  | "help"
  | "reference"
  | "form"
  | "template"
  | "empty"
  | "unknown";

export interface SheetProfileDetection {
  profile: SourceSheetProfile;
  headerRowIndex: number | null;
  confidence: number;
  reasons: string[];
}

type ProfileScore = {
  profile: SourceSheetProfile;
  score: number;
  rowIndex: number | null;
  reasons: string[];
};

const REGISTRY_HEADERS = [
  "ลำดับ",
  "รายการ",
  "รหัสครุภัณฑ์",
  "วันเดือนปี",
  "ราคาที่ได้มา",
  "สภาพครุภัณฑ์",
];

const NEW_ASSET_HEADERS = [
  "รหัสสินทรัพย์",
  "ชนิดสินทรัพย์",
  "รายละเอียดสินทรัพย์",
  "ราคาสินทรัพย์",
  "มูลค่าสินทรัพย์",
];

const TRANSFER_HEADERS = [
  "เลขที่หนังสือ",
  "รายการ",
  "หมวดครุภัณฑ์",
  "รหัสครุภัณฑ์",
  "หน่วยงาน",
  "ได้มาจาก",
];

const DISPOSAL_WORDS = [
  "ตัดจำหน่าย",
  "ชำรุด",
  "เสื่อมสภาพ",
  "หมดความจำเป็น",
  "จำหน่าย",
];

const SUMMARY_HEADERS = [
  "ประเภททรัพย์สิน",
  "รหัสพัสดุ",
  "ครุภัณฑ์ต่ำกว่าเกณฑ์",
  "แบบกข",
];

const ASSET_DATA_HEADERS = [
  "AssetCode",
  "ModelName",
  "AssetTypeName",
  "PurchaseDate",
  "PurchasePrice",
  "Price",
  "LocationName",
];

const REAL_ESTATE_HEADERS = [
  "อสังหาริมทรัพย์",
  "ที่ดิน",
  "อาคาร",
  "สิ่งปลูกสร้าง",
  "เลขที่โฉนด",
  "วันที่ได้กรรมสิทธิ์",
  "ราคาประเมิน",
];

const MAINTENANCE_HEADERS = [
  "ซ่อม",
  "บำรุง",
  "maintenance",
  "แจ้งซ่อม",
  "วันที่ซ่อม",
];

function cellText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeText(value: unknown): string {
  return cellText(value)
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, "")
    .replace(/[\(\)\/\.\-_,:;]+/g, "");
}

function normalizedRowText(row: unknown[]): string {
  return row.map(normalizeText).filter(Boolean).join("|");
}

function countTokenMatches(text: string, tokens: string[]): string[] {
  return tokens.filter((token) => text.includes(normalizeText(token)));
}

function rowHasAssetLikeStructure(row: unknown[]): boolean {
  const cells = row.map(cellText);
  return cells.some((cell) => /\d/.test(cell) && /[-/]/.test(cell));
}

function rowHasNumericSequence(row: unknown[]): boolean {
  return row.some((cell) => /^\d+$/.test(normalizeText(cell)));
}

function scoreHeaderProfile(
  rows: unknown[][],
  profile: SourceSheetProfile,
  tokens: string[],
  minimumMatches: number,
): ProfileScore {
  let best: ProfileScore = {
    profile,
    score: 0,
    rowIndex: null,
    reasons: [],
  };

  rows.forEach((row, rowIndex) => {
    const text = normalizedRowText(row);
    const matched = countTokenMatches(text, tokens);
    if (matched.length < minimumMatches) return;

    const structureBonus =
      rowHasAssetLikeStructure(row) || rowHasNumericSequence(row) ? 0.05 : 0;
    const score = Math.min(0.95, matched.length / tokens.length + structureBonus);
    if (score > best.score) {
      best = {
        profile,
        score,
        rowIndex,
        reasons: [`matched headers: ${matched.join(", ")}`],
      };
    }
  });

  return best;
}

function scoreDisposalProfile(rows: unknown[][]): ProfileScore {
  const registryScore = scoreHeaderProfile(rows, "registry", REGISTRY_HEADERS, 3);
  let best: ProfileScore = {
    profile: "disposal",
    score: 0,
    rowIndex: registryScore.rowIndex,
    reasons: [],
  };

  rows.forEach((row, rowIndex) => {
    const text = normalizedRowText(row);
    const matched = countTokenMatches(text, DISPOSAL_WORDS);
    if (!matched.length) return;

    const registryBonus = registryScore.score >= 0.45 ? 0.35 : 0;
    const score = Math.min(0.95, matched.length / DISPOSAL_WORDS.length + registryBonus);
    if (score > best.score) {
      best = {
        profile: "disposal",
        score,
        rowIndex: registryScore.rowIndex ?? rowIndex,
        reasons: [
          `matched disposal words: ${matched.join(", ")}`,
          ...(registryScore.reasons.length ? registryScore.reasons : []),
        ],
      };
    }
  });

  return best;
}

function scoreSummaryProfile(rows: unknown[][], sheetName: string): ProfileScore {
  const summaryScore = scoreHeaderProfile(rows, "summary", SUMMARY_HEADERS, 2);
  const compactSheetName = normalizeText(sheetName);
  const reasons = [...summaryScore.reasons];
  let score = summaryScore.score;
  let rowIndex = summaryScore.rowIndex;

  if (compactSheetName.includes("แบบกข")) {
    score = Math.max(score, 0.9);
    rowIndex = rowIndex ?? null;
    reasons.push("sheet name contains แบบกข");
  }

  const hasSummaryCategoryRows = rows.some((row) => {
    const text = normalizedRowText(row);
    return text.includes("ประเภททรัพย์สิน") && text.includes("รหัสพัสดุ");
  });
  if (hasSummaryCategoryRows) {
    score = Math.max(score, 0.85);
    reasons.push("contains summary-style ประเภททรัพย์สิน/รหัสพัสดุ row");
  }

  return {
    profile: "summary",
    score,
    rowIndex,
    reasons,
  };
}

function scoreNameOnlySkipProfile(sheetName: string, rows: unknown[][]): ProfileScore | null {
  const compactSheetName = normalizeText(sheetName);
  const firstRowsText = rows.slice(0, 8).map(normalizedRowText).join("|");
  const pairs: { profile: SourceSheetProfile; tokens: string[]; score: number }[] = [
    { profile: "help", tokens: ["help", "คู่มือ", "คำอธิบาย", "วิธีใช้"], score: 0.95 },
    { profile: "reference", tokens: ["reference", "อ้างอิง", "lookup"], score: 0.95 },
    { profile: "template", tokens: ["template", "ตัวอย่าง", "แม่แบบ"], score: 0.9 },
    { profile: "form", tokens: ["แบบฟอร์ม", "แบบ กข", "แบบกข"], score: 0.9 },
  ];

  for (const candidate of pairs) {
    const matched = candidate.tokens.filter((token) => {
      const normalized = normalizeText(token);
      return compactSheetName.includes(normalized) || firstRowsText.includes(normalized);
    });
    if (matched.length) {
      return {
        profile: candidate.profile,
        score: candidate.score,
        rowIndex: null,
        reasons: [`matched non-export sheet marker: ${matched.join(", ")}`],
      };
    }
  }

  return null;
}

function scoreRealEstateProfile(rows: unknown[][], sheetName: string): ProfileScore {
  const score = scoreHeaderProfile(rows, "realEstate", REAL_ESTATE_HEADERS, 2);
  const compactSheetName = normalizeText(sheetName);
  const matchedName = ["อสังหาริมทรัพย์", "ที่ดิน", "อาคาร", "สิ่งปลูกสร้าง"].filter((token) =>
    compactSheetName.includes(normalizeText(token)),
  );

  if (matchedName.length && score.score < 0.65) {
    return {
      profile: "realEstate",
      score: Math.max(score.score, 0.65),
      rowIndex: score.rowIndex,
      reasons: [`sheet name suggests real estate: ${matchedName.join(", ")}`, ...score.reasons],
    };
  }

  return score;
}

function confidenceFromScore(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export function detectSheetProfile(
  rows: unknown[][],
  sheetName: string,
): SheetProfileDetection {
  const scanRows = rows.slice(0, Math.min(rows.length, 30));
  const nonEmptyRows = rows.filter((row) => row.some((cell) => Boolean(cellText(cell))));
  if (nonEmptyRows.length < 2) {
    return {
      profile: "empty",
      headerRowIndex: null,
      confidence: 1,
      reasons: ["sheet has fewer than two non-empty rows"],
    };
  }

  const nonExportProfile = scoreNameOnlySkipProfile(sheetName, scanRows);
  if (nonExportProfile) {
    return {
      profile: nonExportProfile.profile,
      headerRowIndex: nonExportProfile.rowIndex,
      confidence: confidenceFromScore(nonExportProfile.score),
      reasons: nonExportProfile.reasons,
    };
  }

  const scores = [
    scoreSummaryProfile(scanRows, sheetName),
    scoreHeaderProfile(scanRows, "assetData", ASSET_DATA_HEADERS, 4),
    scoreRealEstateProfile(scanRows, sheetName),
    scoreHeaderProfile(scanRows, "maintenance", MAINTENANCE_HEADERS, 2),
    scoreDisposalProfile(scanRows),
    scoreHeaderProfile(scanRows, "transfer", TRANSFER_HEADERS, 4),
    scoreHeaderProfile(scanRows, "newAsset", NEW_ASSET_HEADERS, 3),
    scoreHeaderProfile(scanRows, "registry", REGISTRY_HEADERS, 3),
  ].sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (!best || best.score < 0.4) {
    return {
      profile: "unknown",
      headerRowIndex: null,
      confidence: 0,
      reasons: ["no supported sheet profile matched with enough confidence"],
    };
  }

  return {
    profile: best.profile,
    headerRowIndex: best.rowIndex,
    confidence: confidenceFromScore(best.score),
    reasons: best.reasons,
  };
}

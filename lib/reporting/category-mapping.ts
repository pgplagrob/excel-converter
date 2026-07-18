// Exact canonical mapping from a source category/type label to
// (AssetGroup, UsefulLifeCategoryKey). This is the only mapping mechanism —
// no fuzzy matching. Labels come directly from the manual's ch.2
// classification table and ch.3 useful-life table.
//
// Several manual groups do not resolve to a single useful-life category on
// their own (e.g. "ครุภัณฑ์การเกษตร" splits into hand-tools vs machinery,
// "สิ่งปลูกสร้าง" splits by construction material, and the manual gives no
// useful-life table rows at all for investment property / leased-asset
// groups). Those entries carry `assetGroup` but no `usefulLifeCategoryKey`,
// so any depreciable asset in them requires an explicit user-approved
// override before it can be classified — matching "ambiguous mapping must be
// NEEDS_REVIEW, never guessed".

import type { AssetGroup } from "../domain/types";
import type { UsefulLifeCategoryKey } from "../domain/useful-life";
import type { CategoryMappingOverride, CategoryMappingResult, CategoryMappingStatus } from "./types";

export interface CanonicalCategoryEntry {
  labelTh: string;
  assetGroup: AssetGroup;
  usefulLifeCategoryKey?: UsefulLifeCategoryKey;
}

export const CANONICAL_CATEGORY_TABLE: CanonicalCategoryEntry[] = [
  { labelTh: "ที่ดิน", assetGroup: "LAND" },
  { labelTh: "ที่ดินที่มีกรรมสิทธิ์", assetGroup: "LAND" },

  { labelTh: "อาคารสำนักงาน", assetGroup: "BUILDING", usefulLifeCategoryKey: "BUILDING_PERMANENT" },
  { labelTh: "อาคารเพื่อการพักอาศัย", assetGroup: "BUILDING", usefulLifeCategoryKey: "BUILDING_PERMANENT" },
  { labelTh: "อาคารเพื่อประโยชน์อื่น", assetGroup: "BUILDING", usefulLifeCategoryKey: "BUILDING_PERMANENT" },
  { labelTh: "ส่วนปรับปรุงอาคาร", assetGroup: "BUILDING" }, // ambiguous life key

  { labelTh: "สิ่งปลูกสร้าง", assetGroup: "STRUCTURE" }, // ambiguous: concrete/steel vs wood/other

  { labelTh: "ครุภัณฑ์สำนักงาน", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_OFFICE" },
  { labelTh: "ครุภัณฑ์ยานพาหนะและขนส่ง", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_VEHICLE_TRANSPORT" },
  { labelTh: "ครุภัณฑ์ไฟฟ้าและวิทยุ", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_ELECTRIC_RADIO" },
  { labelTh: "เครื่องกำเนิดไฟฟ้า", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_ELECTRIC_GENERATOR" },
  { labelTh: "ครุภัณฑ์โฆษณาและเผยแพร่", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_ADVERTISING" },
  { labelTh: "ครุภัณฑ์การเกษตร", assetGroup: "EQUIPMENT" }, // ambiguous: tools vs machinery
  { labelTh: "ครุภัณฑ์การเกษตร - เครื่องมือและอุปกรณ์", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_AGRI_TOOLS" },
  { labelTh: "ครุภัณฑ์การเกษตร - เครื่องจักรกล", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_AGRI_MACHINE" },
  { labelTh: "ครุภัณฑ์โรงงาน", assetGroup: "EQUIPMENT" }, // ambiguous
  { labelTh: "ครุภัณฑ์โรงงาน - เครื่องมือและอุปกรณ์", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_FACTORY_TOOLS" },
  { labelTh: "ครุภัณฑ์โรงงาน - เครื่องจักรกล", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_FACTORY_MACHINE" },
  { labelTh: "ครุภัณฑ์ก่อสร้าง", assetGroup: "EQUIPMENT" }, // ambiguous
  { labelTh: "ครุภัณฑ์ก่อสร้าง - เครื่องมือและอุปกรณ์", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_CONSTRUCTION_TOOLS" },
  { labelTh: "ครุภัณฑ์ก่อสร้าง - เครื่องจักรกล", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_CONSTRUCTION_MACHINE" },
  { labelTh: "ครุภัณฑ์สำรวจ", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_SURVEY" },
  { labelTh: "ครุภัณฑ์การแพทย์และวิทยาศาสตร์", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_MEDICAL_SCIENCE" },
  { labelTh: "ครุภัณฑ์วิทยาศาสตร์และการแพทย์", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_MEDICAL_SCIENCE" },
  { labelTh: "ครุภัณฑ์คอมพิวเตอร์", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_COMPUTER" },
  { labelTh: "ครุภัณฑ์การศึกษา", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_EDUCATION" },
  { labelTh: "ครุภัณฑ์งานบ้านงานครัว", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_HOUSEHOLD" },
  { labelTh: "ครุภัณฑ์กีฬา", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_SPORTS" },
  { labelTh: "ครุภัณฑ์กีฬา/กายภาพ", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_SPORTS" },
  { labelTh: "ครุภัณฑ์ดนตรี", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_MUSIC" },
  { labelTh: "ครุภัณฑ์ดนตรี/นาฏศิลป์", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_MUSIC" },
  { labelTh: "ครุภัณฑ์อาวุธ", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_WEAPON" },
  { labelTh: "ครุภัณฑ์สนาม", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_FIELD" },
  { labelTh: "ครุภัณฑ์อื่น", assetGroup: "EQUIPMENT", usefulLifeCategoryKey: "EQUIP_OTHER" },

  { labelTh: "ถนน", assetGroup: "INFRASTRUCTURE" }, // ambiguous: concrete vs asphalt
  { labelTh: "ถนนคอนกรีต", assetGroup: "INFRASTRUCTURE", usefulLifeCategoryKey: "INFRA_ROAD_CONCRETE" },
  { labelTh: "ถนนลาดยาง", assetGroup: "INFRASTRUCTURE", usefulLifeCategoryKey: "INFRA_ROAD_ASPHALT" },
  { labelTh: "สะพาน", assetGroup: "INFRASTRUCTURE", usefulLifeCategoryKey: "INFRA_BRIDGE_CONCRETE" },
  { labelTh: "เขื่อน", assetGroup: "INFRASTRUCTURE" }, // ambiguous: earth vs concrete
  { labelTh: "เขื่อนดิน", assetGroup: "INFRASTRUCTURE", usefulLifeCategoryKey: "INFRA_DAM_EARTH" },
  { labelTh: "เขื่อนปูน", assetGroup: "INFRASTRUCTURE", usefulLifeCategoryKey: "INFRA_DAM_CONCRETE" },
  { labelTh: "อ่างเก็บน้ำ", assetGroup: "INFRASTRUCTURE", usefulLifeCategoryKey: "INFRA_RESERVOIR" },
  { labelTh: "สินทรัพย์โครงสร้างพื้นฐานอื่น", assetGroup: "INFRASTRUCTURE" }, // no life-table row

  { labelTh: "โปรแกรมคอมพิวเตอร์", assetGroup: "INTANGIBLE", usefulLifeCategoryKey: "INTANGIBLE" },
  { labelTh: "สินทรัพย์ไม่มีตัวตน", assetGroup: "INTANGIBLE", usefulLifeCategoryKey: "INTANGIBLE" },
  { labelTh: "สินทรัพย์ไม่มีตัวตนอื่น", assetGroup: "INTANGIBLE", usefulLifeCategoryKey: "INTANGIBLE" },

  // Investment property / leased assets: the manual gives no dedicated
  // useful-life rows, so these always require an explicit override.
  { labelTh: "อสังหาริมทรัพย์เพื่อการลงทุน - ที่ดิน", assetGroup: "INVESTMENT_PROPERTY" },
  { labelTh: "อสังหาริมทรัพย์เพื่อการลงทุน - อาคาร", assetGroup: "INVESTMENT_PROPERTY" },
  { labelTh: "อสังหาริมทรัพย์เพื่อการลงทุน - สิ่งปลูกสร้าง", assetGroup: "INVESTMENT_PROPERTY" },
  { labelTh: "อสังหาริมทรัพย์เพื่อการลงทุน - อื่น", assetGroup: "INVESTMENT_PROPERTY" },
  { labelTh: "สินทรัพย์ - ภายใต้สัญญาเช่าการเงิน", assetGroup: "LEASED_ASSET" },
];

export function normalizeCategoryKey(value: string): string {
  return (value || "").toString().trim().replace(/\s+/g, " ");
}

const CANONICAL_INDEX = new Map<string, CanonicalCategoryEntry>(
  CANONICAL_CATEGORY_TABLE.map((entry) => [normalizeCategoryKey(entry.labelTh), entry]),
);

export function buildOverrideIndex(
  overrides: CategoryMappingOverride[],
): Map<string, CategoryMappingOverride> {
  const index = new Map<string, CategoryMappingOverride>();
  for (const override of overrides) {
    index.set(normalizeCategoryKey(override.sourceValue), override);
  }
  return index;
}

/**
 * Resolve a source category/type label to a canonical AssetGroup and, when
 * determinable, a UsefulLifeCategoryKey. `occurrences` lets callers report
 * grouped counts (used for the batch-approval workflow) without a second pass.
 */
export function resolveCategoryMapping(
  sourceValue: string,
  overrideIndex: Map<string, CategoryMappingOverride>,
  occurrences = 1,
): CategoryMappingResult {
  const normalizedKey = normalizeCategoryKey(sourceValue);

  const override = overrideIndex.get(normalizedKey);
  if (override) {
    return {
      sourceValue,
      normalizedKey,
      status: "override",
      assetGroup: override.assetGroup,
      usefulLifeCategoryKey: override.usefulLifeCategoryKey,
      occurrences,
    };
  }

  const canonical = CANONICAL_INDEX.get(normalizedKey);
  if (canonical && (canonical.assetGroup === "LAND" || canonical.usefulLifeCategoryKey)) {
    return {
      sourceValue,
      normalizedKey,
      status: "canonical",
      assetGroup: canonical.assetGroup,
      usefulLifeCategoryKey: canonical.usefulLifeCategoryKey,
      canonicalLabelTh: canonical.labelTh,
      occurrences,
    };
  }

  const status: CategoryMappingStatus = "unresolved";
  return {
    sourceValue,
    normalizedKey,
    status,
    // A canonical group may still be known even when the life-key is
    // ambiguous; surface it so the UI can narrow the override choices.
    assetGroup: canonical?.assetGroup,
    canonicalLabelTh: canonical?.labelTh,
    occurrences,
  };
}

/** Group raw source category values with their occurrence counts (for batch UI). */
export function countCategoryOccurrences(values: (string | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = (raw || "").toString().trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

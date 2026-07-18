// Useful-life and annual depreciation-rate table (manual ch.3, pp.14-15).
//
// This is the manual's *depreciation* taxonomy (leaf rows expanded).  It does
// NOT map 1:1 to the ch.2 classification groups (AssetGroup): e.g. "อาคาร"
// splits into permanent vs temporary here, and agri/factory/construction
// equipment each split into hand-tools vs machinery.  Mapping a source asset
// to one of these keys is a separate policy (Phase 1 open decision #3) and is
// therefore an input (`usefulLifeCategoryKey`), never guessed here.

import { REASON, type ReasonCode } from "./reason-codes";
import type { ReportingPolicy } from "./types";

export type UsefulLifeCategoryKey =
  | "BUILDING_PERMANENT"
  | "BUILDING_TEMPORARY"
  | "STRUCTURE_CONCRETE_STEEL"
  | "STRUCTURE_WOOD_OTHER"
  | "EQUIP_OFFICE"
  | "EQUIP_VEHICLE_TRANSPORT"
  | "EQUIP_ELECTRIC_RADIO"
  | "EQUIP_ELECTRIC_GENERATOR"
  | "EQUIP_ADVERTISING"
  | "EQUIP_AGRI_TOOLS"
  | "EQUIP_AGRI_MACHINE"
  | "EQUIP_FACTORY_TOOLS"
  | "EQUIP_FACTORY_MACHINE"
  | "EQUIP_CONSTRUCTION_TOOLS"
  | "EQUIP_CONSTRUCTION_MACHINE"
  | "EQUIP_SURVEY"
  | "EQUIP_MEDICAL_SCIENCE"
  | "EQUIP_COMPUTER"
  | "EQUIP_EDUCATION"
  | "EQUIP_HOUSEHOLD"
  | "EQUIP_SPORTS"
  | "EQUIP_MUSIC"
  | "EQUIP_WEAPON"
  | "EQUIP_FIELD"
  | "EQUIP_OTHER"
  | "INFRA_ROAD_CONCRETE"
  | "INFRA_ROAD_ASPHALT"
  | "INFRA_BRIDGE_CONCRETE"
  | "INFRA_DAM_EARTH"
  | "INFRA_DAM_CONCRETE"
  | "INFRA_RESERVOIR"
  | "INTANGIBLE";

export interface UsefulLifeRow {
  key: UsefulLifeCategoryKey;
  labelTh: string;
  minYears: number;
  maxYears: number;
  minRatePct: number;
  maxRatePct: number;
  note?: string;
}

export const USEFUL_LIFE_TABLE: Record<UsefulLifeCategoryKey, UsefulLifeRow> = {
  BUILDING_PERMANENT: { key: "BUILDING_PERMANENT", labelTh: "อาคารถาวร", minYears: 15, maxYears: 40, minRatePct: 2.5, maxRatePct: 6.5 },
  BUILDING_TEMPORARY: { key: "BUILDING_TEMPORARY", labelTh: "อาคารชั่วคราว/โรงเรือน", minYears: 8, maxYears: 15, minRatePct: 6.5, maxRatePct: 12.5 },
  STRUCTURE_CONCRETE_STEEL: { key: "STRUCTURE_CONCRETE_STEEL", labelTh: "สิ่งก่อสร้าง (คอนกรีตเสริมเหล็ก/โครงเหล็ก)", minYears: 15, maxYears: 25, minRatePct: 4, maxRatePct: 6.5 },
  STRUCTURE_WOOD_OTHER: { key: "STRUCTURE_WOOD_OTHER", labelTh: "สิ่งก่อสร้าง (ไม้/วัสดุอื่น)", minYears: 5, maxYears: 15, minRatePct: 6.5, maxRatePct: 20 },
  EQUIP_OFFICE: { key: "EQUIP_OFFICE", labelTh: "ครุภัณฑ์สำนักงาน", minYears: 3, maxYears: 12, minRatePct: 8, maxRatePct: 33 },
  EQUIP_VEHICLE_TRANSPORT: { key: "EQUIP_VEHICLE_TRANSPORT", labelTh: "ครุภัณฑ์ยานพาหนะและขนส่ง", minYears: 5, maxYears: 30, minRatePct: 3, maxRatePct: 20 },
  EQUIP_ELECTRIC_RADIO: { key: "EQUIP_ELECTRIC_RADIO", labelTh: "ครุภัณฑ์ไฟฟ้าและวิทยุ (ยกเว้นเครื่องกำเนิดไฟฟ้า)", minYears: 5, maxYears: 10, minRatePct: 10, maxRatePct: 20, note: "เครื่องกำเนิดไฟฟ้าใช้ key EQUIP_ELECTRIC_GENERATOR (15-20 ปี)" },
  EQUIP_ELECTRIC_GENERATOR: { key: "EQUIP_ELECTRIC_GENERATOR", labelTh: "เครื่องกำเนิดไฟฟ้า", minYears: 15, maxYears: 20, minRatePct: 5, maxRatePct: 6.67, note: "คู่มือระบุเฉพาะอายุ 15-20 ปี (ยกเว้นจากครุภัณฑ์ไฟฟ้าและวิทยุ); อัตราแสดงเป็นส่วนกลับของอายุ" },
  EQUIP_ADVERTISING: { key: "EQUIP_ADVERTISING", labelTh: "ครุภัณฑ์โฆษณาและเผยแพร่", minYears: 5, maxYears: 10, minRatePct: 10, maxRatePct: 20 },
  EQUIP_AGRI_TOOLS: { key: "EQUIP_AGRI_TOOLS", labelTh: "ครุภัณฑ์การเกษตร - เครื่องมือและอุปกรณ์", minYears: 2, maxYears: 5, minRatePct: 20, maxRatePct: 50 },
  EQUIP_AGRI_MACHINE: { key: "EQUIP_AGRI_MACHINE", labelTh: "ครุภัณฑ์การเกษตร - เครื่องจักรกล", minYears: 3, maxYears: 10, minRatePct: 10, maxRatePct: 33 },
  EQUIP_FACTORY_TOOLS: { key: "EQUIP_FACTORY_TOOLS", labelTh: "ครุภัณฑ์โรงงาน - เครื่องมือและอุปกรณ์", minYears: 2, maxYears: 5, minRatePct: 20, maxRatePct: 50 },
  EQUIP_FACTORY_MACHINE: { key: "EQUIP_FACTORY_MACHINE", labelTh: "ครุภัณฑ์โรงงาน - เครื่องจักรกล", minYears: 3, maxYears: 10, minRatePct: 10, maxRatePct: 33 },
  EQUIP_CONSTRUCTION_TOOLS: { key: "EQUIP_CONSTRUCTION_TOOLS", labelTh: "ครุภัณฑ์ก่อสร้าง - เครื่องมือและอุปกรณ์", minYears: 2, maxYears: 5, minRatePct: 20, maxRatePct: 50 },
  EQUIP_CONSTRUCTION_MACHINE: { key: "EQUIP_CONSTRUCTION_MACHINE", labelTh: "ครุภัณฑ์ก่อสร้าง - เครื่องจักรกล", minYears: 3, maxYears: 10, minRatePct: 10, maxRatePct: 33 },
  EQUIP_SURVEY: { key: "EQUIP_SURVEY", labelTh: "ครุภัณฑ์สำรวจ", minYears: 5, maxYears: 10, minRatePct: 10, maxRatePct: 20 },
  EQUIP_MEDICAL_SCIENCE: { key: "EQUIP_MEDICAL_SCIENCE", labelTh: "ครุภัณฑ์การแพทย์และวิทยาศาสตร์", minYears: 5, maxYears: 15, minRatePct: 6.5, maxRatePct: 20 },
  EQUIP_COMPUTER: { key: "EQUIP_COMPUTER", labelTh: "ครุภัณฑ์คอมพิวเตอร์", minYears: 3, maxYears: 5, minRatePct: 20, maxRatePct: 33 },
  EQUIP_EDUCATION: { key: "EQUIP_EDUCATION", labelTh: "ครุภัณฑ์การศึกษา", minYears: 2, maxYears: 5, minRatePct: 20, maxRatePct: 50 },
  EQUIP_HOUSEHOLD: { key: "EQUIP_HOUSEHOLD", labelTh: "ครุภัณฑ์งานบ้านงานครัว", minYears: 2, maxYears: 5, minRatePct: 20, maxRatePct: 50 },
  EQUIP_SPORTS: { key: "EQUIP_SPORTS", labelTh: "ครุภัณฑ์กีฬา/กายภาพ", minYears: 2, maxYears: 5, minRatePct: 20, maxRatePct: 50 },
  EQUIP_MUSIC: { key: "EQUIP_MUSIC", labelTh: "ครุภัณฑ์ดนตรี/นาฏศิลป์", minYears: 2, maxYears: 5, minRatePct: 20, maxRatePct: 50 },
  EQUIP_WEAPON: { key: "EQUIP_WEAPON", labelTh: "ครุภัณฑ์อาวุธ", minYears: 5, maxYears: 10, minRatePct: 10, maxRatePct: 20 },
  EQUIP_FIELD: { key: "EQUIP_FIELD", labelTh: "ครุภัณฑ์สนาม", minYears: 2, maxYears: 5, minRatePct: 20, maxRatePct: 50 },
  EQUIP_OTHER: { key: "EQUIP_OTHER", labelTh: "ครุภัณฑ์อื่น", minYears: 2, maxYears: 15, minRatePct: 6.5, maxRatePct: 50 },
  INFRA_ROAD_CONCRETE: { key: "INFRA_ROAD_CONCRETE", labelTh: "ถนนคอนกรีต", minYears: 10, maxYears: 20, minRatePct: 5, maxRatePct: 10 },
  INFRA_ROAD_ASPHALT: { key: "INFRA_ROAD_ASPHALT", labelTh: "ถนนลาดยาง", minYears: 3, maxYears: 10, minRatePct: 10, maxRatePct: 33 },
  INFRA_BRIDGE_CONCRETE: { key: "INFRA_BRIDGE_CONCRETE", labelTh: "สะพานคอนกรีตเสริมเหล็ก", minYears: 20, maxYears: 50, minRatePct: 2, maxRatePct: 5 },
  INFRA_DAM_EARTH: { key: "INFRA_DAM_EARTH", labelTh: "เขื่อนดิน", minYears: 20, maxYears: 50, minRatePct: 2, maxRatePct: 5 },
  INFRA_DAM_CONCRETE: { key: "INFRA_DAM_CONCRETE", labelTh: "เขื่อนปูน", minYears: 50, maxYears: 80, minRatePct: 1.25, maxRatePct: 2 },
  INFRA_RESERVOIR: { key: "INFRA_RESERVOIR", labelTh: "อ่างเก็บน้ำ", minYears: 30, maxYears: 80, minRatePct: 1.25, maxRatePct: 3 },
  INTANGIBLE: { key: "INTANGIBLE", labelTh: "สินทรัพย์ไม่มีตัวตน", minYears: 2, maxYears: 20, minRatePct: 5, maxRatePct: 50 },
};

export type UsefulLifeSelection =
  | { ok: true; years: number; rangeMin: number; rangeMax: number }
  | { ok: false; blocking: ReasonCode };

/**
 * Resolve the useful-life (years) for a category key under the given policy.
 * Never picks a mid-point or a silent default: an explicit-per-category policy
 * with no override for the key blocks, and an out-of-range override blocks.
 */
export function selectUsefulLifeYears(
  key: UsefulLifeCategoryKey,
  policy: ReportingPolicy,
): UsefulLifeSelection {
  const row = USEFUL_LIFE_TABLE[key];
  if (!row) return { ok: false, blocking: REASON.AMBIGUOUS_USEFUL_LIFE_CATEGORY };

  const override = policy.usefulLifeOverridesByCategory[key];
  if (override) {
    if (override.years < row.minYears || override.years > row.maxYears) {
      return { ok: false, blocking: REASON.USEFUL_LIFE_OUT_OF_RANGE };
    }
    return { ok: true, years: override.years, rangeMin: row.minYears, rangeMax: row.maxYears };
  }

  switch (policy.usefulLifeSelectionPolicy) {
    case "minimum":
      return { ok: true, years: row.minYears, rangeMin: row.minYears, rangeMax: row.maxYears };
    case "maximum":
      return { ok: true, years: row.maxYears, rangeMin: row.minYears, rangeMax: row.maxYears };
    case "explicit-per-category":
    default:
      return { ok: false, blocking: REASON.NO_USEFUL_LIFE_POLICY };
  }
}

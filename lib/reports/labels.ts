// Thai display labels for report building. Kept separate from
// lib/domain (which is pure and English-keyed) and lib/reporting (adapters).

import type { AssetGroup } from "../domain/types";
import { REASON_EXPLANATION_TH, type ReasonCode } from "../domain/reason-codes";

/** Group order and labels exactly matching the manual's ch.2 classification table / อปท.-สท.1 form. */
export const ASSET_GROUP_ORDER: AssetGroup[] = [
  "LAND",
  "BUILDING",
  "STRUCTURE",
  "EQUIPMENT",
  "INFRASTRUCTURE",
  "INTANGIBLE",
  "INVESTMENT_PROPERTY",
  "LEASED_ASSET",
];

export const ASSET_GROUP_LABEL_TH: Record<AssetGroup, string> = {
  LAND: "ที่ดิน",
  BUILDING: "อาคาร",
  STRUCTURE: "สิ่งปลูกสร้าง",
  EQUIPMENT: "ครุภัณฑ์",
  INFRASTRUCTURE: "สินทรัพย์โครงสร้างพื้นฐาน",
  INTANGIBLE: "สินทรัพย์ไม่มีตัวตน",
  INVESTMENT_PROPERTY: "อสังหาริมทรัพย์เพื่อการลงทุน",
  LEASED_ASSET: "สินทรัพย์ - ภายใต้สัญญาเช่าการเงิน",
};

export function reasonCodeLabelTh(code: ReasonCode | string): string {
  return REASON_EXPLANATION_TH[code as ReasonCode] || code;
}

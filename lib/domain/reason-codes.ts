// Stable reason codes emitted by the classification and depreciation engines.
//
// Every classification / depreciation result MUST carry at least one reason
// code (prompt sections 11, 12).  Codes are machine-stable identifiers; the
// human-readable Thai explanation is built alongside them.

export const REASON = {
  // --- classification outcomes ---
  IN_SCOPE_SOR_THOR_2: "IN_SCOPE_SOR_THOR_2",
  BELOW_THRESHOLD: "BELOW_THRESHOLD",
  FULLY_DEPRECIATED: "FULLY_DEPRECIATED",
  EQUIPMENT_BEFORE_FY2560: "EQUIPMENT_BEFORE_FY2560",
  LAND_NON_DEPRECIABLE: "LAND_NON_DEPRECIABLE",
  OUT_OF_REPORT_SCOPE: "OUT_OF_REPORT_SCOPE",

  // --- non-depreciation reasons ---
  NON_DEPRECIABLE_BY_RULE: "NON_DEPRECIABLE_BY_RULE",
  NOT_DEPRECIATED_BELOW_THRESHOLD: "NOT_DEPRECIATED_BELOW_THRESHOLD",
  NOT_DEPRECIATED_EQUIPMENT_BEFORE_FY2560: "NOT_DEPRECIATED_EQUIPMENT_BEFORE_FY2560",
  DEPRECIATION_CAPPED_AT_RESIDUAL: "DEPRECIATION_CAPPED_AT_RESIDUAL",

  // --- NEEDS_REVIEW / blocking reasons (missing data or unresolved policy) ---
  MISSING_COST: "MISSING_COST",
  INVALID_COST_NOT_FINITE: "INVALID_COST_NOT_FINITE",
  INVALID_COST_NOT_INTEGER: "INVALID_COST_NOT_INTEGER",
  MISSING_ACQUISITION_DATE: "MISSING_ACQUISITION_DATE",
  INVALID_ACQUISITION_DATE: "INVALID_ACQUISITION_DATE",
  MISSING_ASSET_GROUP: "MISSING_ASSET_GROUP",
  INVALID_RESIDUAL_POLICY: "INVALID_RESIDUAL_POLICY",
  AMBIGUOUS_USEFUL_LIFE_CATEGORY: "AMBIGUOUS_USEFUL_LIFE_CATEGORY",
  NO_USEFUL_LIFE_POLICY: "NO_USEFUL_LIFE_POLICY",
  USEFUL_LIFE_OUT_OF_RANGE: "USEFUL_LIFE_OUT_OF_RANGE",
  DAY15_POLICY_REQUIRED: "DAY15_POLICY_REQUIRED",
  ACQUIRED_AFTER_CUTOFF: "ACQUIRED_AFTER_CUTOFF",
  INVALID_CUTOFF_DATE: "INVALID_CUTOFF_DATE",
  CUTOFF_FISCAL_YEAR_MISMATCH: "CUTOFF_FISCAL_YEAR_MISMATCH",
  LAND_BELOW_THRESHOLD_UNDEFINED: "LAND_BELOW_THRESHOLD_UNDEFINED",
  NEGATIVE_COST: "NEGATIVE_COST",

  // --- source vs calculated / policy consistency (informational) ---
  SOURCE_CALC_DEPRECIATION_VARIANCE: "SOURCE_CALC_DEPRECIATION_VARIANCE",
  SOURCE_USEFUL_LIFE_CONFLICT: "SOURCE_USEFUL_LIFE_CONFLICT",
  SOURCE_RATE_POLICY_CONFLICT: "SOURCE_RATE_POLICY_CONFLICT",
  SOURCE_LIFE_RATE_INTERNAL_CONFLICT: "SOURCE_LIFE_RATE_INTERNAL_CONFLICT",
  SOURCE_ACCUM_NEGATIVE: "SOURCE_ACCUM_NEGATIVE",
  SOURCE_ACCUM_EXCEEDS_COST: "SOURCE_ACCUM_EXCEEDS_COST",
  SOURCE_NBV_INCONSISTENT: "SOURCE_NBV_INCONSISTENT",
  SOURCE_NBV_VS_CALC_VARIANCE: "SOURCE_NBV_VS_CALC_VARIANCE",
} as const;

export type ReasonCode = (typeof REASON)[keyof typeof REASON];

/** Human-readable Thai explanation for each reason code. */
export const REASON_EXPLANATION_TH: Record<ReasonCode, string> = {
  IN_SCOPE_SOR_THOR_2: "ราคาทุนตั้งแต่ 10,000 บาทและยังมีอายุการใช้งานเหลือ จึงเข้ารายงาน อปท.-สท. 2",
  BELOW_THRESHOLD: "ราคาทุนต่ำกว่า 10,000 บาท จึงเข้ารายงาน อปท.-สท. 3",
  FULLY_DEPRECIATED: "หมดอายุการใช้งานอย่างมีประสิทธิภาพแล้ว จึงเข้ารายงาน อปท.-สท. 3",
  EQUIPMENT_BEFORE_FY2560: "ครุภัณฑ์ที่ได้มาก่อนปีงบประมาณ พ.ศ. 2560 จึงเข้ารายงาน อปท.-สท. 3",
  LAND_NON_DEPRECIABLE: "ที่ดินเป็นสินทรัพย์ที่มีอายุการใช้งานไม่จำกัด จึงไม่คิดค่าเสื่อมราคา",
  OUT_OF_REPORT_SCOPE: "ประเภทสินทรัพย์อยู่นอกขอบเขตรายงานตาม policy ที่กำหนด",
  NON_DEPRECIABLE_BY_RULE: "ไม่คิดค่าเสื่อมราคาตามกฎของคู่มือ",
  NOT_DEPRECIATED_BELOW_THRESHOLD: "ไม่คิดค่าเสื่อมราคาเนื่องจากราคาทุนต่ำกว่าเกณฑ์ 10,000 บาท",
  NOT_DEPRECIATED_EQUIPMENT_BEFORE_FY2560:
    "ไม่คิดค่าเสื่อมราคาเนื่องจากเป็นครุภัณฑ์ที่ได้มาก่อนปีงบประมาณ พ.ศ. 2560",
  DEPRECIATION_CAPPED_AT_RESIDUAL: "ค่าเสื่อมสะสมถูกจำกัดไม่ให้เกินราคาทุนหักมูลค่าคงเหลือตามบัญชี",
  MISSING_COST: "ไม่มีข้อมูลราคาทุน จึงต้องตรวจสอบก่อน",
  INVALID_COST_NOT_FINITE: "ราคาทุนไม่ใช่ตัวเลขที่ถูกต้อง (NaN หรือ Infinity)",
  INVALID_COST_NOT_INTEGER: "ราคาทุนไม่ใช่จำนวนเต็มหน่วยสตางค์",
  MISSING_ACQUISITION_DATE: "ไม่มีข้อมูลวันที่ได้มา จึงต้องตรวจสอบก่อน",
  INVALID_ACQUISITION_DATE: "วันที่ได้มาไม่สามารถแปลงเป็นวันที่มาตรฐานได้",
  MISSING_ASSET_GROUP: "ไม่สามารถระบุกลุ่มประเภทสินทรัพย์ได้ จึงต้องตรวจสอบก่อน",
  INVALID_RESIDUAL_POLICY: "มูลค่าคงเหลือตามบัญชี (residual) ใน policy ต้องเป็นจำนวนเต็มสตางค์ที่ไม่ติดลบ",
  AMBIGUOUS_USEFUL_LIFE_CATEGORY: "ไม่สามารถจับคู่ประเภทสินทรัพย์กับตารางอายุการใช้งานได้",
  NO_USEFUL_LIFE_POLICY: "ยังไม่มี policy การเลือกอายุการใช้งานสำหรับสินทรัพย์นี้",
  USEFUL_LIFE_OUT_OF_RANGE: "อายุการใช้งานที่กำหนดอยู่นอกช่วงที่คู่มือกำหนด",
  DAY15_POLICY_REQUIRED:
    "ได้มาตรงวันที่ 15 ของเดือนแต่ยังไม่ได้เลือก policy การนับเดือน จึงต้องตรวจสอบก่อน",
  ACQUIRED_AFTER_CUTOFF: "วันที่ได้มาอยู่หลังวันตัดยอดรายงาน",
  INVALID_CUTOFF_DATE: "วันตัดยอดรายงาน (cutoff date) ไม่ถูกต้องหรือแปลงเป็นวันที่มาตรฐานไม่ได้",
  CUTOFF_FISCAL_YEAR_MISMATCH: "วันตัดยอดรายงานไม่สอดคล้องกับปีงบประมาณที่ระบุใน policy",
  LAND_BELOW_THRESHOLD_UNDEFINED:
    "ที่ดินมีราคาทุนต่ำกว่า 10,000 บาท ซึ่งคู่มือไม่ได้ระบุการจัดรายงานไว้ จึงต้องตรวจสอบก่อน",
  NEGATIVE_COST: "ราคาทุนติดลบ",
  SOURCE_CALC_DEPRECIATION_VARIANCE: "ค่าเสื่อมสะสมจากต้นทางต่างจากค่าที่คำนวณได้",
  SOURCE_USEFUL_LIFE_CONFLICT: "อายุการใช้งานจากต้นทางต่างจากอายุที่เลือกตาม policy",
  SOURCE_RATE_POLICY_CONFLICT: "อัตราค่าเสื่อมจากต้นทางไม่สอดคล้องกับอายุการใช้งานที่เลือกตาม policy",
  SOURCE_LIFE_RATE_INTERNAL_CONFLICT: "อายุการใช้งานและอัตราค่าเสื่อมจากต้นทางขัดแย้งกันเอง",
  SOURCE_ACCUM_NEGATIVE: "ค่าเสื่อมสะสมจากต้นทางติดลบ",
  SOURCE_ACCUM_EXCEEDS_COST: "ค่าเสื่อมสะสมจากต้นทางเกินราคาทุน",
  SOURCE_NBV_INCONSISTENT: "มูลค่าสุทธิจากต้นทางไม่เท่ากับราคาทุนหักค่าเสื่อมสะสมจากต้นทาง",
  SOURCE_NBV_VS_CALC_VARIANCE: "มูลค่าสุทธิจากต้นทางต่างจากมูลค่าสุทธิที่คำนวณได้",
};

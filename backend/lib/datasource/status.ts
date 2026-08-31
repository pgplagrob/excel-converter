import { cellText, compactText } from "./text";

function hasStatusMark(value: any): boolean {
  const text = compactText(value).toLowerCase();
  if (!text || text === "-") return false;
  return true;
}

export function deriveStatus(
  statusNormal: any,
  statusBroken: any,
  statusDeteriorated: any,
  statusLost: any,
  statusStoredLong: any,
  statusUnnecessary: any,
  defaultStatus = "",
): string {
  if (hasStatusMark(statusNormal)) return "ปกติ";
  if (hasStatusMark(statusBroken)) return "ชำรุด";
  if (hasStatusMark(statusDeteriorated)) return "ชำรุด";
  if (hasStatusMark(statusLost)) return "สูญหาย";
  if (hasStatusMark(statusStoredLong)) return "ไม่ได้ใช้งาน";
  if (hasStatusMark(statusUnnecessary)) return "ไม่ได้ใช้งาน";
  return defaultStatus;
}

export function normalizeFlexibleStatus(value: any, fallback = "ปกติ"): string {
  const text = cellText(value);
  if (!text) return fallback;
  if (/ยกเลิกการใช้งาน/.test(text)) return "ยกเลิกการใช้งาน";
  if (/ตัดจำหน่าย|จำหน่ายแล้ว|^จำหน่าย$/.test(text)) return "จำหน่าย";
  if (/ชำรุด/.test(text)) return "ชำรุด";
  if (/สูญหาย/.test(text)) return "สูญหาย";
  if (/เสื่อม|เสิ่อม/.test(text)) return "ชำรุด";
  if (/รอจำหน่าย|หมดความจำเป็น|ไม่จำเป็นต้องใช้/.test(text)) return "ไม่ได้ใช้งาน";
  if (/ไม่ได้ใช้งาน|ไม่ใช้งาน/.test(text)) return "ไม่ได้ใช้งาน";
  if (/ปกติ|ใช้งาน|ใช้งานได้/.test(text)) return "ปกติ";
  return text;
}

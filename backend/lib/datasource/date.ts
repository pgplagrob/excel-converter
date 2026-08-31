import { cellText, compactText } from "./text";

const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1,
  "มค": 1,
  มกราคม: 1,
  "ก.พ.": 2,
  "กพ": 2,
  กุมภาพันธ์: 2,
  "มี.ค.": 3,
  "มีค": 3,
  มีนาคม: 3,
  "เม.ย.": 4,
  "เมย": 4,
  เมษายน: 4,
  "พ.ค.": 5,
  "พค": 5,
  พฤษภาคม: 5,
  "มิ.ย.": 6,
  "มิย": 6,
  มิถุนายน: 6,
  "ก.ค.": 7,
  "กค": 7,
  กรกฎาคม: 7,
  "ส.ค.": 8,
  "สค": 8,
  สิงหาคม: 8,
  "ก.ย.": 9,
  "กย": 9,
  กันยายน: 9,
  "ต.ค.": 10,
  "ตค": 10,
  ตุลาคม: 10,
  "พ.ย.": 11,
  "พย": 11,
  พฤศจิกายน: 11,
  "ธ.ค.": 12,
  "ธค": 12,
  ธันวาคม: 12,
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function normalizeMonth(value: any): number | null {
  const text = compactText(value);
  if (!text) return null;
  if (/^\d{1,2}$/.test(text)) {
    const month = Number(text);
    return month >= 1 && month <= 12 ? month : null;
  }
  const normalized = text.replace(/\s+/g, "").toLowerCase();
  return THAI_MONTHS[normalized] ?? THAI_MONTHS[normalized.replace(/\./g, "")] ?? null;
}

function normalizeYear(value: any): number | null {
  const text = compactText(value);
  if (!/^\d{2,4}$/.test(text)) return null;
  let year = Number(text);
  if (year < 100) year += 2500;
  if (year > 2400) year -= 543;
  if (year < 1800 || year > 2100) return null;
  return year;
}

function excelSerialToDate(value: number): string {
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + value * 86400000);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function formatDate(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function normalizeThaiDate(dayOrValue: any, monthValue?: any, yearValue?: any): string {
  if (dayOrValue instanceof Date) {
    return formatDate(dayOrValue.getDate(), dayOrValue.getMonth() + 1, dayOrValue.getFullYear());
  }

  if (monthValue !== undefined || yearValue !== undefined) {
    const day = Number(compactText(dayOrValue));
    const month = normalizeMonth(monthValue);
    const year = normalizeYear(yearValue);
    if (day >= 1 && day <= 31 && month && year) return formatDate(day, month, year);
    return "";
  }

  if (typeof dayOrValue === "number" && dayOrValue > 20000 && dayOrValue < 80000) {
    return excelSerialToDate(dayOrValue);
  }

  const text = cellText(dayOrValue);
  if (!text) return "";
  if (/^\d{5}$/.test(text)) return excelSerialToDate(Number(text));

  const numericDate = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (numericDate) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]);
    const year = normalizeYear(numericDate[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year) {
      return formatDate(day, month, year);
    }
    return "";
  }

  const yearFirstDate = text.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (yearFirstDate) {
    const year = normalizeYear(yearFirstDate[1]);
    const month = Number(yearFirstDate[2]);
    const day = Number(yearFirstDate[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year) {
      return formatDate(day, month, year);
    }
    return "";
  }

  const thaiTextDate = text.match(/(\d{1,2})[\s\-/]*([A-Za-zก-๙.]+)[\s\-/]*(\d{2,4})/);
  if (thaiTextDate) {
    const day = Number(thaiTextDate[1]);
    const month = normalizeMonth(thaiTextDate[2]);
    const year = normalizeYear(thaiTextDate[3]);
    if (day >= 1 && day <= 31 && month && year) return formatDate(day, month, year);
  }

  return "";
}

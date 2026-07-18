// ExcelJS workbook builder for แบบ อปท.-สท. 1/2/3 + Audit/Assumptions.
//
// This is the only module in lib/reports that touches ExcelJS — every input
// it receives (SorThorNDataset, AuditAssumptionsDataset) is produced by pure
// functions elsewhere and fully unit-tested on its own. Money is always
// written as a real number (satang / 100) with a "#,##0.00" format so
// subtotal/grand-total formulas sum genuine numeric cells; text that
// originated from source data is passed through sanitizeCellText first.

import ExcelJS from "exceljs";
import type { OrganizationMetadata, ReportingPolicy } from "../domain/types";
import type { AuditAssumptionsDataset } from "./audit-assumptions-dataset";
import { formatDateDmyBe } from "./format-date";
import { ASSET_GROUP_ORDER } from "./labels";
import { sanitizeCellText } from "./sanitize";
import type { SorThor1Dataset } from "./sor-thor-1-dataset";
import type { SorThor2Dataset } from "./sor-thor-2-dataset";
import type { SorThor3Dataset } from "./sor-thor-3-dataset";

const MONEY_FORMAT = "#,##0.00";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E5E5" } };
const DRAFT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

function baht(satang: number): number {
  return Math.round(satang) / 100;
}

function centerBold(cell: ExcelJS.Cell): void {
  cell.font = { bold: true };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

function borderRange(sheet: ExcelJS.Worksheet, fromRow: number, toRow: number, fromCol: number, toCol: number): void {
  for (let r = fromRow; r <= toRow; r += 1) {
    for (let c = fromCol; c <= toCol; c += 1) {
      sheet.getCell(r, c).border = THIN_BORDER;
    }
  }
}

function writeDraftBanner(sheet: ExcelJS.Worksheet, columnCount: number): number {
  sheet.mergeCells(1, 1, 1, columnCount);
  const cell = sheet.getCell(1, 1);
  cell.value = "ฉบับร่าง — ยังไม่พร้อมใช้เป็นรายงานทางการ (มีรายการ NEEDS_REVIEW หรือ blocking issue ที่ต้องแก้ไขก่อน)";
  cell.font = { bold: true, color: { argb: "FF9A6700" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.fill = DRAFT_FILL;
  sheet.getRow(1).height = 22;
  return 2; // next free row
}

interface OrgBlockOptions {
  full: boolean; // สท.1 shows 8 fields; สท.2/สท.3 show only หน่วยงาน/อำเภอ/จังหวัด
}

function writeOrgBlock(
  sheet: ExcelJS.Worksheet,
  org: OrganizationMetadata,
  startRow: number,
  columnCount: number,
  options: OrgBlockOptions,
): number {
  let row = startRow;
  const writeLine = (label: string, value: string) => {
    sheet.mergeCells(row, 1, row, columnCount);
    const cell = sheet.getCell(row, 1);
    cell.value = `${label} ${sanitizeCellText(value)}`;
    cell.alignment = { horizontal: "left", vertical: "middle" };
    row += 1;
  };

  writeLine("หน่วยงาน:", org.organizationName);
  writeLine("อำเภอ:", org.district);
  writeLine("จังหวัด:", org.province);
  if (options.full) {
    writeLine("รหัสไปรษณีย์:", org.postalCode);
    writeLine("ชื่อเจ้าหน้าที่ประสานงาน:", org.contactName);
    writeLine("ตำแหน่ง:", org.contactPosition);
    writeLine("โทรศัพท์:", org.phone);
    writeLine("โทรสาร:", org.fax);
  }
  return row + 1; // blank line after the block
}

function writeTitleBlock(
  sheet: ExcelJS.Worksheet,
  formCode: string,
  titleLines: string[],
  columnCount: number,
  startRow: number,
): number {
  sheet.mergeCells(startRow, 1, startRow, columnCount);
  const codeCell = sheet.getCell(startRow, columnCount);
  codeCell.value = formCode;
  codeCell.alignment = { horizontal: "right", vertical: "middle" };
  codeCell.font = { bold: true };

  let row = startRow + 1;
  for (const line of titleLines) {
    sheet.mergeCells(row, 1, row, columnCount);
    const cell = sheet.getCell(row, 1);
    cell.value = line;
    centerBold(cell);
    row += 1;
  }
  return row + 1;
}

function applyPageSetup(sheet: ExcelJS.Worksheet, headerRow: number, printArea: string): void {
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.printArea = printArea;
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  sheet.pageSetup.horizontalCentered = true;
}

// ---------- อปท.-สท. 1 ----------

function buildSorThor1Sheet(
  workbook: ExcelJS.Workbook,
  dataset: SorThor1Dataset,
  org: OrganizationMetadata,
  policy: ReportingPolicy,
  isDraft: boolean,
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("อปท-สท1");
  const columnCount = 5;
  sheet.columns = [{ width: 8 }, { width: 32 }, { width: 18 }, { width: 20 }, { width: 18 }];

  let row = isDraft ? writeDraftBanner(sheet, columnCount) : 1;
  const titleTopRow = row;
  row = writeTitleBlock(
    sheet,
    "แบบ อปท. - สท. 1",
    [
      "รายงานแสดงมูลค่ารวมของสินทรัพย์และค่าเสื่อมราคาสะสมตามประเภทสินทรัพย์",
      `ณ วันที่ ${formatDateDmyBe(policy.cutoffDateISO)}`,
    ],
    columnCount,
    row,
  );
  row = writeOrgBlock(sheet, org, row, columnCount, { full: true });

  const headerRow = row;
  sheet.mergeCells(headerRow, 1, headerRow + 1, 1);
  sheet.mergeCells(headerRow, 2, headerRow + 1, 2);
  sheet.mergeCells(headerRow, 3, headerRow, 5);
  sheet.getCell(headerRow, 1).value = "ลำดับ";
  centerBold(sheet.getCell(headerRow, 1));
  sheet.getCell(headerRow, 2).value = "ประเภทสินทรัพย์";
  centerBold(sheet.getCell(headerRow, 2));
  sheet.getCell(headerRow, 3).value = "มูลค่า (บาท)";
  centerBold(sheet.getCell(headerRow, 3));
  const subHeaderRow = headerRow + 1;
  ["ราคาทุน", "ค่าเสื่อมราคาสะสม", "มูลค่าสุทธิ"].forEach((label, index) => {
    const cell = sheet.getCell(subHeaderRow, 3 + index);
    cell.value = label;
    centerBold(cell);
  });
  for (let c = 1; c <= columnCount; c += 1) {
    sheet.getCell(headerRow, c).fill = HEADER_FILL;
    sheet.getCell(subHeaderRow, c).fill = HEADER_FILL;
  }

  const dataStartRow = subHeaderRow + 1;
  dataset.rows.forEach((groupRow, index) => {
    const r = dataStartRow + index;
    sheet.getCell(r, 1).value = index + 1;
    sheet.getCell(r, 1).alignment = { horizontal: "center" };
    sheet.getCell(r, 2).value = sanitizeCellText(groupRow.labelTh);
    const costCell = sheet.getCell(r, 3);
    costCell.value = baht(groupRow.costSatang);
    costCell.numFmt = MONEY_FORMAT;
    const accumCell = sheet.getCell(r, 4);
    accumCell.value = baht(groupRow.accumulatedDepreciationSatang);
    accumCell.numFmt = MONEY_FORMAT;
    const netCell = sheet.getCell(r, 5);
    netCell.value = baht(groupRow.netBookValueSatang);
    netCell.numFmt = MONEY_FORMAT;
  });
  const dataEndRow = dataStartRow + dataset.rows.length - 1;

  const totalRow = dataEndRow + 1;
  sheet.mergeCells(totalRow, 1, totalRow, 2);
  const totalLabelCell = sheet.getCell(totalRow, 1);
  totalLabelCell.value = "รวมมูลค่าสินทรัพย์ทั้งสิ้น";
  totalLabelCell.font = { bold: true };
  totalLabelCell.alignment = { horizontal: "center" };
  [3, 4, 5].forEach((col) => {
    const colLetter = sheet.getColumn(col).letter;
    const cell = sheet.getCell(totalRow, col);
    cell.value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})` };
    cell.numFmt = MONEY_FORMAT;
    cell.font = { bold: true };
  });

  borderRange(sheet, headerRow, totalRow, 1, columnCount);
  applyPageSetup(sheet, headerRow, `A${titleTopRow}:E${totalRow}`);

  return sheet;
}

// ---------- อปท.-สท. 2 ----------

function buildSorThor2Sheet(
  workbook: ExcelJS.Workbook,
  dataset: SorThor2Dataset,
  org: OrganizationMetadata,
  policy: ReportingPolicy,
  isDraft: boolean,
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("อปท-สท2");
  const columnCount = 9;
  sheet.columns = [
    { width: 8 },
    { width: 20 },
    { width: 32 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 20 },
  ];

  let row = isDraft ? writeDraftBanner(sheet, columnCount) : 1;
  const titleTopRow = row;
  row = writeTitleBlock(
    sheet,
    "แบบ อปท. - สท. 2",
    [
      "รายงานสำรวจสินทรัพย์ทางบัญชีขององค์กรปกครองส่วนท้องถิ่น",
      `ณ วันที่ ${formatDateDmyBe(policy.cutoffDateISO)}`,
    ],
    columnCount,
    row,
  );
  row = writeOrgBlock(sheet, org, row, columnCount, { full: false });

  const headerRow = row;
  const headers = [
    "ลำดับ",
    "ประเภทสินทรัพย์",
    "รายการสินทรัพย์",
    "หน่วยนับ",
    "รหัสสินทรัพย์",
    "วันที่ได้มาของสินทรัพย์",
    "อายุการใช้งานของสินทรัพย์ (ปี)",
    "ราคาทุน (บาท)",
    `ค่าเสื่อมราคาสะสม (บาท)\nถึงวันที่ ${formatDateDmyBe(policy.cutoffDateISO)}`,
  ];
  headers.forEach((label, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = label;
    centerBold(cell);
    cell.fill = HEADER_FILL;
  });

  const dataStartRow = headerRow + 1;
  dataset.rows.forEach((assetRow, index) => {
    const r = dataStartRow + index;
    sheet.getCell(r, 1).value = index + 1;
    sheet.getCell(r, 1).alignment = { horizontal: "center" };
    sheet.getCell(r, 2).value = sanitizeCellText(assetRow.assetGroupLabelTh);
    sheet.getCell(r, 3).value = sanitizeCellText(assetRow.assetName);
    sheet.getCell(r, 4).value = sanitizeCellText(assetRow.unit);
    sheet.getCell(r, 5).value = sanitizeCellText(assetRow.assetCode);
    sheet.getCell(r, 6).value = formatDateDmyBe(assetRow.acquisitionDateISO);
    sheet.getCell(r, 7).value = assetRow.usefulLifeYears;
    sheet.getCell(r, 7).alignment = { horizontal: "center" };
    const costCell = sheet.getCell(r, 8);
    costCell.value = baht(assetRow.costSatang);
    costCell.numFmt = MONEY_FORMAT;
    const accumCell = sheet.getCell(r, 9);
    accumCell.value = baht(assetRow.accumulatedDepreciationSatang);
    accumCell.numFmt = MONEY_FORMAT;
  });
  const dataEndRow = Math.max(dataStartRow, dataStartRow + dataset.rows.length - 1);

  const totalRow = dataStartRow + dataset.rows.length;
  sheet.mergeCells(totalRow, 1, totalRow, 7);
  const totalLabelCell = sheet.getCell(totalRow, 1);
  totalLabelCell.value = "รวม (บาท)";
  totalLabelCell.font = { bold: true };
  totalLabelCell.alignment = { horizontal: "center" };
  if (dataset.rows.length > 0) {
    [8, 9].forEach((col) => {
      const colLetter = sheet.getColumn(col).letter;
      const cell = sheet.getCell(totalRow, col);
      cell.value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})` };
      cell.numFmt = MONEY_FORMAT;
      cell.font = { bold: true };
    });
  } else {
    [8, 9].forEach((col) => {
      const cell = sheet.getCell(totalRow, col);
      cell.value = 0;
      cell.numFmt = MONEY_FORMAT;
      cell.font = { bold: true };
    });
  }

  borderRange(sheet, headerRow, totalRow, 1, columnCount);
  applyPageSetup(sheet, headerRow, `A${titleTopRow}:I${totalRow}`);

  return sheet;
}

// ---------- อปท.-สท. 3 ----------

function buildSorThor3Sheet(
  workbook: ExcelJS.Workbook,
  dataset: SorThor3Dataset,
  org: OrganizationMetadata,
  policy: ReportingPolicy,
  isDraft: boolean,
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("อปท-สท3");
  const columnCount = 6;
  sheet.columns = [{ width: 8 }, { width: 32 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }];

  let row = isDraft ? writeDraftBanner(sheet, columnCount) : 1;
  const titleTopRow = row;
  row = writeTitleBlock(
    sheet,
    "แบบ อปท. - สท. 3",
    [
      "รายงานสำรวจสินทรัพย์ขององค์กรปกครองส่วนท้องถิ่น",
      `ณ วันที่ ${formatDateDmyBe(policy.cutoffDateISO)}`,
      "กรณีสินทรัพย์มีมูลค่าต่ำกว่า 10,000 บาท หรือสินทรัพย์หมดอายุการให้ประโยชน์อย่างมีประสิทธิภาพแล้ว หรือครุภัณฑ์ที่ซื้อ/ได้มาก่อนปีงบประมาณ พ.ศ. 2560",
    ],
    columnCount,
    row,
  );
  row = writeOrgBlock(sheet, org, row, columnCount, { full: false });

  const headerRow = row;
  const headers = ["ลำดับ", "รายการสินทรัพย์", "หน่วยนับ", "รหัสสินทรัพย์", "วันที่ได้มาของสินทรัพย์", "ราคาทุน (บาท)"];
  headers.forEach((label, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = label;
    centerBold(cell);
    cell.fill = HEADER_FILL;
  });

  const dataStartRow = headerRow + 1;
  dataset.rows.forEach((assetRow, index) => {
    const r = dataStartRow + index;
    sheet.getCell(r, 1).value = index + 1;
    sheet.getCell(r, 1).alignment = { horizontal: "center" };
    sheet.getCell(r, 2).value = sanitizeCellText(assetRow.assetName);
    sheet.getCell(r, 3).value = sanitizeCellText(assetRow.unit);
    sheet.getCell(r, 4).value = sanitizeCellText(assetRow.assetCode);
    sheet.getCell(r, 5).value = formatDateDmyBe(assetRow.acquisitionDateISO);
    const costCell = sheet.getCell(r, 6);
    costCell.value = baht(assetRow.costSatang);
    costCell.numFmt = MONEY_FORMAT;
  });
  const dataEndRow = Math.max(dataStartRow, dataStartRow + dataset.rows.length - 1);

  const totalRow = dataStartRow + dataset.rows.length;
  sheet.mergeCells(totalRow, 1, totalRow, 5);
  const totalLabelCell = sheet.getCell(totalRow, 1);
  totalLabelCell.value = "รวม (บาท)";
  totalLabelCell.font = { bold: true };
  totalLabelCell.alignment = { horizontal: "center" };
  const totalCell = sheet.getCell(totalRow, 6);
  if (dataset.rows.length > 0) {
    totalCell.value = { formula: `SUM(F${dataStartRow}:F${dataEndRow})` };
  } else {
    totalCell.value = 0;
  }
  totalCell.numFmt = MONEY_FORMAT;
  totalCell.font = { bold: true };

  borderRange(sheet, headerRow, totalRow, 1, columnCount);
  applyPageSetup(sheet, headerRow, `A${titleTopRow}:F${totalRow}`);

  return sheet;
}

// ---------- Audit / Assumptions ----------

function buildAuditAssumptionsSheet(workbook: ExcelJS.Workbook, dataset: AuditAssumptionsDataset): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("Audit_Assumptions");
  sheet.columns = [{ width: 28 }, { width: 60 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];

  let row = 1;
  const heading = (text: string) => {
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.font = { bold: true, size: 13 };
    row += 2;
  };
  const kv = (label: string, value: string | number) => {
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { bold: true };
    sheet.getCell(row, 2).value = typeof value === "string" ? sanitizeCellText(value) : value;
    row += 1;
  };

  heading("Audit / Assumptions — สรุป policy และการคำนวณของรายงานฉบับนี้");
  kv("ปีงบประมาณ (พ.ศ.)", dataset.fiscalYearBE);
  kv("วันที่ตัดยอด (cutoff date)", formatDateDmyBe(dataset.cutoffDateISO));
  kv("หน่วยงาน", dataset.organizationMetadata.organizationName);
  kv("อำเภอ", dataset.organizationMetadata.district);
  kv("จังหวัด", dataset.organizationMetadata.province);
  row += 1;

  heading("Policy");
  kv("กฎวันที่ 15", dataset.day15PolicyLabel);
  kv("Useful-life selection policy", dataset.usefulLifeSelectionPolicyLabel);
  kv("Rounding mode", dataset.roundingModeLabel);
  kv("Rounding stage", dataset.roundingStageLabel);
  kv("มูลค่าคงเหลือตามบัญชี (residual, บาท)", dataset.residualBookValueBaht);
  kv("Classification rule version", dataset.classificationVersion);
  kv("Depreciation rule version", dataset.depreciationRuleVersion);
  row += 1;

  heading("อายุการใช้งานที่กำหนด (Useful-life overrides)");
  const ulHeaderRow = row;
  ["ประเภท", "อายุที่เลือก (ปี)", "ช่วงต่ำสุด-สูงสุด", "แหล่งอ้างอิง", "ผู้อนุมัติ"].forEach((label, index) => {
    const cell = sheet.getCell(ulHeaderRow, index + 1);
    cell.value = label;
    centerBold(cell);
    cell.fill = HEADER_FILL;
  });
  row += 1;
  if (dataset.usefulLifeOverrides.length === 0) {
    sheet.getCell(row, 1).value = "(ไม่มี)";
    row += 1;
  }
  for (const override of dataset.usefulLifeOverrides) {
    sheet.getCell(row, 1).value = sanitizeCellText(override.labelTh);
    sheet.getCell(row, 2).value = override.years;
    sheet.getCell(row, 3).value = `${override.rangeMin}-${override.rangeMax}`;
    sheet.getCell(row, 4).value = sanitizeCellText(override.source);
    sheet.getCell(row, 5).value = sanitizeCellText(override.approver || "");
    row += 1;
  }
  row += 1;

  heading("การ mapping ประเภทสินทรัพย์ที่ผู้ใช้อนุมัติ (Category mapping overrides)");
  const cmHeaderRow = row;
  ["ค่าต้นทาง", "ประเภท (AssetGroup)", "Useful-life category", "ผู้อนุมัติ"].forEach((label, index) => {
    const cell = sheet.getCell(cmHeaderRow, index + 1);
    cell.value = label;
    centerBold(cell);
    cell.fill = HEADER_FILL;
  });
  row += 1;
  if (dataset.categoryMappingOverridesUsed.length === 0) {
    sheet.getCell(row, 1).value = "(ไม่มี)";
    row += 1;
  }
  for (const mapping of dataset.categoryMappingOverridesUsed) {
    sheet.getCell(row, 1).value = sanitizeCellText(mapping.sourceValue);
    sheet.getCell(row, 2).value = mapping.assetGroup;
    sheet.getCell(row, 3).value = mapping.usefulLifeCategoryKey || "";
    sheet.getCell(row, 4).value = sanitizeCellText(mapping.approvedBy || "");
    row += 1;
  }
  row += 1;

  heading("Row overrides (แก้ไขรายแถว)");
  const roHeaderRow = row;
  ["Row key", "Field", "ค่าที่แก้ไข", "เหตุผล", "เวลา"].forEach((label, index) => {
    const cell = sheet.getCell(roHeaderRow, index + 1);
    cell.value = label;
    centerBold(cell);
    cell.fill = HEADER_FILL;
  });
  row += 1;
  if (dataset.rowOverrides.length === 0) {
    sheet.getCell(row, 1).value = "(ไม่มี)";
    row += 1;
  }
  for (const override of dataset.rowOverrides) {
    sheet.getCell(row, 1).value = sanitizeCellText(override.rowKey);
    sheet.getCell(row, 2).value = override.field;
    sheet.getCell(row, 3).value = sanitizeCellText(String(override.overrideValue));
    sheet.getCell(row, 4).value = sanitizeCellText(override.reason || "");
    sheet.getCell(row, 5).value = override.timestamp;
    row += 1;
  }
  row += 1;

  heading("Reference overrides (แก้ไขค่าที่ไม่ตรง Reference)");
  const refHeaderRow = row;
  ["คอลัมน์", "ค่าต้นทาง", "ค่ามาตรฐาน (canonical)", "ผู้อนุมัติ"].forEach((label, index) => {
    const cell = sheet.getCell(refHeaderRow, index + 1);
    cell.value = label;
    centerBold(cell);
    cell.fill = HEADER_FILL;
  });
  row += 1;
  if (dataset.referenceOverrides.length === 0) {
    sheet.getCell(row, 1).value = "(ไม่มี)";
    row += 1;
  }
  for (const override of dataset.referenceOverrides) {
    sheet.getCell(row, 1).value = sanitizeCellText(override.templateColumn);
    sheet.getCell(row, 2).value = sanitizeCellText(override.sourceValue);
    sheet.getCell(row, 3).value = sanitizeCellText(override.canonicalValue);
    sheet.getCell(row, 4).value = sanitizeCellText(override.approvedBy || "");
    row += 1;
  }
  row += 1;

  heading("Reconciliation");
  kv("รวมมูลค่าทุน สท.1 (บาท)", baht(dataset.reconciliation.sorThor1GrandTotal.costSatang));
  kv("รวมมูลค่าทุน สท.2 (บาท)", baht(dataset.reconciliation.sorThor2GrandTotal.costSatang));
  kv("สท.1 = สท.2 หรือไม่", dataset.reconciliation.sorThor1MatchesSorThor2 ? "ตรงกัน" : "ไม่ตรงกัน");
  kv("รวมมูลค่าทุน สท.3 (บาท)", baht(dataset.reconciliation.sorThor3GrandTotal.costSatang));
  kv("Control total (สท.2+สท.3, บาท)", baht(dataset.reconciliation.controlTotal.costSatang));
  kv(
    "Control total ตรงกับ reportable scope หรือไม่",
    dataset.reconciliation.controlTotalMatchesReportableScope ? "ตรงกัน" : "ไม่ตรงกัน",
  );
  kv("จำนวนรายการ NEEDS_REVIEW", dataset.reconciliation.needsReviewCount);
  kv("จำนวนรายการ EXCLUDED", dataset.reconciliation.excludedCount);
  row += 1;

  heading("สถานะการ export");
  kv("อนุญาตให้ export เป็นรายงานทางการหรือไม่", dataset.exportGate.officialAllowed ? "อนุญาต" : "ไม่อนุญาต (blocking)");
  for (const reason of dataset.exportGate.blockingReasons) {
    sheet.getCell(row, 1).value = "- " + sanitizeCellText(reason);
    row += 1;
  }
  row += 1;

  heading("รายการ NEEDS_REVIEW (พร้อม source trace)");
  const nrHeaderRow = row;
  ["ไฟล์", "ชีต", "แถวใน Excel", "รหัสสินทรัพย์", "ชื่อสินทรัพย์", "เหตุผล"].forEach((label, index) => {
    const cell = sheet.getCell(nrHeaderRow, index + 1);
    cell.value = label;
    centerBold(cell);
    cell.fill = HEADER_FILL;
  });
  row += 1;
  if (dataset.needsReviewRows.length === 0) {
    sheet.getCell(row, 1).value = "(ไม่มี)";
    row += 1;
  }
  for (const trace of dataset.needsReviewRows) {
    sheet.getCell(row, 1).value = sanitizeCellText(trace.sourceFile);
    sheet.getCell(row, 2).value = sanitizeCellText(trace.sourceSheet);
    sheet.getCell(row, 3).value = trace.sourceExcelRow;
    sheet.getCell(row, 4).value = sanitizeCellText(trace.assetCode);
    sheet.getCell(row, 5).value = sanitizeCellText(trace.assetName);
    sheet.getCell(row, 6).value = sanitizeCellText(trace.reasonCodesTh.join(", "));
    row += 1;
  }
  row += 1;

  heading("รายการ EXCLUDED (พร้อม source trace)");
  const exHeaderRow = row;
  ["ไฟล์", "ชีต", "แถวใน Excel", "รหัสสินทรัพย์", "ชื่อสินทรัพย์", "เหตุผล"].forEach((label, index) => {
    const cell = sheet.getCell(exHeaderRow, index + 1);
    cell.value = label;
    centerBold(cell);
    cell.fill = HEADER_FILL;
  });
  row += 1;
  if (dataset.excludedRows.length === 0) {
    sheet.getCell(row, 1).value = "(ไม่มี)";
    row += 1;
  }
  for (const trace of dataset.excludedRows) {
    sheet.getCell(row, 1).value = sanitizeCellText(trace.sourceFile);
    sheet.getCell(row, 2).value = sanitizeCellText(trace.sourceSheet);
    sheet.getCell(row, 3).value = trace.sourceExcelRow;
    sheet.getCell(row, 4).value = sanitizeCellText(trace.assetCode);
    sheet.getCell(row, 5).value = sanitizeCellText(trace.assetName);
    sheet.getCell(row, 6).value = sanitizeCellText(trace.reasonCodesTh.join(", "));
    row += 1;
  }

  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;

  return sheet;
}

export interface BuildReportWorkbookInput {
  /** Append report sheets onto an existing workbook (e.g. one that already
   * has the Template-50 sheets) instead of creating a new one. */
  workbook?: ExcelJS.Workbook;
  sorThor1?: SorThor1Dataset;
  sorThor2?: SorThor2Dataset;
  sorThor3?: SorThor3Dataset;
  audit?: AuditAssumptionsDataset;
  organizationMetadata: OrganizationMetadata;
  reportingPolicy: ReportingPolicy;
  isDraft: boolean;
}

export function buildReportWorkbook(input: BuildReportWorkbookInput): ExcelJS.Workbook {
  const workbook = input.workbook ?? new ExcelJS.Workbook();
  if (input.sorThor1) {
    buildSorThor1Sheet(workbook, input.sorThor1, input.organizationMetadata, input.reportingPolicy, input.isDraft);
  }
  if (input.sorThor2) {
    buildSorThor2Sheet(workbook, input.sorThor2, input.organizationMetadata, input.reportingPolicy, input.isDraft);
  }
  if (input.sorThor3) {
    buildSorThor3Sheet(workbook, input.sorThor3, input.organizationMetadata, input.reportingPolicy, input.isDraft);
  }
  if (input.audit) {
    buildAuditAssumptionsSheet(workbook, input.audit);
  }
  return workbook;
}

export { ASSET_GROUP_ORDER };

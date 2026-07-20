import { normalizeThaiDate } from "../date";
import {
  appendHeaders,
  appendNormalizedDetail,
  buildHeaderKeys,
  buildRawRow,
  setFlexibleSourceStatus,
  setNormalizedFields,
  withCommonMeta,
} from "../row-builders";
import {
  cellText,
  compactText,
  countMatchingRows,
  findColumnIndex,
  isNumericSequence,
  isRowEmpty,
  isTotalOrSummaryRow,
  looksLikeAssetCode,
  looksLikeAssetItemGroup,
  looksLikeAssetType,
  normalizeForScore,
  valueAt,
} from "../text";
import {
  INTERNAL,
  SOURCE_ASSET_ITEM_COLUMN,
  SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN,
  type DataSourceSheet,
  type FlexibleAssetLayout,
} from "../types";

function looksLikeSplitAssetCode(row: any[]): boolean {
  const prefix = compactText(row[1]);
  const year = compactText(row[2]);
  const sequence = compactText(row[3]);
  return (
    Boolean(cellText(row[0])) &&
    /^\d{2,3}$/.test(prefix) &&
    /^\d{2,4}$/.test(year) &&
    /^\d{3,5}$/.test(sequence)
  );
}

function combineFlexibleHeaders(primaryHeaders: any[], secondaryHeaders: any[] = []): any[] {
  const columnCount = Math.max(primaryHeaders.length, secondaryHeaders.length);
  const combined = Array.from(
    { length: columnCount },
    (_, index) => primaryHeaders[index] || secondaryHeaders[index] || "",
  );
  const systemCodeIndex = combined.findIndex((header) => {
    const normalized = normalizeForScore(cellText(header));
    return normalized.includes("รหัสสินทรัพย์") && normalized.includes("ระบบ");
  });
  if (systemCodeIndex >= 0 && !cellText(combined[systemCodeIndex + 1])) {
    combined[systemCodeIndex] = "รหัสสินทรัพย์ Elaas";
    combined[systemCodeIndex + 1] = "รหัสสินทรัพย์";
  }
  return combined;
}

function deriveBudgetSourceFromFundColumns(sourceRow: any[], secondaryHeaders: any[]): string {
  const supportedFundNames: Array<[RegExp, string]> = [
    [/เงินงบประมาณ/, "เงินงบประมาณ"],
    [/เงินรายได้/, "เงินรายได้"],
    [/เงินอุดหนุน/, "เงินอุดหนุน"],
    [/เงินสะสม|เงินทุนสำรองเงินสะสม/, "เงินสะสม"],
    [/เงินกู้/, "เงินกู้"],
  ];

  for (let index = 0; index < secondaryHeaders.length; index += 1) {
    const amountText = cellText(sourceRow[index]).replace(/,/g, "");
    const amount = Number(amountText);
    if (!amountText || !Number.isFinite(amount) || amount <= 0) continue;

    const header = compactText(secondaryHeaders[index]);
    const matchedFund = supportedFundNames.find(([pattern]) => pattern.test(header));
    if (matchedFund) return matchedFund[1];
  }

  return "";
}

export function findFlexibleAssetLayout(matrix: any[][]): FlexibleAssetLayout | null {
  const headerScanLimit = Math.min(matrix.length, 8);
  for (let rowIndex = 0; rowIndex < headerScanLimit; rowIndex += 1) {
    const headers = buildHeaderKeys(
      combineFlexibleHeaders(matrix[rowIndex] || [], matrix[rowIndex + 1] || []),
    );
    const assetCodeIndex = findColumnIndex(headers, ["รหัสสินทรัพย์", "รหัสครุภัณฑ์", "เลขครุภัณฑ์"]);
    const assetNameIndex = findColumnIndex(headers, ["ชื่อสินทรัพย์", "ชื่อครุภัณฑ์"]);
    const dateIndex = findColumnIndex(headers, ["วันที่ได้มา", "วันที่ได้รับ", "วันเดือนปี"]);
    const valueIndex = findColumnIndex(headers, ["ราคาสินทรัพย์", "มูลค่าสินทรัพย์", "ราคาที่ได้มา", "มูลค่า"]);
    if (assetCodeIndex >= 0 && assetNameIndex >= 0 && (dateIndex >= 0 || valueIndex >= 0)) {
      return { kind: "standard-table", confidence: 0.9, headerRowIndex: rowIndex };
    }
  }

  if (
    countMatchingRows(
      matrix,
      (row) => looksLikeAssetCode(row[3]) && Boolean(cellText(row[1])) && Boolean(cellText(row[2])),
    ) >= 2
  ) {
    return { kind: "department-positional", confidence: 0.9, headerRowIndex: 0 };
  }

  if (countMatchingRows(matrix, looksLikeSplitAssetCode) >= 2) {
    return { kind: "split-code-positional", confidence: 0.9, headerRowIndex: 0 };
  }

  if (
    countMatchingRows(
      matrix,
      (row) => looksLikeAssetCode(row[6]) && Boolean(cellText(row[1])) && Boolean(cellText(row[4] || row[5])),
    ) >= 2
  ) {
    return { kind: "consolidated-positional", confidence: 0.9, headerRowIndex: 0 };
  }

  if (
    countMatchingRows(
      matrix,
      (row) =>
        looksLikeAssetCode(row[2]) &&
        Boolean(cellText(row[1])) &&
        (isNumericSequence(row[0]) || !cellText(row[0])),
    ) >= 2
  ) {
    return { kind: "simple-list", confidence: 0.75, headerRowIndex: 0 };
  }

  return null;
}

export function parseFlexibleAssetSheet(
  sheetName: string,
  matrix: any[][],
  layout: FlexibleAssetLayout,
): DataSourceSheet {
  const warnings: string[] = [];
  const rows: Record<string, any>[] = [];
  let headerRowIndex = layout.headerRowIndex;
  let headers: string[] = [];

  const addRow = (
    sourceRow: any[],
    sourceRowIndex: number,
    rawHeaders: string[],
    fields: {
      assetCode: string;
      assetName: string;
      assetDetail?: string;
      sourceAssetType?: string;
      receivedDate?: any;
      value?: any;
      responsibleUnit?: any;
      location?: any;
      acquiredBy?: any;
      acquiredFrom?: any;
      budgetSource?: any;
      note?: any;
      status?: any;
      assetCategory?: string;
    },
  ) => {
    const sourceAssetType = cellText(fields.sourceAssetType);
    const row = withCommonMeta(
      buildRawRow(rawHeaders, sourceRow),
      "FLEXIBLE_ASSET_TABLE",
      sheetName,
      sourceRowIndex + 1,
      sourceAssetType,
      Boolean(sourceAssetType),
      "",
      fields.assetName,
    );
    setNormalizedFields(row, {
      assetCode: fields.assetCode,
      assetName: fields.assetName,
      assetDetail: fields.assetDetail,
      receivedDate: fields.receivedDate,
      value: fields.value,
      responsibleUnit: fields.responsibleUnit,
      location: fields.location,
      acquiredBy: fields.acquiredBy,
      acquiredFrom: fields.acquiredFrom,
      budgetSource: fields.budgetSource,
      note: fields.note,
    });
    setFlexibleSourceStatus(row, fields.status);
    if (fields.assetCategory) row[INTERNAL.assetCategory] = fields.assetCategory;
    rows.push(row);
    return row;
  };

  if (layout.kind === "standard-table") {
    const primaryHeaders = matrix[layout.headerRowIndex] || [];
    const secondaryHeaders = matrix[layout.headerRowIndex + 1] || [];
    const combinedHeaders = combineFlexibleHeaders(primaryHeaders, secondaryHeaders);
    headers = appendHeaders(buildHeaderKeys(combinedHeaders));

    const assetCodeIndex = findColumnIndex(headers, ["รหัสสินทรัพย์", "รหัสครุภัณฑ์", "เลขครุภัณฑ์"]);
    const assetNameIndex = findColumnIndex(headers, ["ชื่อสินทรัพย์", "ชื่อครุภัณฑ์"]);
    const assetDetailIndex = findColumnIndex(headers, ["รายละเอียดสินทรัพย์", "รายละเอียด"]);
    const assetTypeIndex = findColumnIndex(headers, ["ชนิดสินทรัพย์", "ประเภททรัพย์สิน"]);
    const assetCategoryIndex = findColumnIndex(headers, ["ประเภทสินทรัพย์"]);
    const receivedDateIndex = findColumnIndex(headers, ["วันที่ได้มา", "วันที่ได้รับ", "วันเดือนปี"]);
    const valueIndex = findColumnIndex(headers, ["ราคาสินทรัพย์", "มูลค่าสินทรัพย์", "ราคาที่ได้มา", "มูลค่า"]);
    const responsibleUnitIndex =
      findColumnIndex(headers, ["งานที่รับผิดชอบ", "หน่วยงาน"]) >= 0
        ? findColumnIndex(headers, ["งานที่รับผิดชอบ", "หน่วยงาน"])
        : findColumnIndex(headers, ["งาน"]);
    const locationIndex = findColumnIndex(headers, ["อาคาร", "สถานที่ตั้ง"]);
    const acquiredByIndex = findColumnIndex(headers, ["ได้มาโดย"]);
    const acquiredFromIndex = findColumnIndex(headers, ["ได้มาจาก"]);
    const budgetSourceIndex = findColumnIndex(headers, ["แหล่งงบประมาณ", "แหล่งเงิน"]);
    const statusIndex = findColumnIndex(headers, ["สถานะ"]);
    const conditionIndex = findColumnIndex(headers, ["สภาพสินทรัพย์", "สภาพครุภัณฑ์"]);
    const hasSecondaryHeader = secondaryHeaders.some((value) =>
      /เงินงบประมาณ|เงินสะสม|เงินอุดหนุน|เงินรับฝาก|รับโอน|เงินกู้|รายได้สะสม|ทุนดำเนินการ/.test(
        cellText(value),
      ),
    );
    const dataStartIndex = layout.headerRowIndex + (hasSecondaryHeader ? 2 : 1);

    for (let index = dataStartIndex; index < matrix.length; index += 1) {
      const sourceRow = matrix[index] || [];
      if (isRowEmpty(sourceRow) || isTotalOrSummaryRow(sourceRow)) continue;
      const assetCode = cellText(valueAt(sourceRow, assetCodeIndex));
      const assetName = cellText(valueAt(sourceRow, assetNameIndex));
      if (!looksLikeAssetCode(assetCode) || !assetName) continue;
      const sourceAssetType = cellText(valueAt(sourceRow, assetTypeIndex));
      addRow(sourceRow, index, headers, {
        assetCode,
        assetName,
        assetDetail: cellText(valueAt(sourceRow, assetDetailIndex)),
        sourceAssetType,
        receivedDate: normalizeThaiDate(valueAt(sourceRow, receivedDateIndex)),
        value: valueAt(sourceRow, valueIndex),
        responsibleUnit: valueAt(sourceRow, responsibleUnitIndex),
        location: valueAt(sourceRow, locationIndex),
        acquiredBy: valueAt(sourceRow, acquiredByIndex),
        acquiredFrom: valueAt(sourceRow, acquiredFromIndex),
        budgetSource: hasSecondaryHeader
          ? deriveBudgetSourceFromFundColumns(sourceRow, secondaryHeaders)
          : valueAt(sourceRow, budgetSourceIndex),
        status: valueAt(sourceRow, statusIndex) || valueAt(sourceRow, conditionIndex),
        assetCategory: cellText(valueAt(sourceRow, assetCategoryIndex)),
      });
    }
  } else if (layout.kind === "department-positional") {
    headers = appendHeaders(
      buildHeaderKeys([
        "สำนัก",
        "ชนิดสินทรัพย์",
        "ชื่อสินทรัพย์",
        "รหัสสินทรัพย์",
        "วันที่ได้รับ",
        "__receivedMonth",
        "__receivedYear",
        "มูลค่า",
        "งานที่รับผิดชอบ",
        "ผู้ถือครอง",
        "ระบุอื่น ๆ",
        "สถานะ",
        "หมายเหตุ",
      ]),
    );
    for (let index = 0; index < matrix.length; index += 1) {
      const sourceRow = matrix[index] || [];
      const assetCode = cellText(sourceRow[3]);
      const assetName = cellText(sourceRow[2]);
      if (!looksLikeAssetCode(assetCode) || !assetName) continue;
      addRow(sourceRow, index, headers, {
        assetCode,
        assetName,
        sourceAssetType: sourceRow[1],
        receivedDate: normalizeThaiDate(sourceRow[4], sourceRow[5], sourceRow[6]),
        value: sourceRow[7],
        responsibleUnit: sourceRow[8],
        note: sourceRow[10] || sourceRow[12],
        status: sourceRow[11] || sourceRow[12],
      });
    }
  } else if (layout.kind === "split-code-positional") {
    headers = appendHeaders(
      buildHeaderKeys([
        "ชื่อสินทรัพย์",
        "__assetCodePrefix",
        "__assetCodeYear",
        "__assetCodeSequence",
        "วันที่ได้รับ",
        "มูลค่า",
        "งานที่รับผิดชอบ",
        "ระบุอื่น ๆ",
        "สถานะ",
        "__EMPTY_COLUMN_10",
        "__EMPTY_COLUMN_11",
        "__EMPTY_COLUMN_12",
        "__EMPTY_COLUMN_13",
        "อาคาร",
      ]),
    );
    for (let index = 0; index < matrix.length; index += 1) {
      const sourceRow = matrix[index] || [];
      if (!looksLikeSplitAssetCode(sourceRow)) continue;
      const assetCode = [sourceRow[1], sourceRow[2], sourceRow[3]].map(compactText).join("-");
      addRow(sourceRow, index, headers, {
        assetCode,
        assetName: cellText(sourceRow[0]),
        receivedDate: normalizeThaiDate(sourceRow[4]),
        value: sourceRow[5],
        responsibleUnit: sourceRow[6],
        location: sourceRow[13],
        note: sourceRow[7],
        status: sourceRow[8],
      });
    }
  } else if (layout.kind === "consolidated-positional") {
    headers = appendHeaders(
      buildHeaderKeys([
        "สำนัก",
        "ชนิดสินทรัพย์",
        "ยี่ห้อ",
        "รุ่น",
        "ชื่อสินทรัพย์",
        "รายละเอียด",
        "รหัสสินทรัพย์",
        "วันที่ได้รับ",
        "มูลค่า",
        "งานที่รับผิดชอบ",
        "รายละเอียดเพิ่มเติม",
        "ระบุอื่น ๆ",
        "สถานะ",
      ]),
    );
    for (let index = 0; index < matrix.length; index += 1) {
      const sourceRow = matrix[index] || [];
      const assetCode = cellText(sourceRow[6]);
      const assetName = cellText(sourceRow[4] || sourceRow[5]);
      if (!looksLikeAssetCode(assetCode) || !assetName) continue;
      addRow(sourceRow, index, headers, {
        assetCode,
        assetName,
        assetDetail: cellText(sourceRow[5] || sourceRow[10]),
        sourceAssetType: sourceRow[1],
        receivedDate: normalizeThaiDate(sourceRow[7]),
        value: sourceRow[8],
        responsibleUnit: sourceRow[9],
        note: sourceRow[10] || sourceRow[11],
        status: sourceRow[12],
      });
    }
  } else {
    headers = appendHeaders(
      buildHeaderKeys(["ลำดับ", "ชื่อสินทรัพย์", "รหัสสินทรัพย์", "งานที่รับผิดชอบ"]),
    );
    let currentAssetType = "";
    let currentAssetItem = "";
    let previousRow: Record<string, any> | null = null;
    for (let index = 0; index < matrix.length; index += 1) {
      const sourceRow = matrix[index] || [];
      const itemName = cellText(sourceRow[1]);
      const assetCode = cellText(sourceRow[2]);
      if (!looksLikeAssetCode(assetCode)) {
        if (itemName && looksLikeAssetType(itemName)) currentAssetType = itemName;
        else if (itemName && looksLikeAssetItemGroup(itemName)) currentAssetItem = itemName;
        else if (!cellText(sourceRow[0]) && itemName && previousRow) appendNormalizedDetail(previousRow, itemName);
        continue;
      }
      if (!itemName) continue;
      previousRow = addRow(sourceRow, index, headers, {
        assetCode,
        assetName: itemName,
        sourceAssetType: currentAssetType,
        responsibleUnit: sourceRow[3],
      });
      if (currentAssetItem) {
        previousRow[SOURCE_ASSET_ITEM_COLUMN] = currentAssetItem;
        previousRow[SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN] = true;
      }
    }
  }

  if (!rows.length) warnings.push("ไม่พบแถวข้อมูลสินทรัพย์ในตารางรูปแบบยืดหยุ่น");
  return {
    sheetName,
    sourceProfile: "FLEXIBLE_ASSET_TABLE",
    headerRowIndex,
    headers,
    rows,
    rowCount: rows.length,
    eligibility: "needsReview",
    eligibilityReason: "pending validation",
    confidence: layout.confidence,
    groupedAssets: [],
    warnings,
  };
}

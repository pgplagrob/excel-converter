import type { WorkbookRowMeta } from "./excel";
import { detectSheetProfile } from "./sheet-profile";
import { appendDataQualityWarnings } from "./datasource/data-quality";
import { parseNewAssetSheet } from "./datasource/parsers/new-asset";
import { parseRegisterSheet } from "./datasource/parsers/register";
import { parseTransferSheet } from "./datasource/parsers/transfer";
import { parseAssetDataSheet } from "./datasource/parsers/asset-data";
import { findFlexibleAssetLayout, parseFlexibleAssetSheet } from "./datasource/parsers/flexible";
import { parseUnknownSheet } from "./datasource/parsers/unknown";
import { detectSourceProfile } from "./datasource/profile";
import { isSheetEffectivelyEmpty, sheetLooksAssetLike } from "./datasource/text";
import {
  type DataSourceSheet,
  type DataSourceWorkbook,
  type SheetProfileDebug,
} from "./datasource/types";

export {
  INTERNAL,
  SOURCE_ASSET_ITEM_COLUMN,
  SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN,
  SOURCE_ASSET_NAME_COLUMN,
  SOURCE_ASSET_TYPE_COLUMN,
  SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN,
  SOURCE_EXCEL_ROW_COLUMN,
  SOURCE_PROFILE_COLUMN,
  SOURCE_ROW_INDEX_COLUMN,
  SOURCE_ROW_KEY_COLUMN,
  SOURCE_SHEET_NAME_COLUMN,
} from "./datasource/types";
export type {
  DataSourceSheet,
  DataSourceWorkbook,
  NormalizedSourceAssetRow,
  SheetEligibility,
  SheetParseDecision,
  SheetProfileDebug,
  SourceProfile,
} from "./datasource/types";
export { normalizeThaiDate } from "./datasource/date";
export { deriveStatus } from "./datasource/status";
export { looksLikeAssetItemGroup, looksLikeAssetTypeGroup } from "./datasource/text";

export function createDataSourceWorkbook(
  fileName: string,
  workbookSheets: { sheetName: string; matrix: any[][]; rowMeta?: WorkbookRowMeta[] }[],
): DataSourceWorkbook {
  const sheets: DataSourceSheet[] = [];
  const skippedSheets: string[] = [];
  const profileDebug: SheetProfileDebug[] = [];

  for (const workbookSheet of workbookSheets) {
    const { sheetName, matrix } = workbookSheet;
    const profileDetection = detectSheetProfile(matrix, sheetName);
    const profile = detectSourceProfile(sheetName, matrix, profileDetection);
    const flexibleLayout = profile === "FLEXIBLE_ASSET_TABLE" ? findFlexibleAssetLayout(matrix) : null;
    const effectiveConfidence = flexibleLayout?.confidence ?? profileDetection.confidence;
    const debug: SheetProfileDebug = {
      sheetName,
      ...profileDetection,
      reasons: flexibleLayout
        ? [...profileDetection.reasons, `matched flexible layout: ${flexibleLayout.kind}`]
        : profileDetection.reasons,
      shouldParse: profile !== "SUMMARY_SKIP",
      legacySourceProfile: profile,
      eligibility: "needsReview",
      decisionReason: "pending validation",
    };
    profileDebug.push(debug);

    if (isSheetEffectivelyEmpty(matrix)) {
      debug.shouldParse = false;
      debug.eligibility = "skipped";
      debug.decisionReason = "empty sheet";
      debug.skipReason = "empty sheet";
      skippedSheets.push(sheetName);
      continue;
    }

    if (profile === "SUMMARY_SKIP") {
      debug.shouldParse = false;
      debug.eligibility = "skipped";
      debug.decisionReason = `${profileDetection.profile} sheet is not an exportable asset table`;
      debug.skipReason = debug.decisionReason;
      skippedSheets.push(sheetName);
      continue;
    }

    if (profile === "UNKNOWN" && !sheetLooksAssetLike(matrix)) {
      debug.shouldParse = false;
      debug.eligibility = "skipped";
      debug.decisionReason = "unknown sheet does not contain an asset-like table";
      debug.skipReason = debug.decisionReason;
      skippedSheets.push(sheetName);
      continue;
    }

    const sheet =
      profile === "NEW_ASSET_2567"
        ? parseNewAssetSheet(sheetName, matrix)
        : profile === "ASSET_DATA"
          ? parseAssetDataSheet(sheetName, matrix)
        : profile === "REGISTER_3_ROW_HEADER"
          ? parseRegisterSheet(sheetName, matrix)
          : profile === "TRANSFER_2567"
            ? parseTransferSheet(sheetName, matrix)
            : profile === "FLEXIBLE_ASSET_TABLE" && flexibleLayout
              ? parseFlexibleAssetSheet(sheetName, matrix, flexibleLayout)
            : parseUnknownSheet(sheetName, matrix, workbookSheet.rowMeta);

    sheet.profileDebug = debug;
    sheet.confidence = effectiveConfidence;
    sheet.eligibility =
      profile === "UNKNOWN" || effectiveConfidence < 0.55 ? "needsReview" : "exportable";
    sheet.eligibilityReason =
      sheet.eligibility === "exportable"
        ? flexibleLayout
          ? `matched flexible ${flexibleLayout.kind} layout`
          : `matched ${profileDetection.profile} profile`
        : profile === "UNKNOWN"
          ? "unknown asset-like sheet requires manual review"
          : `profile confidence ${effectiveConfidence} is below export threshold`;
    debug.eligibility = sheet.eligibility;
    debug.decisionReason = sheet.eligibilityReason;

    if (sheet.rows.length === 0) {
      debug.shouldParse = false;
      debug.eligibility = "skipped";
      debug.decisionReason = "no parsed asset rows";
      debug.skipReason = "no parsed asset rows";
      skippedSheets.push(sheetName);
      continue;
    }
    appendDataQualityWarnings(sheet, matrix);
    sheets.push(sheet);
  }

  return { fileName, sheets, skippedSheets, profileDebug };
}

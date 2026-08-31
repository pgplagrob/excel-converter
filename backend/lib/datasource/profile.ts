import { detectSheetProfile, type SheetProfileDetection } from "../sheet-profile";
import { findFlexibleAssetLayout } from "./parsers/flexible";
import { findTransferHeaderRow } from "./parsers/transfer";
import { cellText, compactText, looksLikeAssetCode, rowContainsAny } from "./text";
import type { SourceProfile } from "./types";

function legacyProfileFromDetection(detection: SheetProfileDetection): SourceProfile | null {
  if (detection.profile === "summary") return "SUMMARY_SKIP";
  if (
    detection.profile === "help" ||
    detection.profile === "reference" ||
    detection.profile === "form" ||
    detection.profile === "template"
  ) {
    return "HELP_OR_TEMPLATE_SKIP";
  }
  if (detection.profile === "maintenance") return "REVIEW_MAINTENANCE";
  if (detection.profile === "assetData") return "ASSET_DATA";
  if (detection.profile === "newAsset") return "NEW_ASSET_2567";
  if (detection.profile === "transfer") return "TRANSFER_2567";
  if (detection.profile === "registry" || detection.profile === "disposal" || detection.profile === "realEstate") {
    return "REGISTER_3_ROW_HEADER";
  }
  return null;
}

export function detectSourceProfile(
  sheetName: string,
  matrix: any[][],
  profileDetection: SheetProfileDetection = detectSheetProfile(matrix, sheetName),
): SourceProfile {
  const flexibleLayout = findFlexibleAssetLayout(matrix);
  if (flexibleLayout?.kind === "standard-table") return "FLEXIBLE_ASSET_TABLE";

  const compactSheet = compactText(sheetName);

  const detectedProfile = legacyProfileFromDetection(profileDetection);
  if (detectedProfile) return detectedProfile;

  if (compactSheet.includes("help") || compactSheet.includes("reference") || compactSheet.includes("template")) {
    return "HELP_OR_TEMPLATE_SKIP";
  }
  if (compactSheet.includes("ครุภัณฑ์ใหม่2567")) return "NEW_ASSET_2567";
  if (compactSheet.includes("โอน2567") || compactSheet.includes("โอนอาคาร2567")) {
    return "TRANSFER_2567";
  }
  if (findTransferHeaderRow(matrix) >= 0) return "TRANSFER_2567";

  const firstRows = matrix.slice(0, 8);
  if (firstRows.some((row) => rowContainsAny(row, ["รหัสสินทรัพย์"]) && rowContainsAny(row, ["รายละเอียดสินทรัพย์"]))) {
    return "NEW_ASSET_2567";
  }
  if (firstRows.some((row) => rowContainsAny(row, ["AssetCode"]) && rowContainsAny(row, ["ModelName"]))) {
    return "ASSET_DATA";
  }
  if (firstRows.some((row) => rowContainsAny(row, ["รหัสครุภัณฑ์"]) && rowContainsAny(row, ["สภาพครุภัณฑ์"]))) {
    return "REGISTER_3_ROW_HEADER";
  }
  if (flexibleLayout) return "FLEXIBLE_ASSET_TABLE";
  if (matrix.some((row) => looksLikeAssetCode(row[2]) && cellText(row[1]))) {
    return "REGISTER_3_ROW_HEADER";
  }
  return "UNKNOWN";
}

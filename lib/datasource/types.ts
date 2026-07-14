import type { SheetProfileDetection } from "../sheet-profile";

export type SourceProfile =
  | "NEW_ASSET_2567"
  | "REGISTER_3_ROW_HEADER"
  | "TRANSFER_2567"
  | "ASSET_DATA"
  | "FLEXIBLE_ASSET_TABLE"
  | "HELP_OR_TEMPLATE_SKIP"
  | "SUMMARY_SKIP"
  | "REVIEW_MAINTENANCE"
  | "UNKNOWN";

export type SheetEligibility = "exportable" | "needsReview" | "unsupported" | "skipped";

export interface SheetParseDecision {
  eligibility: SheetEligibility;
  reason: string;
  confidence: number;
  issues: string[];
}

export type SheetProfileDebug = SheetProfileDetection & {
  sheetName: string;
  shouldParse: boolean;
  legacySourceProfile: SourceProfile;
  eligibility: SheetEligibility;
  decisionReason: string;
  skipReason?: string;
};

export interface GroupedAssetDebug {
  sourceRowIndex: number;
  excelRow: number;
  sourceAssetName: string;
  sourceAssetType: string;
  sourceAssetTypeEmitOnce?: boolean;
  firstAssetCode?: string;
  firstSequence?: string;
}

export interface DataSourceSheet {
  sheetName: string;
  sourceProfile: SourceProfile;
  profileDebug?: SheetProfileDebug;
  headerRowIndex: number;
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
  eligibility: SheetEligibility;
  eligibilityReason: string;
  confidence: number;
  groupedAssets: GroupedAssetDebug[];
  warnings: string[];
}

export interface DataSourceWorkbook {
  fileName: string;
  sheets: DataSourceSheet[];
  skippedSheets: string[];
  profileDebug: SheetProfileDebug[];
}

export const SOURCE_PROFILE_COLUMN = "__sourceProfile";
export const SOURCE_SHEET_NAME_COLUMN = "__sheetName";
export const SOURCE_EXCEL_ROW_COLUMN = "__excelRow";
export const SOURCE_ROW_INDEX_COLUMN = "__sourceRowIndex";
export const SOURCE_ROW_KEY_COLUMN = "__rowKey";
export const SOURCE_ASSET_TYPE_COLUMN = "sourceAssetType";
export const SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN = "__sourceAssetTypeEmitOnce";
export const SOURCE_ASSET_ITEM_COLUMN = "sourceAssetItem";
export const SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN = "__sourceAssetItemEmitOnce";
export const SOURCE_ASSET_NAME_COLUMN = "sourceAssetName";

export type NormalizedSourceAssetRow = {
  __sourceProfile: string;
  __sheetName: string;
  __excelRow: number;
  __sourceRowIndex: number;
  __rowKey: string;
  assetCode: string;
  assetName: string;
  assetDetail?: string;
  sourceAssetType?: string;
  __sourceAssetTypeEmitOnce?: boolean;
  sourceAssetItem?: string;
  __sourceAssetItemEmitOnce?: boolean;
  receivedDate?: unknown;
  value?: unknown;
  responsibleUnit?: string;
  location?: string;
  acquiredBy?: string;
  acquiredFrom?: string;
  budgetSource?: string;
  note?: string;
  statusNormal?: unknown;
  statusBroken?: unknown;
  statusDeteriorated?: unknown;
  statusLost?: unknown;
  statusStoredLong?: unknown;
  statusUnnecessary?: unknown;
};

export const INTERNAL = {
  seq: "__seq",
  assetCode: "__assetCode",
  assetName: "__assetName",
  detail: "__detail",
  receivedDate: "__receivedDate",
  value: "__value",
  acquiredBy: "__acquiredBy",
  acquiredFrom: "__acquiredFrom",
  budgetSource: "__budgetSource",
  location: "__location",
  responsibleUnit: "__responsibleUnit",
  note: "__note",
  status: "__status",
  assetCategory: "__assetCategory",
  depreciationFlag: "__depreciationFlag",
  needCount: "__needCount",
  importantFlag: "__importantFlag",
} as const;

export const NORMALIZED_FIELD_HEADERS = [
  "assetCode",
  "assetName",
  "assetDetail",
  "receivedDate",
  "value",
  "responsibleUnit",
  "location",
  "acquiredBy",
  "acquiredFrom",
  "budgetSource",
  "note",
  "statusNormal",
  "statusBroken",
  "statusDeteriorated",
  "statusLost",
  "statusStoredLong",
  "statusUnnecessary",
];

export const REGISTER_HEADERS = [
  "seq",
  "itemName",
  "assetCode",
  "receivedDate",
  "value",
  "responsibleUnit",
  "statusNormal",
  "statusBroken",
  "statusDeteriorated",
  "statusLost",
  "statusStoredLong",
  "statusUnnecessary",
  "note",
];

export type FlexibleAssetLayout =
  | { kind: "standard-table"; confidence: number; headerRowIndex: number }
  | { kind: "department-positional"; confidence: number; headerRowIndex: number }
  | { kind: "split-code-positional"; confidence: number; headerRowIndex: number }
  | { kind: "consolidated-positional"; confidence: number; headerRowIndex: number }
  | { kind: "simple-list"; confidence: number; headerRowIndex: number };

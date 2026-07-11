"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRowsToTemplateDataset = transformRowsToTemplateDataset;
const mapping_1 = require("./mapping");
const datasource_1 = require("./datasource");
function cellText(value) {
    return value === undefined || value === null ? "" : value.toString().trim();
}
const ASSET_NAME_COLUMN = "ชื่อสินทรัพย์";
const ASSET_DETAIL_COLUMN = "รายละเอียด";
const ASSET_TYPE_COLUMN = "ชนิดสินทรัพย์";
const ASSET_ITEM_COLUMN = "รายการสินทรัพย์";
const AUTHORITATIVE_TEMPLATE_COLUMNS = new Set([
    ASSET_NAME_COLUMN,
    ASSET_DETAIL_COLUMN,
    ASSET_TYPE_COLUMN,
    ASSET_ITEM_COLUMN,
]);
function emptyTemplateRow() {
    const row = {};
    for (const column of mapping_1.TEMPLATE_COLUMNS)
        row[column] = "";
    return row;
}
function isKnownProfile(profile) {
    return (profile === "NEW_ASSET_2567" ||
        profile === "REGISTER_3_ROW_HEADER" ||
        profile === "TRANSFER_2567" ||
        profile === "ASSET_DATA");
}
function firstText(...values) {
    for (const value of values) {
        const text = cellText(value);
        if (text)
            return text;
    }
    return "";
}
function cleanMoneyValue(value) {
    const text = cellText(value);
    if (!text)
        return "";
    if (/^[\s\-–—]+$/.test(text))
        return "";
    return value;
}
function sourceValue(sourceRow, publicField, internalField) {
    const publicValue = sourceRow[publicField];
    return cellText(publicValue) ? publicValue : sourceRow[internalField];
}
function startsWithMainAssetType(value) {
    const text = cellText(value);
    return ((0, datasource_1.looksLikeAssetTypeGroup)(text) ||
        text.startsWith("สินทรัพย์") ||
        text.startsWith("à¸„à¸£à¸¸à¸ à¸±à¸“à¸‘à¹Œ") ||
        text.startsWith("à¸­à¸ªà¸±à¸‡à¸«à¸²à¸£à¸´à¸¡à¸—à¸£à¸±à¸žà¸¢à¹Œ"));
}
function isGroupOrCategoryLabel(value) {
    return (0, datasource_1.looksLikeAssetItemGroup)(value) || startsWithMainAssetType(value);
}
function normalizedAssetFields(sourceRow) {
    let sourceAssetType = cellText(sourceRow[datasource_1.SOURCE_ASSET_TYPE_COLUMN]);
    let sourceAssetItem = cellText(sourceRow[datasource_1.SOURCE_ASSET_ITEM_COLUMN]);
    const assetCode = firstText(sourceRow.assetCode, sourceRow[datasource_1.INTERNAL.assetCode]);
    let assetName = firstText(sourceRow.assetName, sourceRow[datasource_1.INTERNAL.assetName], sourceRow[datasource_1.SOURCE_ASSET_NAME_COLUMN]);
    let assetDetail = firstText(sourceRow.assetDetail, sourceRow[datasource_1.INTERNAL.detail]);
    if ((0, datasource_1.looksLikeAssetItemGroup)(assetName)) {
        if (!sourceAssetItem) {
            sourceAssetItem = assetName;
            sourceRow[datasource_1.SOURCE_ASSET_ITEM_COLUMN] = sourceAssetItem;
        }
        assetName = "";
    }
    if (!assetCode && startsWithMainAssetType(assetName)) {
        if (!sourceAssetType) {
            sourceAssetType = assetName;
            sourceRow[datasource_1.SOURCE_ASSET_TYPE_COLUMN] = sourceAssetType;
        }
        assetName = "";
    }
    if (assetName && sourceAssetItem && assetName === sourceAssetItem) {
        assetName = "";
    }
    if (isGroupOrCategoryLabel(assetDetail) ||
        (sourceAssetItem && assetDetail === sourceAssetItem) ||
        (sourceAssetType && assetDetail === sourceAssetType)) {
        assetDetail = "";
    }
    return {
        assetName,
        assetDetail,
        sourceAssetType,
        sourceAssetItem,
    };
}
function sourceAssetItemShouldEmit(sourceRow) {
    return sourceRow[datasource_1.SOURCE_ASSET_ITEM_EMIT_ONCE_COLUMN] === true;
}
function sourceAssetTypeShouldEmit(sourceRow) {
    const emitOnce = sourceRow[datasource_1.SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN];
    if (emitOnce === false)
        return false;
    if (emitOnce === true)
        return true;
    return Boolean(cellText(sourceRow[datasource_1.SOURCE_ASSET_TYPE_COLUMN]));
}
function hasAssetTypeEmitFlag(sourceRow) {
    const emitOnce = sourceRow[datasource_1.SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN];
    return emitOnce === true || emitOnce === false;
}
function backfillRegisterAssetTypeEmitFlags(rows) {
    let previousAssetType = "";
    return rows.map((sourceRow) => {
        const profile = cellText(sourceRow[datasource_1.SOURCE_PROFILE_COLUMN]);
        const sourceAssetType = cellText(sourceRow[datasource_1.SOURCE_ASSET_TYPE_COLUMN]);
        if (profile !== "REGISTER_3_ROW_HEADER" || !sourceAssetType)
            return sourceRow;
        if (hasAssetTypeEmitFlag(sourceRow)) {
            previousAssetType = sourceAssetType;
            return sourceRow;
        }
        const shouldEmit = sourceAssetType !== previousAssetType;
        previousAssetType = sourceAssetType;
        return {
            ...sourceRow,
            [datasource_1.SOURCE_ASSET_TYPE_EMIT_ONCE_COLUMN]: shouldEmit,
        };
    });
}
function deriveAssetCategory(sourceRow, sourceAssetType) {
    if (!sourceAssetType)
        return "";
    const explicitCategory = cellText(sourceRow[datasource_1.INTERNAL.assetCategory]);
    if (explicitCategory)
        return explicitCategory;
    return sourceAssetType.includes("อสังหาริมทรัพย์") || sourceAssetType.includes("อาคาร")
        ? "อสังหาริมทรัพย์"
        : "ครุภัณฑ์";
}
function applyAuthoritativeAssetFields(templateRow, sourceRow) {
    const normalized = normalizedAssetFields(sourceRow);
    const visibleSourceAssetType = sourceAssetTypeShouldEmit(sourceRow) ? normalized.sourceAssetType : "";
    templateRow[ASSET_NAME_COLUMN] = normalized.assetName || "";
    templateRow[ASSET_DETAIL_COLUMN] = normalized.assetDetail || "";
    templateRow[ASSET_TYPE_COLUMN] = visibleSourceAssetType;
    templateRow[ASSET_ITEM_COLUMN] = sourceAssetItemShouldEmit(sourceRow) ? normalized.sourceAssetItem || "" : "";
}
function mapProfileRow(sourceRow, profile) {
    const row = emptyTemplateRow();
    const normalized = normalizedAssetFields(sourceRow);
    const sourceAssetType = normalized.sourceAssetType;
    const sourceAssetItem = normalized.sourceAssetItem;
    const visibleSourceAssetType = sourceAssetTypeShouldEmit(sourceRow) ? sourceAssetType : "";
    const assetCode = sourceValue(sourceRow, "assetCode", datasource_1.INTERNAL.assetCode) ?? "";
    const assetName = normalized.assetName;
    const assetDetail = normalized.assetDetail;
    row["รหัสสินทรัพย์"] = assetCode;
    row[ASSET_NAME_COLUMN] = assetName;
    row[ASSET_DETAIL_COLUMN] = assetDetail;
    row["ประเภทสินทรัพย์"] = deriveAssetCategory(sourceRow, visibleSourceAssetType);
    row[ASSET_TYPE_COLUMN] = visibleSourceAssetType;
    row[ASSET_ITEM_COLUMN] = sourceAssetItemShouldEmit(sourceRow) ? sourceAssetItem : "";
    row["มูลค่า"] = cleanMoneyValue(sourceValue(sourceRow, "value", datasource_1.INTERNAL.value));
    row["วันที่ได้รับ"] = sourceValue(sourceRow, "receivedDate", datasource_1.INTERNAL.receivedDate) ?? "";
    row["งานที่รับผิดชอบ"] = sourceValue(sourceRow, "responsibleUnit", datasource_1.INTERNAL.responsibleUnit) ?? "";
    row["สถานะ"] = sourceRow[datasource_1.INTERNAL.status] ?? "";
    row["ต้องตรวจนับ"] = sourceRow[datasource_1.INTERNAL.needCount] ?? "";
    row["คิดค่าเสื่อม"] = sourceRow[datasource_1.INTERNAL.depreciationFlag] ?? "";
    row["ของสำคัญ"] = sourceRow[datasource_1.INTERNAL.importantFlag] ?? "";
    if (profile === "NEW_ASSET_2567") {
        row["ได้มาโดย"] = sourceValue(sourceRow, "acquiredBy", datasource_1.INTERNAL.acquiredBy) ?? "";
        row["อาคาร"] = sourceValue(sourceRow, "location", datasource_1.INTERNAL.location) ?? "";
        row["ระบุอื่น ๆ"] = sourceValue(sourceRow, "note", datasource_1.INTERNAL.note) ?? "";
    }
    if (profile === "REGISTER_3_ROW_HEADER") {
        row["ระบุอื่น ๆ"] = sourceValue(sourceRow, "note", datasource_1.INTERNAL.note) ?? "";
        row["ประเภทสินทรัพย์"] = deriveAssetCategory(sourceRow, visibleSourceAssetType);
    }
    if (profile === "TRANSFER_2567" || profile === "ASSET_DATA") {
        row[ASSET_DETAIL_COLUMN] = assetDetail;
        row["ได้มาจาก"] = sourceValue(sourceRow, "acquiredFrom", datasource_1.INTERNAL.acquiredFrom) ?? "";
        row["แหล่งงบประมาณ"] = sourceValue(sourceRow, "budgetSource", datasource_1.INTERNAL.budgetSource) ?? "";
        row["อาคาร"] = sourceValue(sourceRow, "location", datasource_1.INTERNAL.location) ?? "";
        row["สถานะ"] = sourceRow[datasource_1.INTERNAL.status] || "ปกติ";
    }
    applyAuthoritativeAssetFields(row, sourceRow);
    return row;
}
function normalizeFullDateText(value) {
    const normalized = (0, datasource_1.normalizeThaiDate)(value);
    return normalized || null;
}
function buildDateFromSourceColumns(sourceRow, sourceColumn) {
    const value = sourceRow[sourceColumn] ?? "";
    const fullDate = normalizeFullDateText(value);
    if (fullDate)
        return fullDate;
    const keys = Object.keys(sourceRow);
    const sourceIndex = keys.indexOf(sourceColumn);
    if (sourceIndex < 0)
        return value;
    const combinedDate = (0, datasource_1.normalizeThaiDate)(sourceRow[keys[sourceIndex]], sourceRow[keys[sourceIndex + 1]], sourceRow[keys[sourceIndex + 2]]);
    return combinedDate || value;
}
const DATE_COLUMNS = new Set([
    "วันที่ได้รับ",
    "วันที่ได้รับโอน",
    "วันที่ออกจำหน่าย",
    "วันที่เริ่มรับประกัน",
    "วันที่หมดประกัน",
    "ณ วันที่ (ค่าเสื่อมยกมา)",
]);
function resolveFallbackValue(sourceRow, templateColumn, sourceColumn) {
    if (!sourceColumn)
        return "";
    return DATE_COLUMNS.has(templateColumn)
        ? buildDateFromSourceColumns(sourceRow, sourceColumn)
        : sourceRow[sourceColumn] ?? "";
}
function mapFallbackRow(sourceRow, mapping) {
    const templateRow = emptyTemplateRow();
    for (const templateColumn of mapping_1.TEMPLATE_COLUMNS) {
        if (AUTHORITATIVE_TEMPLATE_COLUMNS.has(templateColumn))
            continue;
        templateRow[templateColumn] = resolveFallbackValue(sourceRow, templateColumn, mapping[templateColumn]);
    }
    const normalized = normalizedAssetFields(sourceRow);
    const sourceAssetType = normalized.sourceAssetType;
    const sourceAssetItem = normalized.sourceAssetItem;
    const visibleSourceAssetType = sourceAssetTypeShouldEmit(sourceRow) ? sourceAssetType : "";
    const assetCode = cellText(sourceRow.assetCode);
    const assetName = normalized.assetName;
    const assetDetail = normalized.assetDetail;
    if (assetCode || assetName || assetDetail || sourceAssetType || sourceAssetItem) {
        templateRow["รหัสสินทรัพย์"] = assetCode || templateRow["รหัสสินทรัพย์"] || "";
        templateRow["ประเภทสินทรัพย์"] = deriveAssetCategory(sourceRow, visibleSourceAssetType);
        templateRow["มูลค่า"] = cleanMoneyValue(sourceRow.value ?? templateRow["มูลค่า"]);
        templateRow["วันที่ได้รับ"] = sourceRow.receivedDate ?? templateRow["วันที่ได้รับ"] ?? "";
    }
    applyAuthoritativeAssetFields(templateRow, sourceRow);
    return templateRow;
}
function transformRowsToTemplateDataset(rows, mapping) {
    const rowsWithEmitFlags = backfillRegisterAssetTypeEmitFlags(rows);
    return rowsWithEmitFlags.map((sourceRow) => {
        const profile = cellText(sourceRow[datasource_1.SOURCE_PROFILE_COLUMN]);
        if (isKnownProfile(profile))
            return mapProfileRow(sourceRow, profile);
        return mapFallbackRow(sourceRow, mapping);
    });
}

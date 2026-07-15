"use client";

import { useMemo, useState } from "react";
import type { MappingSuggestion, SheetData } from "@/lib/client-types";
import {
  applyManualMappingPreview,
  effectiveSourceColumn,
  hasManualOverride,
  type ManualMapping,
} from "@/lib/manual-mapping";
import { displaySourceColumnLabel, displaySourceColumnWithOriginal } from "./display";

interface MappingSummaryProps {
  sheet: SheetData;
  sheetMap: ManualMapping;
  visibleMappings: MappingSuggestion[];
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  updateMapping: (
    sheetName: string,
    templateColumn: string,
    sourceColumn: string | null | undefined,
  ) => void;
}

const AUTO_VALUE = "__MANUAL_MAPPING_AUTO__";
const BLANK_VALUE = "__MANUAL_MAPPING_BLANK__";
const CORE_PREVIEW_COLUMNS = [
  "รหัสสินทรัพย์",
  "ชื่อสินทรัพย์",
  "รายละเอียด",
  "ประเภทสินทรัพย์",
  "ชนิดสินทรัพย์",
  "รายการสินทรัพย์",
  "มูลค่า",
];

function mappedValuePreview(sheet: SheetData, sourceColumn: string): string {
  if (!sourceColumn) return "จะส่งออกเป็นช่องว่าง";
  const value = sheet.rows
    .map((row) => row[sourceColumn])
    .find((item) => item !== "" && item !== undefined && item !== null);
  if (value === undefined) return "ไม่พบค่าตัวอย่างใน 30 แถวแรก";
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export function MappingSummary({
  sheet,
  sheetMap,
  visibleMappings,
  advancedOpen,
  setAdvancedOpen,
  updateMapping,
}: MappingSummaryProps) {
  const [searchText, setSearchText] = useState("");
  const normalizedSearch = searchText.trim().toLocaleLowerCase();
  const filteredMappings = visibleMappings.filter((mapping) => {
    if (!normalizedSearch) return true;
    return [mapping.templateColumn, mapping.sourceColumn || "", displaySourceColumnLabel(mapping.sourceColumn)]
      .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  });
  const sourceBoundary = sheet.headers.indexOf("__sourceProfile");
  const originalSourceColumns = sourceBoundary >= 0
    ? sheet.headers.slice(0, sourceBoundary)
    : sheet.headers;
  const parsedSourceColumns = (sourceBoundary >= 0 ? sheet.headers.slice(sourceBoundary + 1) : [])
    .filter((header) => !header.startsWith("__") && !originalSourceColumns.includes(header));
  const templatePreviewRows = useMemo(
    () => applyManualMappingPreview(
      sheet.templateSampleRows || [],
      sheet.rows,
      sheetMap,
    ).slice(0, 5),
    [sheet.templateSampleRows, sheet.rows, sheetMap],
  );
  const previewColumns = [
    ...CORE_PREVIEW_COLUMNS,
    ...Object.keys(sheetMap).filter((column) => !CORE_PREVIEW_COLUMNS.includes(column)),
  ];

  return (
    <>
      <h3>Mapping Summary</h3>
      <div className="table-wrap compact">
        <table>
          <thead>
            <tr>
              <th>Template Column</th>
              <th>Source Column</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleMappings.map((mapping) => (
              <tr key={mapping.templateColumn}>
                <td>{mapping.templateColumn}</td>
                <td>
                  {mapping.sourceColumn ? (
                    <span title={mapping.sourceColumn}>
                      {displaySourceColumnLabel(mapping.sourceColumn)}
                    </span>
                  ) : (
                    <span className="muted-text">ไม่พบคอลัมน์</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${mapping.confidence}`}>{mapping.confidence}</span>
                </td>
                <td>
                  <span className={`badge ${mapping.status}`}>{mapping.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="advanced-box mt-6 rounded-lg border p-4">
        <button className="btn secondary " onClick={() => setAdvancedOpen(!advancedOpen)}>
          {advancedOpen ? "ซ่อน Advanced Mapping" : "แก้ไขการจับคู่คอลัมน์"}
        </button>
        {advancedOpen && (
          <>
            <p className="hint">
              Manual จะคัดลอกค่าทั้งเซลล์จากคอลัมน์ที่เลือกโดยไม่แก้ข้อความ สามารถคืนค่า Auto
              หรือเลือกบังคับให้ว่างได้อย่างชัดเจน
            </p>
            <div className="manual-mapping">
              <div className="mapping-toolbar">
                <label htmlFor={`mapping-search-${sheet.sheetName}`}>ค้นหาคอลัมน์</label>
                <input
                  id={`mapping-search-${sheet.sheetName}`}
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="เช่น ชื่อสินทรัพย์ หรือ รายละเอียด"
                />
                <span>{filteredMappings.length} / {visibleMappings.length} คอลัมน์</span>
              </div>
              {filteredMappings.map((mapping) => {
                const isManual = hasManualOverride(sheetMap, mapping.templateColumn);
                const manualSource = sheetMap[mapping.templateColumn];
                const current = isManual
                  ? manualSource === null ? BLANK_VALUE : manualSource
                  : AUTO_VALUE;
                const effectiveSource = effectiveSourceColumn(
                  mapping.status === "manual" ? null : mapping.sourceColumn,
                  sheetMap,
                  mapping.templateColumn,
                );
                const preview = mappedValuePreview(sheet, effectiveSource || "");
                return (
                  <div className="map-row" key={mapping.templateColumn}>
                    <div className="tmpl-col">{mapping.templateColumn}</div>
                    <div className="arrow">→</div>
                    <div>
                      <select
                        value={current}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateMapping(
                            sheet.sheetName,
                            mapping.templateColumn,
                            value === AUTO_VALUE ? undefined : value === BLANK_VALUE ? null : value,
                          );
                        }}
                      >
                        <option value={AUTO_VALUE}>ใช้ค่าระบบอัตโนมัติ</option>
                        <option value={BLANK_VALUE}>บังคับให้ช่องนี้ว่าง</option>
                        <optgroup label="คอลัมน์ต้นฉบับ">
                          {originalSourceColumns.map((header) => (
                            <option key={header} value={header}>
                              {displaySourceColumnWithOriginal(header)}
                            </option>
                          ))}
                        </optgroup>
                        {parsedSourceColumns.length > 0 && (
                          <optgroup label="ค่าที่ระบบอ่านจากโครงสร้างไฟล์">
                            {parsedSourceColumns.map((header) => (
                              <option key={header} value={header}>
                                {displaySourceColumnWithOriginal(header)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <div className="mapping-preview">
                        {isManual
                          ? manualSource === null
                            ? "Manual: ส่งออกเป็นช่องว่าง"
                            : `Manual: คัดลอกจาก ${displaySourceColumnLabel(manualSource)}`
                          : mapping.sourceColumn
                            ? `Auto: ${displaySourceColumnLabel(mapping.sourceColumn)}`
                            : "Auto: ใช้ค่าที่ parser อ่านได้ หรือเว้นว่าง"}
                        {effectiveSource && ` · ตัวอย่าง: ${preview}`}
                      </div>
                    </div>
                    <div className="mapping-actions">
                      <span className={`badge ${isManual ? "manual" : mapping.method}`}>
                        {isManual ? "manual" : mapping.method}
                      </span>
                      {isManual && (
                        <button
                          type="button"
                          className="map-reset"
                          onClick={() => updateMapping(sheet.sheetName, mapping.templateColumn, undefined)}
                        >
                          คืนค่า Auto
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {templatePreviewRows.length > 0 && (
              <div className="template-mapping-preview">
                <h4>Template Preview หลัง Mapping</h4>
                <p className="hint">
                  ตารางนี้คือค่าที่จะออกใน Template ส่วน Source Preview ด้านบนเป็นข้อมูลต้นฉบับและจะไม่เปลี่ยน
                </p>
                <div className="table-wrap compact">
                  <table>
                    <thead>
                      <tr>
                        <th>แถวต้นฉบับ</th>
                        {previewColumns.map((column) => (
                          <th key={column} className={hasManualOverride(sheetMap, column) ? "manual-column" : undefined}>
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {templatePreviewRows.map((row, index) => (
                        <tr key={String(sheet.rows[index]?.__rowKey || index)}>
                          <td>{sheet.rows[index]?.__excelRow || index + 1}</td>
                          {previewColumns.map((column) => {
                            const value = row[column];
                            return (
                              <td key={column} title={value === undefined || value === null ? "" : String(value)}>
                                {value === "" || value === undefined || value === null ? "—" : String(value)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

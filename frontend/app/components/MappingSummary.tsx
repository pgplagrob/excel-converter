"use client";

import { useMemo, useState } from "react";
import type { MappingSuggestion, SheetData } from "@/lib/client-types";
import {
  applyManualMappingPreview,
  hasManualOverride,
  type ManualMapping,
} from "@/lib/manual-mapping";
import {
  assignSourceDestination,
  buildSourceFirstMappings,
  destinationOwners,
  filterSourceFirstMappings,
  resetSourceToSuggestions,
  type SourceMappingFilter,
  type SourceMappingStatus,
} from "@/lib/source-first-mapping";
import { displaySourceColumnLabel } from "./display";

interface MappingSummaryProps {
  sheet: SheetData;
  sheetMap: ManualMapping;
  visibleMappings: VisibleMapping[];
  advancedOpen?: boolean;
  setAdvancedOpen: (open: boolean) => void;
  updateMapping: (
    sheetName: string,
    templateColumn: string,
    sourceColumn: string | null | undefined,
  ) => void;
}

type VisibleMapping = MappingSuggestion & {
  originalIndex: number;
  autoSourceColumn: string | null;
};

const MULTIPLE_DESTINATIONS = "__MULTIPLE_DESTINATIONS__";
const UNRESOLVED_DESTINATION = "__UNRESOLVED_DESTINATION__";
const CORE_PREVIEW_COLUMNS = [
  "รหัสสินทรัพย์",
  "ชื่อสินทรัพย์",
  "รายละเอียด",
  "ประเภทสินทรัพย์",
  "ชนิดสินทรัพย์",
  "รายการสินทรัพย์",
  "มูลค่า",
];
const FILTERS: { value: SourceMappingFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "unresolved", label: "ยังไม่ได้ระบุปลายทาง" },
  { value: "suggested", label: "ระบบแนะนำ" },
  { value: "manual", label: "คุณเลือกเอง" },
];
const STATUS_LABELS: Record<SourceMappingStatus, string> = {
  unresolved: "ยังไม่ได้ระบุปลายทาง",
  suggested: "ระบบแนะนำ",
  manual: "คุณเลือกเอง",
};

function parserAutoDescription(sheet: SheetData, templateColumn: string): string | null {
  if (!["ชื่อสินทรัพย์", "รายละเอียด", "ชนิดสินทรัพย์", "รายการสินทรัพย์"]
    .includes(templateColumn)) {
    return null;
  }
  return sheet.templateSampleRows?.some((row) => {
    const value = row[templateColumn];
    return value !== "" && value !== undefined && value !== null;
  })
    ? "ระบบอ่านจากโครงสร้างไฟล์"
    : null;
}

function truncateSample(value: string): string {
  return value.length > 72 ? `${value.slice(0, 69)}...` : value;
}

export function MappingSummary({
  sheet,
  sheetMap,
  visibleMappings,
  advancedOpen,
  setAdvancedOpen,
  updateMapping,
}: MappingSummaryProps) {
  const [destinationViewOpen, setDestinationViewOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<SourceMappingFilter>("all");
  const sourceMappings = useMemo(
    () => buildSourceFirstMappings(sheet, sheetMap),
    [sheet, sheetMap],
  );
  const destinationMappings = useMemo(
    () => [...visibleMappings].sort((left, right) => left.originalIndex - right.originalIndex),
    [visibleMappings],
  );
  const owners = useMemo(() => destinationOwners(sourceMappings), [sourceMappings]);
  const hasUnresolved = sourceMappings.some((mapping) => mapping.status === "unresolved");
  const isAdvancedOpen = advancedOpen ?? hasUnresolved;
  const filteredSources = filterSourceFirstMappings(sourceMappings, filter, searchText);
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
  const mappedCount = visibleMappings.filter(
    (mapping) => mapping.sourceColumn || (
      !hasManualOverride(sheetMap, mapping.templateColumn)
      && parserAutoDescription(sheet, mapping.templateColumn)
    ),
  ).length;

  return (
    <>
      <h3>สรุปการจับคู่คอลัมน์</h3>
      <div className="mapping-summary-toggle">
        <span>
          ระบุปลายทางแล้ว <strong>{mappedCount}/{visibleMappings.length}</strong> ช่องผลลัพธ์
        </span>
        <button
          type="button"
          className="btn secondary"
          aria-expanded={destinationViewOpen}
          onClick={() => setDestinationViewOpen(!destinationViewOpen)}
        >
          {destinationViewOpen
            ? `ซ่อนมุมมอง ${destinationMappings.length} ช่องผลลัพธ์`
            : `ดูตาม ${destinationMappings.length} ช่องผลลัพธ์`}
        </button>
      </div>
      {destinationViewOpen && (
        <div className="table-wrap compact">
          <table>
            <thead>
              <tr>
                <th>ช่องในไฟล์ผลลัพธ์</th>
                <th>คอลัมน์จากไฟล์ต้นฉบับ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {destinationMappings.map((mapping) => {
                const isManual = hasManualOverride(sheetMap, mapping.templateColumn);
                const parserAuto = isManual
                  ? null
                  : parserAutoDescription(sheet, mapping.templateColumn);
                return (
                  <tr key={mapping.templateColumn}>
                    <td>{mapping.templateColumn}</td>
                    <td>
                      {mapping.sourceColumn
                        ? displaySourceColumnLabel(mapping.sourceColumn)
                        : parserAuto || <span className="muted-text">เว้นว่างตามต้นฉบับ</span>}
                    </td>
                    <td>
                      <span className={`source-mapping-badge ${isManual ? "manual" : mapping.sourceColumn || parserAuto ? "suggested" : "unresolved"}`}>
                        {isManual ? "คุณเลือกเอง" : mapping.sourceColumn || parserAuto ? "ระบบแนะนำ" : "ยังไม่ได้ระบุ"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="advanced-box mt-6 rounded-lg border p-4">
        <button
          type="button"
          className="btn secondary"
          aria-expanded={isAdvancedOpen}
          onClick={() => setAdvancedOpen(!isAdvancedOpen)}
        >
          {isAdvancedOpen ? "ซ่อน Advanced Mapping" : "แก้ไขการจับคู่คอลัมน์"}
        </button>
        {isAdvancedOpen && (
          <>
            <p className="hint">
              เริ่มจากคอลัมน์ในไฟล์ต้นฉบับ แล้วเลือกช่องปลายทางในไฟล์ผลลัพธ์ ระบบจะส่ง contract เดิมในรูปแบบช่องผลลัพธ์ → คอลัมน์ต้นฉบับ
            </p>
            <div className="manual-mapping source-first-mapping">
              <div className="mapping-toolbar source-first-toolbar">
                <div>
                  <label htmlFor={`mapping-search-${sheet.sheetName}`}>ค้นหาคอลัมน์หรือปลายทาง</label>
                  <input
                    id={`mapping-search-${sheet.sheetName}`}
                    type="search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="เช่น เลขครุภัณฑ์ หรือ รหัสสินทรัพย์"
                  />
                </div>
                <div>
                  <label htmlFor={`mapping-filter-${sheet.sheetName}`}>กรองสถานะ</label>
                  <select
                    id={`mapping-filter-${sheet.sheetName}`}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as SourceMappingFilter)}
                  >
                    {FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <span>{filteredSources.length} / {sourceMappings.length} คอลัมน์ต้นฉบับ</span>
              </div>

              {filteredSources.length === 0 && (
                <div className="mapping-empty">ไม่พบคอลัมน์ที่ตรงกับคำค้นหาและตัวกรองนี้</div>
              )}
              {filteredSources.map((source, sourceIndex) => {
                const selectValue = source.templateColumns.length === 0
                  ? UNRESOLVED_DESTINATION
                  : source.templateColumns.length === 1
                    ? source.templateColumns[0]
                    : MULTIPLE_DESTINATIONS;
                const resetUpdates = resetSourceToSuggestions(
                  source,
                  sheet.mapping,
                  sheetMap,
                );
                const describedBy = `mapping-reason-${sourceIndex}`;
                return (
                  <article className={`source-map-row ${source.status}`} key={source.sourceColumn}>
                    <div className="source-map-column">
                      <span className="source-map-label">
                        {source.sourceKind === "parser"
                          ? "ค่าที่ระบบอ่านจากโครงสร้างไฟล์"
                          : "คอลัมน์จากไฟล์ต้นฉบับ"}
                      </span>
                      <strong title={source.sourceColumn}>{displaySourceColumnLabel(source.sourceColumn)}</strong>
                      <span className="source-map-original">{source.sourceColumn}</span>
                    </div>
                    <div className="source-map-samples">
                      <span className="source-map-label">ตัวอย่างค่าจริง</span>
                      <ul>
                        {source.sampleValues.map((sample) => (
                          <li key={sample} title={sample}>{truncateSample(sample)}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="source-map-destination">
                      <label htmlFor={`mapping-destination-${sourceIndex}`}>ช่องในไฟล์ผลลัพธ์</label>
                      <select
                        id={`mapping-destination-${sourceIndex}`}
                        value={selectValue}
                        aria-describedby={describedBy}
                        onChange={(event) => {
                          const templateColumn = event.target.value;
                          if (templateColumn === UNRESOLVED_DESTINATION
                            || templateColumn === MULTIPLE_DESTINATIONS) return;
                          assignSourceDestination(
                            source,
                            templateColumn,
                            sheet.mapping,
                            sheetMap,
                          ).forEach((update) => updateMapping(
                            sheet.sheetName,
                            update.templateColumn,
                            update.sourceColumn,
                          ));
                        }}
                      >
                        {source.templateColumns.length === 0 && (
                          <option value={UNRESOLVED_DESTINATION} disabled>เลือกช่องปลายทาง</option>
                        )}
                        {source.templateColumns.length > 1 && (
                          <option value={MULTIPLE_DESTINATIONS} disabled>
                            Parser ใช้ {source.templateColumns.length} ช่อง: {source.templateColumns.join(", ")}
                          </option>
                        )}
                        {destinationMappings.map((mapping) => {
                          const owner = owners.get(mapping.templateColumn);
                          const usedByAnotherSource = Boolean(owner && owner !== source.sourceColumn);
                          return (
                            <option
                              key={mapping.templateColumn}
                              value={mapping.templateColumn}
                              disabled={usedByAnotherSource}
                            >
                              {mapping.templateColumn}{usedByAnotherSource ? ` — ใช้อยู่กับ ${displaySourceColumnLabel(owner || "")}` : ""}
                            </option>
                          );
                        })}
                      </select>
                      {source.templateColumns.length > 1 && (
                        <div className="parser-rule">
                          กติกา Parser เดิม: {source.templateColumns.join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="source-map-state">
                      <span className={`source-mapping-badge ${source.status}`}>
                        {STATUS_LABELS[source.status]}
                      </span>
                      <p id={describedBy}>{source.reason}</p>
                      {resetUpdates.length > 0 && (
                        <button
                          type="button"
                          className="map-reset"
                          onClick={() => resetUpdates.forEach((update) => updateMapping(
                            sheet.sheetName,
                            update.templateColumn,
                            update.sourceColumn,
                          ))}
                        >
                          คืนค่าระบบแนะนำ
                        </button>
                      )}
                    </div>
                  </article>
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

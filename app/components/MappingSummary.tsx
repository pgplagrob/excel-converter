"use client";

import type { MappingSuggestion, SheetData } from "@/lib/client-types";
import { displaySourceColumnLabel, displaySourceColumnWithOriginal } from "./display";

interface MappingSummaryProps {
  sheet: SheetData;
  sheetMap: Record<string, string>;
  visibleMappings: MappingSuggestion[];
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  updateMapping: (sheetName: string, templateColumn: string, sourceColumn: string) => void;
}

export function MappingSummary({
  sheet,
  sheetMap,
  visibleMappings,
  advancedOpen,
  setAdvancedOpen,
  updateMapping,
}: MappingSummaryProps) {
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
          <div className="manual-mapping">
            {visibleMappings.map((mapping) => {
              const current = sheetMap[mapping.templateColumn] ?? mapping.sourceColumn ?? "";
              const isManual = sheetMap[mapping.templateColumn] !== undefined;
              return (
                <div className="map-row" key={mapping.templateColumn}>
                  <div className="tmpl-col">{mapping.templateColumn}</div>
                  <div className="arrow">→</div>
                  <select
                    value={current}
                    onChange={(event) =>
                      updateMapping(sheet.sheetName, mapping.templateColumn, event.target.value)
                    }
                  >
                    <option value="">— ไม่จับคู่ —</option>
                    {sheet.headers.map((header) => (
                      <option key={header} value={header}>
                        {displaySourceColumnWithOriginal(header)}
                      </option>
                    ))}
                  </select>
                  <span className={`badge ${isManual ? "manual" : mapping.method}`}>
                    {isManual ? "manual" : mapping.method}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

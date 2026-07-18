"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { CalculatedPreviewStep } from "./components/CalculatedPreviewStep";
import { DownloadStep } from "./components/DownloadStep";
import { PreviewStep } from "./components/PreviewStep";
import { ReportConfigStep, type CalculationSummary } from "./components/ReportConfigStep";
import { UploadStep } from "./components/UploadStep";
import {
  emptyOrganizationMetadataDraft,
  emptyReportingPolicyDraft,
  toReportingPolicy,
} from "@/lib/client-reporting";
import type { IssueSummary, ParseResponse, ValidationIssue } from "@/lib/client-types";
import type { OrganizationMetadata, ReportClass } from "@/lib/domain/types";
import { setManualMappingOverride, type ManualMapping } from "@/lib/manual-mapping";
import type { SeverityFilter } from "@/lib/reporting/preview-query";
import type { PreviewRowDto } from "@/lib/reporting/preview-dto";
import type { CategoryMappingOverride, RowOverrideInput, SelectedOutput } from "@/lib/reporting/types";
import {
  createDefaultSheetSelection,
  selectedSheetCount,
  type SheetSelection,
} from "@/lib/sheet-selection";

const STEP_LABELS = [
  "1. อัปโหลดไฟล์",
  "2. Preview + Mapping",
  "3. ตั้งค่ารายงาน",
  "4. Calculated preview",
  "5. Export",
];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const WORKBOOK_FILE_PATTERN = /\.xlsx?$/i;

export default function Page() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  // Every sheet that qualifies under the default export policy is
  // included automatically; there is no user-facing sheet toggle.
  const sheetSelection: SheetSelection = useMemo(
    () => (parsed ? createDefaultSheetSelection(parsed.sheetOverview || []) : {}),
    [parsed],
  );

  // mappingState[sheetName][templateColumn] = sourceColumn | ""
  const [mappingState, setMappingState] = useState<
    Record<string, ManualMapping>
  >({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [issueSummary, setIssueSummary] = useState<IssueSummary | null>(null);

  // --- P1: report configuration state -------------------------------------
  const [policyDraft, setPolicyDraft] = useState(emptyReportingPolicyDraft());
  const [organizationMetadata, setOrganizationMetadata] = useState<OrganizationMetadata>(
    emptyOrganizationMetadataDraft(),
  );
  const [selectedOutputs, setSelectedOutputs] = useState<SelectedOutput[]>(["TEMPLATE_50"]);
  const [categoryMappingOverrides, setCategoryMappingOverrides] = useState<CategoryMappingOverride[]>([]);
  const [rowOverrides, setRowOverrides] = useState<RowOverrideInput[]>([]);
  const [draft, setDraft] = useState(false);

  // --- P1: calculated preview state ---------------------------------------
  const [calculationSummary, setCalculationSummary] = useState<CalculationSummary | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRowDto[]>([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(50);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [warningGroups, setWarningGroups] = useState<{ reasonCode: string; count: number; sampleRowKeys: string[] }[]>([]);
  const [reconciliation, setReconciliation] = useState<CalculationSummary["reconciliation"] | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<ReportClass[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter[]>([]);
  const [search, setSearch] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const wantsReportOutputs = selectedOutputs.some((output) => output !== "TEMPLATE_50");

  const handleFile = useCallback((f: File) => {
    setError(null);
    if (!WORKBOOK_FILE_PATTERN.test(f.name)) {
      setFile(null);
      setError("รองรับเฉพาะไฟล์ .xlsx และ .xls");
      return;
    }
    if (!f.size) {
      setFile(null);
      setError("ไฟล์ที่เลือกไม่มีข้อมูล");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
      return;
    }
    setFile(f);
  }, []);

  const buildExportPayload = (
    parsedData: ParseResponse,
    manualMappingState: Record<string, ManualMapping>,
    mode: "validate" | "download",
    selection: SheetSelection,
  ) => {
    const policy = wantsReportOutputs ? toReportingPolicy(policyDraft) : null;
    return {
      mode,
      analysisId: parsedData.analysisId,
      sourceFileName: parsedData.fileName,
      sheets: parsedData.sheets.filter((s) => selection[s.sheetName]).map((s) => ({
        sheetName: s.sheetName,
        headerRow: s.headerRowIndex + 1,
        autoMapping: s.mapping,
        manualMapping: manualMappingState[s.sheetName] || {},
      })),
      selectedOutputs,
      ...(wantsReportOutputs && policy
        ? {
            reportingPolicy: policy,
            organizationMetadata,
            categoryMappings: categoryMappingOverrides,
            rowOverrides,
            draft,
          }
        : {}),
    };
  };

  const validateWorkbook = async (
    parsedData: ParseResponse,
    manualMappingState: Record<string, ManualMapping>,
    selection: SheetSelection,
  ) => {
    const res = await fetch("/api/v1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildExportPayload(parsedData, manualMappingState, "validate", selection)),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ตรวจสอบข้อมูลไม่สำเร็จ");
    setIssues(data.issues);
    setIssueSummary({
      errorCount: data.errorCount,
      warningCount: data.warningCount,
      totalRows: data.totalRows,
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const uploadAndParse = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/parse", { method: "POST", body: fd });
      const data: ParseResponse = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการอ่านไฟล์");
        setLoading(false);
        return;
      }
      setParsed(data);
      setActiveSheetIdx(0);

      const initMapping: Record<string, ManualMapping> = {};
      for (const sheet of data.sheets) {
        initMapping[sheet.sheetName] = {};
      }
      const initSelection = createDefaultSheetSelection(data.sheetOverview || []);
      setMappingState(initMapping);
      await validateWorkbook(data, initMapping, initSelection);
      setStep(1);
    } catch (e: any) {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async () => {
    if (!parsed || selectedSheetCount(sheetSelection) === 0) return;
    setLoading(true);
    setError(null);
    try {
      await validateWorkbook(parsed, mappingState, sheetSelection);
      setStep(2);
    } catch (e: any) {
      setError(e.message || "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // --- P1: fetch a page of calculated rows (also refreshes the config-step
  // summary, since every field it needs is unfiltered/whole-workbook data). ---
  const fetchPreview = async (params: {
    page: number;
    classification: ReportClass[];
    severity: SeverityFilter[];
    search: string;
    rowOverridesParam: RowOverrideInput[];
  }) => {
    if (!parsed) return;
    const policy = toReportingPolicy(policyDraft);
    if (!policy) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: parsed.analysisId,
          reportingPolicy: policy,
          categoryMappings: categoryMappingOverrides,
          rowOverrides: params.rowOverridesParam,
          page: params.page,
          pageSize: 50,
          classification: params.classification.length ? params.classification : undefined,
          severity: params.severity.length ? params.severity : undefined,
          search: params.search || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "คำนวณไม่สำเร็จ");
        return;
      }
      setPreviewRows(data.rows);
      setPreviewPage(data.page);
      setPreviewPageSize(data.pageSize);
      setPreviewTotal(data.total);
      setPreviewTotalPages(data.totalPages);
      setWarningGroups(data.warningGroups);
      setReconciliation(data.reconciliation);

      const blockingReasons: string[] = [];
      if (data.blockingRowCount > 0) {
        blockingReasons.push(`${data.blockingRowCount} รายการยังเป็น NEEDS_REVIEW หรือมี blocking issue`);
      }
      if (data.unresolvedCategoryValues.length > 0) {
        blockingReasons.push(`${data.unresolvedCategoryValues.length} ค่าประเภทสินทรัพย์ยังไม่ได้ mapping`);
      }
      if (!data.reconciliation.sorThor1MatchesSorThor2) {
        blockingReasons.push("ยอด อปท.-สท. 1 ไม่ตรงกับผลรวม อปท.-สท. 2");
      }
      if (!data.reconciliation.controlTotalMatchesReportableScope) {
        blockingReasons.push("control total (สท.2+สท.3) ไม่ตรงกับ reportable scope");
      }
      setCalculationSummary({
        totalRows: data.totalCalculatedRows,
        blockingRowCount: data.blockingRowCount,
        unresolvedCategoryValues: data.unresolvedCategoryValues,
        usefulLifeCategoriesInUse: data.usefulLifeCategoriesInUse,
        reconciliation: data.reconciliation,
        exportGate: { officialAllowed: blockingReasons.length === 0, blockingReasons },
      });
    } catch (e: any) {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = () =>
    fetchPreview({ page: 1, classification: classificationFilter, severity: severityFilter, search, rowOverridesParam: rowOverrides });

  const handlePageChange = (page: number) =>
    fetchPreview({ page, classification: classificationFilter, severity: severityFilter, search, rowOverridesParam: rowOverrides });

  const handleSetClassificationFilter = (value: ReportClass[]) => {
    setClassificationFilter(value);
    fetchPreview({ page: 1, classification: value, severity: severityFilter, search, rowOverridesParam: rowOverrides });
  };

  const handleSetSeverityFilter = (value: SeverityFilter[]) => {
    setSeverityFilter(value);
    fetchPreview({ page: 1, classification: classificationFilter, severity: value, search, rowOverridesParam: rowOverrides });
  };

  const handleSetSearch = (value: string) => {
    setSearch(value);
    fetchPreview({ page: 1, classification: classificationFilter, severity: severityFilter, search: value, rowOverridesParam: rowOverrides });
  };

  const handleApplyOverride = (override: RowOverrideInput) => {
    const next = [
      ...rowOverrides.filter((o) => !(o.rowKey === override.rowKey && o.field === override.field)),
      override,
    ];
    setRowOverrides(next);
    fetchPreview({ page: previewPage, classification: classificationFilter, severity: severityFilter, search, rowOverridesParam: next });
  };

  const handleResetOverride = (rowKey: string) => {
    const next = rowOverrides.filter((o) => o.rowKey !== rowKey);
    setRowOverrides(next);
    fetchPreview({ page: previewPage, classification: classificationFilter, severity: severityFilter, search, rowOverridesParam: next });
  };

  const downloadFile = async () => {
    if (!parsed || selectedSheetCount(sheetSelection) === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExportPayload(parsed, mappingState, "download", sheetSelection)),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "สร้างไฟล์ไม่สำเร็จ");
        setLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = parsed.fileName.replace(/\.[^/.]+$/, "");
      a.download = `converted_template_${baseName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError("ดาวน์โหลดไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setParsed(null);
    setMappingState({});
    setAdvancedOpen(false);
    setIssues(null);
    setIssueSummary(null);
    setError(null);
    setPolicyDraft(emptyReportingPolicyDraft());
    setOrganizationMetadata(emptyOrganizationMetadataDraft());
    setSelectedOutputs(["TEMPLATE_50"]);
    setCategoryMappingOverrides([]);
    setRowOverrides([]);
    setDraft(false);
    setCalculationSummary(null);
    setPreviewRows([]);
    setReconciliation(null);
  };

  const updateMapping = (
    sheetName: string,
    templateColumn: string,
    sourceColumn: string | null | undefined,
  ) => {
    setMappingState((prev) => ({
      ...prev,
      [sheetName]: setManualMappingOverride(
        prev[sheetName] || {},
        templateColumn,
        sourceColumn,
      ),
    }));
    // Mapping changes invalidate the previous server-side validation result.
    setIssues(null);
    setIssueSummary(null);
  };

  const mappedCountForSheet = (sheetName: string) => {
    const sheet = parsed?.sheets.find((item) => item.sheetName === sheetName);
    const m = mappingState[sheetName] || {};
    const autoMap = Object.fromEntries(
      (sheet?.mapping || []).map((item) => [item.templateColumn, item.sourceColumn || ""]),
    );
    return Object.values({ ...autoMap, ...m }).filter(Boolean).length;
  };

  const selectedCount = selectedSheetCount(sheetSelection);

  return (
    <div className="page">
      <div className="header">
        <div className="brand">
          <div className="brand-tag" />
          <div>
            <h1>ตัวกลางแปลงไฟล์สินทรัพย์</h1>
            <p>แปลงข้อมูล Excel หลายชีตให้ตรงเทมเพลตบริษัท พร้อมรายงาน อปท.-สท. 1-3</p>
          </div>
        </div>
        <div className="steps">
          {STEP_LABELS.map((label, idx) => (
            <span
              key={label}
              className={`step-chip ${
                idx === step ? "active" : idx < step ? "done" : ""
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && (
        <div className="loading-bar">
          <div className="fill" />
        </div>
      )}

      <div className="panel">
        {step === 0 && (
          <UploadStep
            file={file}
            dragActive={dragActive}
            setDragActive={setDragActive}
            onDrop={onDrop}
            inputRef={inputRef}
            handleFile={handleFile}
            setFile={setFile}
            onNext={uploadAndParse}
            loading={loading}
          />
        )}

        {step === 1 && parsed && (
          <PreviewStep
            parsed={parsed}
            activeSheetIdx={activeSheetIdx}
            setActiveSheetIdx={(idx: number) => {
              setActiveSheetIdx(idx);
              setAdvancedOpen(false);
            }}
            mappingState={mappingState}
            onBack={() => setStep(0)}
            updateMapping={updateMapping}
            mappedCountForSheet={mappedCountForSheet}
            issues={issues}
            issueSummary={issueSummary}
            advancedOpen={advancedOpen}
            setAdvancedOpen={setAdvancedOpen}
            onNext={runValidation}
            canContinue={selectedCount > 0}
            loading={loading}
          />
        )}

        {step === 2 && (
          <ReportConfigStep
            policyDraft={policyDraft}
            setPolicyDraft={setPolicyDraft}
            organizationMetadata={organizationMetadata}
            setOrganizationMetadata={setOrganizationMetadata}
            selectedOutputs={selectedOutputs}
            setSelectedOutputs={setSelectedOutputs}
            categoryMappingOverrides={categoryMappingOverrides}
            setCategoryMappingOverrides={setCategoryMappingOverrides}
            calculationSummary={calculationSummary}
            onCalculate={handleCalculate}
            onBack={() => setStep(1)}
            onNext={() => (wantsReportOutputs ? setStep(3) : setStep(4))}
            loading={loading}
          />
        )}

        {step === 3 && (
          <CalculatedPreviewStep
            rows={previewRows}
            page={previewPage}
            pageSize={previewPageSize}
            total={previewTotal}
            totalPages={previewTotalPages}
            warningGroups={warningGroups}
            reconciliation={reconciliation}
            classificationFilter={classificationFilter}
            setClassificationFilter={handleSetClassificationFilter}
            severityFilter={severityFilter}
            setSeverityFilter={handleSetSeverityFilter}
            search={search}
            setSearch={handleSetSearch}
            onPageChange={handlePageChange}
            onApplyOverride={handleApplyOverride}
            onResetOverride={handleResetOverride}
            loading={loading}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && parsed && (
          <DownloadStep
            parsed={parsed}
            issues={issues}
            issueSummary={issueSummary}
            onBack={() => setStep(wantsReportOutputs ? 3 : 2)}
            onDownload={downloadFile}
            onReset={reset}
            loading={loading}
            selectedSheetCount={selectedCount}
            reportOutputsRequested={wantsReportOutputs}
            officialExportAllowed={calculationSummary?.exportGate.officialAllowed}
            blockingReasons={calculationSummary?.exportGate.blockingReasons}
            draft={draft}
            setDraft={setDraft}
          />
        )}
      </div>
    </div>
  );
}

import fs from "node:fs";
import path from "node:path";
import { createDataSourceWorkbook } from "../lib/datasource";
import { readWorkbookBuffer } from "../lib/excel";
import { mappingSuggestionsToRecord, suggestMapping } from "../lib/mapping";
import { loadAssetTemplateMetadata } from "../lib/template";
import { transformRowsToTemplateDataset } from "../lib/transform";
import { validateMappedRows, validateSheetLevel, type ValidationIssue } from "../lib/validate";

type AuditStatus = "ready" | "warning" | "review" | "unsupported" | "skipped";

interface SheetAudit {
  sheetName: string;
  detectedProfile: string;
  sourceProfile: string;
  status: AuditStatus;
  eligibility: string;
  reason: string;
  rowCount: number;
  errorCount: number;
  warningCount: number;
}

interface FileAudit {
  fileName: string;
  relativePath: string;
  readable: boolean;
  error?: string;
  sheetCount: number;
  rowCount: number;
  sheets: SheetAudit[];
}

function findExcelFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (/\.xlsx?$/i.test(entry.name)) files.push(fullPath);
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right, "th"));
}

function issueType(issue: ValidationIssue): string {
  return `${issue.severity}:${issue.column}:${issue.message}`;
}

function classifySheet(
  detectedProfile: string,
  sourceProfile: string,
  eligibility: string,
  errorCount: number,
  warningCount: number,
  wasParsed: boolean,
): AuditStatus {
  if (detectedProfile === "maintenance") return "unsupported";
  if (!wasParsed) return "skipped";
  if (sourceProfile === "UNKNOWN") return "unsupported";
  if (eligibility === "needsReview" || errorCount > 0) return "review";
  if (warningCount > 0) return "warning";
  return "ready";
}

async function main(): Promise<void> {
  const workspace = process.cwd();
  const assetRoot = path.join(workspace, "assets", "เทศบาลนครลำปาง");
  const reportPath = path.join(workspace, "reports", "asset-audit.json");
  const template = await loadAssetTemplateMetadata();
  const files = findExcelFiles(assetRoot);
  const fileAudits: FileAudit[] = [];
  const issueCounts = new Map<string, number>();

  for (const filePath of files) {
    const relativePath = path.relative(assetRoot, filePath);
    try {
      const rawWorkbook = await readWorkbookBuffer(fs.readFileSync(filePath), path.basename(filePath));
      const dataSource = createDataSourceWorkbook(rawWorkbook.fileName, rawWorkbook.sheets);
      const sheetAudits: SheetAudit[] = [];

      for (const rawSheet of rawWorkbook.sheets) {
        const debug = dataSource.profileDebug.find((item) => item.sheetName === rawSheet.sheetName);
        const parsedSheet = dataSource.sheets.find((item) => item.sheetName === rawSheet.sheetName);
        const issues: ValidationIssue[] = [];
        let rowCount = 0;
        let eligibility = debug?.eligibility || "skipped";
        let reason = debug?.decisionReason || debug?.skipReason || "sheet was not parsed";

        if (parsedSheet) {
          const validationContext = {
            sourceProfile: parsedSheet.sourceProfile,
            eligibility: parsedSheet.eligibility,
          };
          const mapping = mappingSuggestionsToRecord(suggestMapping(parsedSheet.headers));
          const mappedRows = transformRowsToTemplateDataset(parsedSheet.rows, mapping);
          rowCount = mappedRows.length;
          issues.push(
            ...parsedSheet.warnings.map((message) => ({
              sheetName: parsedSheet.sheetName,
              rowIndex: -1,
              column: "sheet",
              message,
              severity: "warning" as const,
            })),
            ...validateSheetLevel(
              parsedSheet.sheetName,
              parsedSheet.rows.length,
              parsedSheet.headerRowIndex + 1,
              mapping,
              parsedSheet.rows,
              validationContext,
            ),
            ...validateMappedRows(
              parsedSheet.sheetName,
              mappedRows,
              parsedSheet.rows,
              template.references,
              validationContext,
            ),
          );
          const hasErrors = issues.some((issue) => issue.severity === "error");
          eligibility =
            parsedSheet.eligibility === "needsReview" || hasErrors ? "needsReview" : "exportable";
          reason =
            eligibility === "exportable"
              ? "validated with no blocking errors"
              : hasErrors
                ? "validation found blocking errors"
                : parsedSheet.eligibilityReason;
        }

        for (const issue of issues) {
          const key = issueType(issue);
          issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
        }

        const errorCount = issues.filter((issue) => issue.severity === "error").length;
        const warningCount = issues.filter((issue) => issue.severity === "warning").length;
        const detectedProfile = debug?.profile || "unknown";
        const sourceProfile = debug?.legacySourceProfile || "UNKNOWN";
        sheetAudits.push({
          sheetName: rawSheet.sheetName,
          detectedProfile,
          sourceProfile,
          status: classifySheet(
            detectedProfile,
            sourceProfile,
            eligibility,
            errorCount,
            warningCount,
            Boolean(parsedSheet),
          ),
          eligibility,
          reason,
          rowCount,
          errorCount,
          warningCount,
        });
      }

      fileAudits.push({
        fileName: path.basename(filePath),
        relativePath,
        readable: true,
        sheetCount: rawWorkbook.sheets.length,
        rowCount: sheetAudits.reduce((total, sheet) => total + sheet.rowCount, 0),
        sheets: sheetAudits,
      });
    } catch (error) {
      fileAudits.push({
        fileName: path.basename(filePath),
        relativePath,
        readable: false,
        error: error instanceof Error ? error.message : String(error),
        sheetCount: 0,
        rowCount: 0,
        sheets: [],
      });
    }
  }

  const allSheets = fileAudits.flatMap((file) => file.sheets);
  const topIssueTypes = [...issueCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type, "th"))
    .slice(0, 20);
  const summary = {
    totalFiles: fileAudits.length,
    readableFiles: fileAudits.filter((file) => file.readable).length,
    unreadableFiles: fileAudits.filter((file) => !file.readable).length,
    totalSheets: allSheets.length,
    exportableSheets: allSheets.filter((sheet) => sheet.status === "ready" || sheet.status === "warning").length,
    readySheets: allSheets.filter((sheet) => sheet.status === "ready").length,
    warningSheets: allSheets.filter((sheet) => sheet.warningCount > 0).length,
    reviewSheets: allSheets.filter((sheet) => sheet.status === "review").length,
    unsupportedSheets: allSheets.filter((sheet) => sheet.status === "unsupported").length,
    skippedSheets: allSheets.filter((sheet) => sheet.status === "skipped").length,
    totalRows: allSheets.reduce((total, sheet) => total + sheet.rowCount, 0),
    totalErrors: allSheets.reduce((total, sheet) => total + sheet.errorCount, 0),
    totalWarnings: allSheets.reduce((total, sheet) => total + sheet.warningCount, 0),
  };
  const report = { summary, topIssueTypes, files: fileAudits };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Asset audit summary");
  console.table(summary);
  console.log("Top issue types");
  console.table(topIssueTypes.slice(0, 10));
  console.log(`Report: ${path.relative(workspace, reportPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

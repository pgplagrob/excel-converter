import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { RawWorkbook, WorkbookRowMeta, WorkbookSheetMatrix } from "./excel";

const EXTRACTION_TIMEOUT_MS = 60_000;
const MAX_STDOUT_BYTES = 128 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;

export class PythonExtractorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythonExtractorUnavailableError";
  }
}

export class PythonExtractorLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythonExtractorLimitError";
  }
}

interface PythonCommand {
  executable: string;
  args: string[];
}

function pythonCommands(): PythonCommand[] {
  const configured = process.env.PYTHON_EXECUTABLE?.trim();
  if (configured) return [{ executable: configured, args: [] }];
  return process.platform === "win32"
    ? [{ executable: "python", args: [] }, { executable: "py", args: ["-3"] }]
    : [{ executable: "python3", args: [] }, { executable: "python", args: [] }];
}

function extractorScriptPath(): string {
  const configured = process.env.WORKBOOK_EXTRACTOR_SCRIPT?.trim();
  if (configured) return path.resolve(configured);

  const candidates = [
    path.join(process.cwd(), "python", "extract_workbook.py"),
    path.join(process.cwd(), "backend", "python", "extract_workbook.py"),
  ];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new PythonExtractorUnavailableError(
      "Python workbook extractor script was not found. Set WORKBOOK_EXTRACTOR_SCRIPT.",
    );
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Python extractor returned an invalid ${field}.`);
  }
  return value;
}

function parseRowMeta(value: unknown, rowCount: number): WorkbookRowMeta[] {
  if (!Array.isArray(value) || value.length !== rowCount) {
    throw new Error("Python extractor returned invalid row metadata.");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error("Python extractor returned invalid row metadata.");
    return {
      excelRowNumber:
        typeof item.excelRowNumber === "number" ? item.excelRowNumber : index + 1,
      hidden: item.hidden === true,
      fillColors: stringArray(item.fillColors, "fillColors"),
    };
  });
}

function parseSheet(value: unknown): WorkbookSheetMatrix {
  if (!isRecord(value) || typeof value.sheetName !== "string" || !Array.isArray(value.matrix)) {
    throw new Error("Python extractor returned an invalid worksheet.");
  }
  if (!value.matrix.every((row) => Array.isArray(row))) {
    throw new Error("Python extractor returned an invalid worksheet matrix.");
  }

  const matrix = value.matrix as unknown[][];
  const formulas = Array.isArray(value.formulas)
    ? value.formulas.map((formula) => {
        if (!isRecord(formula) || typeof formula.cell !== "string" || typeof formula.formula !== "string") {
          throw new Error("Python extractor returned invalid formula metadata.");
        }
        return { cell: formula.cell, formula: formula.formula };
      })
    : [];

  return {
    sheetName: value.sheetName,
    matrix,
    rowMeta: parseRowMeta(value.rowMeta, matrix.length),
    mergedRanges: stringArray(value.mergedRanges ?? [], "mergedRanges"),
    hiddenColumns: stringArray(value.hiddenColumns ?? [], "hiddenColumns"),
    formulas,
  };
}

export function parseStructuredWorkbookJson(output: string, expectedFileName: string): RawWorkbook {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("Python extractor returned malformed JSON.");
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.sheets)) {
    throw new Error("Python extractor returned an invalid workbook.");
  }
  return {
    fileName: typeof parsed.fileName === "string" ? parsed.fileName : expectedFileName,
    sheets: parsed.sheets.map(parseSheet),
  };
}

function runExtractor(
  command: PythonCommand,
  scriptPath: string,
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, [...command.args, scriptPath, fileName], {
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    // Buffer.concat accepts Uint8Array chunks. Using that interface avoids
    // Buffer/ArrayBuffer type conflicts between Node typings and newer TS.
    const stdout: Uint8Array[] = [];
    const stderr: Uint8Array[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const finish = (error?: Error, output?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(output || "");
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error(`Python workbook extraction exceeded ${EXTRACTION_TIMEOUT_MS / 1000} seconds.`));
    }, EXTRACTION_TIMEOUT_MS);

    child.on("error", (error: NodeJS.ErrnoException) => {
      const unavailable = error.code === "ENOENT" || error.code === "EACCES";
      finish(
        unavailable
          ? new PythonExtractorUnavailableError(`${command.executable} is not available.`)
          : error,
      );
    });
    child.stdout.on("data", (chunk: Uint8Array) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        child.kill();
        finish(new Error("Python workbook extractor output exceeded 128 MB."));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Uint8Array) => {
      if (stderrBytes >= MAX_STDERR_BYTES) return;
      const captured = chunk.subarray(0, MAX_STDERR_BYTES - stderrBytes);
      stderr.push(captured);
      stderrBytes += captured.length;
    });
    child.on("close", (code) => {
      if (settled) return;
      const errorText = Buffer.concat(stderr).toString("utf8").trim();
      if (code === 0) {
        finish(undefined, Buffer.concat(stdout).toString("utf8"));
        return;
      }
      if (/No installed Pythons? found/i.test(errorText)) {
        finish(new PythonExtractorUnavailableError(`${command.executable} has no usable Python installation.`));
        return;
      }
      if (/No module named ['\"]openpyxl['\"]|ModuleNotFoundError.*openpyxl/i.test(errorText)) {
        finish(new PythonExtractorUnavailableError("Python dependency openpyxl is not installed."));
        return;
      }
      if (/exceeds the .* limit|more than \d+ worksheets/i.test(errorText)) {
        finish(new PythonExtractorLimitError(errorText.replace(/^ValueError:\s*/i, "")));
        return;
      }
      finish(new Error(errorText || `Python workbook extractor exited with code ${code}.`));
    });

    child.stdin.on("error", () => undefined);
    child.stdin.end(buffer);
  });
}

export async function extractWorkbookWithPython(
  buffer: Buffer,
  fileName: string,
): Promise<RawWorkbook> {
  const scriptPath = extractorScriptPath();
  const unavailableMessages: string[] = [];
  for (const command of pythonCommands()) {
    try {
      const output = await runExtractor(command, scriptPath, buffer, fileName);
      return parseStructuredWorkbookJson(output, fileName);
    } catch (error) {
      if (!(error instanceof PythonExtractorUnavailableError)) throw error;
      unavailableMessages.push(error.message);
    }
  }
  throw new PythonExtractorUnavailableError(unavailableMessages.join(" "));
}

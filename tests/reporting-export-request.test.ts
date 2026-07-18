import assert from "node:assert/strict";
import test from "node:test";
import { ExportRequestValidationError, parseExportRequest } from "../lib/export-request";

function baseSheetsRequest(overrides: Record<string, unknown> = {}) {
  return {
    analysisId: "abc123",
    sheets: [{ sheetName: "Sheet1" }],
    ...overrides,
  };
}

const validPolicy = {
  fiscalYearBE: 2561,
  cutoffDateISO: "2018-09-30",
  usefulLifeSelectionPolicy: "minimum",
  residualBookValueSatang: 100,
  roundingMode: "half-up",
  roundingStage: "final-only",
  classificationVersion: "v1",
  depreciationRuleVersion: "v1",
};

test("a request with only the pre-existing Template-50 fields still parses (backward compatible)", () => {
  const parsed = parseExportRequest(baseSheetsRequest());
  assert.equal(parsed.analysisId, "abc123");
  assert.equal(parsed.reportingPolicy, undefined);
  assert.equal(parsed.selectedOutputs, undefined);
});

test("a request with reportingPolicy + organizationMetadata + selectedOutputs parses fully", () => {
  const parsed = parseExportRequest(
    baseSheetsRequest({
      reportingPolicy: validPolicy,
      organizationMetadata: {
        organizationName: "เทศบาลนครลำปาง",
        district: "เมืองลำปาง",
        province: "ลำปาง",
        postalCode: "52000",
        contactName: "นาย ก.",
        contactPosition: "นักวิชาการเงินและบัญชี",
        phone: "054-000000",
      },
      selectedOutputs: ["TEMPLATE_50", "SOR_THOR_1", "SOR_THOR_2", "SOR_THOR_3", "AUDIT_ASSUMPTIONS"],
    }),
  );
  assert.equal(parsed.reportingPolicy?.fiscalYearBE, 2561);
  assert.equal(parsed.organizationMetadata?.organizationName, "เทศบาลนครลำปาง");
  assert.deepEqual(parsed.selectedOutputs, ["TEMPLATE_50", "SOR_THOR_1", "SOR_THOR_2", "SOR_THOR_3", "AUDIT_ASSUMPTIONS"]);
});

test("an invalid reportingPolicy is rejected as a 400-style ExportRequestValidationError with a field-specific message", () => {
  assert.throws(
    () => parseExportRequest(baseSheetsRequest({ reportingPolicy: { ...validPolicy, roundingMode: "not-a-mode" } })),
    (err: unknown) => err instanceof ExportRequestValidationError && /roundingMode/.test((err as Error).message),
  );
});

test("an unknown selectedOutputs value is rejected", () => {
  assert.throws(
    () => parseExportRequest(baseSheetsRequest({ selectedOutputs: ["NOT_A_REPORT"] })),
    ExportRequestValidationError,
  );
});

test("categoryMappings / rowOverrides / referenceOverrides parse and validate", () => {
  const parsed = parseExportRequest(
    baseSheetsRequest({
      categoryMappings: [{ sourceValue: "สิ่งปลูกสร้าง", assetGroup: "STRUCTURE", usefulLifeCategoryKey: "STRUCTURE_CONCRETE_STEEL" }],
      rowOverrides: [{ rowKey: "r1", field: "assetGroup", overrideValue: "LAND" }],
      referenceOverrides: [{ templateColumn: "สำนัก", sourceValue: "สนง.ปลัด", canonicalValue: "สำนักปลัดเทศบาล" }],
    }),
  );
  assert.equal(parsed.categoryMappings?.[0].assetGroup, "STRUCTURE");
  assert.equal(parsed.rowOverrides?.[0].rowKey, "r1");
  assert.equal(parsed.referenceOverrides?.[0].templateColumn, "สำนัก");
});

test("draft flag parses as a boolean", () => {
  assert.equal(parseExportRequest(baseSheetsRequest({ draft: true })).draft, true);
  assert.equal(parseExportRequest(baseSheetsRequest()).draft, undefined);
});

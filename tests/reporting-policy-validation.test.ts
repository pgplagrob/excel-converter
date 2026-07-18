import assert from "node:assert/strict";
import test from "node:test";
import {
  anyAssetAcquiredOnDay15,
  parseOrganizationMetadata,
  parseReportingPolicy,
  PolicyValidationError,
} from "../lib/reporting/policy-validation";

function validPolicyInput(overrides: Record<string, unknown> = {}) {
  return {
    fiscalYearBE: 2561,
    cutoffDateISO: "2018-09-30",
    usefulLifeSelectionPolicy: "minimum",
    residualBookValueSatang: 100,
    roundingMode: "half-up",
    roundingStage: "final-only",
    classificationVersion: "v1",
    depreciationRuleVersion: "v1",
    ...overrides,
  };
}

test("valid reporting policy parses without a day-15 rule (not required unless data needs it)", () => {
  const policy = parseReportingPolicy(validPolicyInput());
  assert.equal(policy.fiscalYearBE, 2561);
  assert.equal(policy.acquisitionDay15Rule, undefined);
});

test("unknown enum values are rejected with a field-specific error", () => {
  assert.throws(
    () => parseReportingPolicy(validPolicyInput({ usefulLifeSelectionPolicy: "average" })),
    (err: unknown) => err instanceof PolicyValidationError && err.field === "reportingPolicy.usefulLifeSelectionPolicy",
  );
  assert.throws(
    () => parseReportingPolicy(validPolicyInput({ roundingMode: "banker" })),
    (err: unknown) => err instanceof PolicyValidationError && err.field === "reportingPolicy.roundingMode",
  );
  assert.throws(
    () => parseReportingPolicy(validPolicyInput({ acquisitionDay15Rule: "round-up" })),
    (err: unknown) => err instanceof PolicyValidationError && err.field === "reportingPolicy.acquisitionDay15Rule",
  );
});

test("invalid cutoff date is rejected", () => {
  assert.throws(
    () => parseReportingPolicy(validPolicyInput({ cutoffDateISO: "30/09/2018" })),
    (err: unknown) => err instanceof PolicyValidationError,
  );
});

test("useful-life override years must be inside the manual's range for that category", () => {
  assert.throws(
    () =>
      parseReportingPolicy(
        validPolicyInput({
          usefulLifeSelectionPolicy: "explicit-per-category",
          usefulLifeOverridesByCategory: { EQUIP_OFFICE: { years: 50, source: "manual" } },
        }),
      ),
    (err: unknown) => err instanceof PolicyValidationError,
  );

  const ok = parseReportingPolicy(
    validPolicyInput({
      usefulLifeSelectionPolicy: "explicit-per-category",
      usefulLifeOverridesByCategory: { EQUIP_OFFICE: { years: 8, source: "manual" } },
    }),
  );
  assert.equal(ok.usefulLifeOverridesByCategory.EQUIP_OFFICE?.years, 8);
});

test("unknown useful-life category key is rejected", () => {
  assert.throws(() =>
    parseReportingPolicy(
      validPolicyInput({
        usefulLifeOverridesByCategory: { NOT_A_REAL_KEY: { years: 5, source: "x" } },
      }),
    ),
  );
});

test("organization metadata requires all core fields", () => {
  assert.throws(() => parseOrganizationMetadata({}));
  const ok = parseOrganizationMetadata({
    organizationName: "เทศบาลนครลำปาง",
    district: "เมืองลำปาง",
    province: "ลำปาง",
    postalCode: "52000",
    contactName: "นาย ก.",
    contactPosition: "นักวิชาการเงินและบัญชี",
    phone: "054-000000",
  });
  assert.equal(ok.organizationName, "เทศบาลนครลำปาง");
  assert.equal(ok.fax, "");
});

test("anyAssetAcquiredOnDay15 only requires the day-15 policy when data actually has a day-15 acquisition", () => {
  assert.equal(anyAssetAcquiredOnDay15(["2018-04-01", "2018-05-20"]), false);
  assert.equal(anyAssetAcquiredOnDay15(["2018-04-01", "2018-05-15", null]), true);
});

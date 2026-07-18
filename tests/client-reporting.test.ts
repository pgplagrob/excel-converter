import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyOrganizationMetadataDraft,
  emptyReportingPolicyDraft,
  organizationMetadataMissingFields,
  reportingPolicyMissingFields,
  toReportingPolicy,
} from "../lib/client-reporting";

test("a fresh draft has no preselected policy values (all core fields missing)", () => {
  const draft = emptyReportingPolicyDraft();
  const missing = reportingPolicyMissingFields(draft);
  assert.ok(missing.includes("Useful-life selection policy"));
  assert.ok(missing.includes("Rounding mode"));
  assert.ok(missing.includes("Rounding stage"));
  // acquisitionDay15Rule is intentionally NOT in the missing-fields list —
  // it is only required per-row, by the backend, when data actually needs it.
  assert.equal(missing.includes("acquisitionDay15Rule"), false);
});

test("residualBookValueBaht is pre-filled with the manual's 1-baht default, visibly, not silently", () => {
  const draft = emptyReportingPolicyDraft();
  assert.equal(draft.residualBookValueBaht, "1");
});

test("toReportingPolicy returns null while required fields are missing", () => {
  assert.equal(toReportingPolicy(emptyReportingPolicyDraft()), null);
});

test("toReportingPolicy converts a fully-filled draft", () => {
  const draft = emptyReportingPolicyDraft();
  draft.fiscalYearBE = "2561";
  draft.cutoffDateISO = "2018-09-30";
  draft.usefulLifeSelectionPolicy = "minimum";
  draft.roundingMode = "half-up";
  draft.roundingStage = "final-only";

  const policy = toReportingPolicy(draft);
  assert.ok(policy);
  assert.equal(policy?.fiscalYearBE, 2561);
  assert.equal(policy?.residualBookValueSatang, 100);
  assert.equal(policy?.acquisitionDay15Rule, undefined);
});

test("useful-life override entries with a blank years value are dropped, not sent as zero", () => {
  const draft = emptyReportingPolicyDraft();
  draft.fiscalYearBE = "2561";
  draft.cutoffDateISO = "2018-09-30";
  draft.usefulLifeSelectionPolicy = "explicit-per-category";
  draft.roundingMode = "half-up";
  draft.roundingStage = "final-only";
  draft.usefulLifeOverridesByCategory = {
    EQUIP_OFFICE: { years: "8", source: "test" },
    EQUIP_COMPUTER: { years: "", source: "test" }, // not yet decided
  };

  const policy = toReportingPolicy(draft);
  assert.equal(policy?.usefulLifeOverridesByCategory.EQUIP_OFFICE?.years, 8);
  assert.equal(policy?.usefulLifeOverridesByCategory.EQUIP_COMPUTER, undefined);
});

test("organization metadata missing-fields check requires every core field", () => {
  const missing = organizationMetadataMissingFields(emptyOrganizationMetadataDraft());
  assert.ok(missing.includes("หน่วยงาน"));
  assert.ok(missing.includes("โทรศัพท์"));
  // fax is optional per the domain type.
  assert.equal(missing.includes("โทรสาร"), false);
});

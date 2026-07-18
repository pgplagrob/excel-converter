import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCategoryMappingOverrides,
  parseReferenceOverrides,
  parseRowOverrideInputs,
  parseSelectedOutputs,
  stampRowOverrides,
  validateRowOverridesAgainstRowKeys,
} from "../lib/reporting/request-validation";
import { PolicyValidationError } from "../lib/reporting/policy-validation";

test("parseSelectedOutputs accepts known outputs and rejects unknown ones", () => {
  assert.deepEqual(parseSelectedOutputs(["TEMPLATE_50", "SOR_THOR_1"]), ["TEMPLATE_50", "SOR_THOR_1"]);
  assert.throws(() => parseSelectedOutputs(["NOT_A_REPORT"]), PolicyValidationError);
  assert.throws(() => parseSelectedOutputs([]), PolicyValidationError);
});

test("parseCategoryMappingOverrides validates assetGroup and usefulLifeCategoryKey enums", () => {
  const parsed = parseCategoryMappingOverrides([
    { sourceValue: "สิ่งปลูกสร้าง", assetGroup: "STRUCTURE", usefulLifeCategoryKey: "STRUCTURE_CONCRETE_STEEL", approvedBy: "tester" },
  ]);
  assert.equal(parsed[0].assetGroup, "STRUCTURE");
  assert.throws(() => parseCategoryMappingOverrides([{ sourceValue: "x", assetGroup: "NOT_A_GROUP" }]), PolicyValidationError);
  assert.throws(
    () => parseCategoryMappingOverrides([{ sourceValue: "x", assetGroup: "LAND", usefulLifeCategoryKey: "NOT_A_KEY" }]),
    PolicyValidationError,
  );
});

test("parseRowOverrideInputs validates field enum and value type, rejects unknown fields", () => {
  const parsed = parseRowOverrideInputs([{ rowKey: "r1", field: "assetGroup", overrideValue: "LAND" }]);
  assert.equal(parsed[0].rowKey, "r1");
  assert.throws(() => parseRowOverrideInputs([{ rowKey: "r1", field: "sourceProvenance", overrideValue: "x" }]), PolicyValidationError);
  assert.throws(() => parseRowOverrideInputs([{ rowKey: "r1", field: "costSatang", overrideValue: {} }]), PolicyValidationError);
});

test("stampRowOverrides adds a server-controlled timestamp, ignoring any client-supplied one", () => {
  const inputs = parseRowOverrideInputs([{ rowKey: "r1", field: "costSatang", overrideValue: 1000 }]);
  const stamped = stampRowOverrides(inputs, () => "2020-01-01T00:00:00.000Z");
  assert.equal(stamped[0].timestamp, "2020-01-01T00:00:00.000Z");
});

test("validateRowOverridesAgainstRowKeys rejects overrides referencing unknown rows", () => {
  const stamped = stampRowOverrides(parseRowOverrideInputs([{ rowKey: "ghost-row", field: "costSatang", overrideValue: 1000 }]));
  assert.throws(() => validateRowOverridesAgainstRowKeys(stamped, new Set(["real-row"])), PolicyValidationError);
  assert.doesNotThrow(() => validateRowOverridesAgainstRowKeys(stamped, new Set(["ghost-row"])));
});

test("parseReferenceOverrides requires a known template column", () => {
  const parsed = parseReferenceOverrides([{ templateColumn: "สำนัก", sourceValue: "สนง.ปลัด", canonicalValue: "สำนักปลัดเทศบาล" }]);
  assert.equal(parsed[0].templateColumn, "สำนัก");
  assert.throws(
    () => parseReferenceOverrides([{ templateColumn: "ไม่มีคอลัมน์นี้", sourceValue: "a", canonicalValue: "b" }]),
    PolicyValidationError,
  );
});

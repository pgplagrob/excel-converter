import assert from "node:assert/strict";
import test from "node:test";
import {
  applyManualMappingPreview,
  effectiveSourceColumn,
  hasManualOverride,
  setManualMappingOverride,
} from "../lib/manual-mapping";

test("manual mapping distinguishes auto, explicit source, and explicit blank", () => {
  let mapping = {};
  assert.equal(hasManualOverride(mapping, "ชื่อสินทรัพย์"), false);
  assert.equal(effectiveSourceColumn("assetName", mapping, "ชื่อสินทรัพย์"), "assetName");

  mapping = setManualMappingOverride(mapping, "ชื่อสินทรัพย์", "รายละเอียดสินทรัพย์");
  assert.equal(hasManualOverride(mapping, "ชื่อสินทรัพย์"), true);
  assert.equal(
    effectiveSourceColumn("assetName", mapping, "ชื่อสินทรัพย์"),
    "รายละเอียดสินทรัพย์",
  );

  mapping = setManualMappingOverride(mapping, "ชื่อสินทรัพย์", null);
  assert.equal(effectiveSourceColumn("assetName", mapping, "ชื่อสินทรัพย์"), null);

  mapping = setManualMappingOverride(mapping, "ชื่อสินทรัพย์", undefined);
  assert.equal(hasManualOverride(mapping, "ชื่อสินทรัพย์"), false);
  assert.equal(effectiveSourceColumn("assetName", mapping, "ชื่อสินทรัพย์"), "assetName");
});

test("manual mapping preview copies an exact source cell to multiple template columns", () => {
  const exactSource = "เก้าอี้ผู้บริหาร ยี้ห้อ MONO รุ่น AR THUR/H";
  const preview = applyManualMappingPreview(
    [{ "ชื่อสินทรัพย์": "", "รายละเอียด": "ค่าอัตโนมัติ", "มูลค่า": 5500 }],
    [{ "รายละเอียดสินทรัพย์": exactSource }],
    {
      "ชื่อสินทรัพย์": "รายละเอียดสินทรัพย์",
      "รายละเอียด": "รายละเอียดสินทรัพย์",
      "มูลค่า": null,
    },
  );

  assert.equal(preview[0]["ชื่อสินทรัพย์"], exactSource);
  assert.equal(preview[0]["รายละเอียด"], exactSource);
  assert.equal(preview[0]["มูลค่า"], "");
});

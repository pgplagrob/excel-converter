import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildSheetData } from "../lib/build-sheet-data";
import type { DataSourceSheet } from "../lib/datasource";
import {
  applyMappingProfile,
  AUTHORITATIVE_TEMPLATE_COLUMNS,
  normalizeText,
  suggestMapping,
} from "../lib/mapping";
import {
  computeHeaderSignature,
  loadMappingProfile,
  MAX_PROFILES,
  persistConfirmedMappingProfile,
  saveMappingProfile,
} from "../lib/mapping-profiles";
import type { AssetTemplateMetadata, TemplateReferenceValues } from "../lib/template";

function emptyReferences(): TemplateReferenceValues {
  return {
    categories: new Set(),
    types: new Set(),
    classes: new Set(),
    units: new Set(),
    buildings: new Set(),
    rooms: new Set(),
    owners: new Set(),
    institutes: new Set(),
    departments: new Set(),
    sections: new Set(),
    responsibleWork: new Set(),
    getByMethods: new Set(),
    statuses: new Set(),
    booleans: new Set(),
    assetReturns: new Set(),
  };
}

function withTempStore(run: (storePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "mapping-profiles-"));
  try {
    run(join(directory, "profiles.json"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("header signatures require the same complete normalized header set", () => {
  const first = computeHeaderSignature([" Asset Code ", "Custodian\nName", "Asset Code"]);
  const reordered = computeHeaderSignature(["custodian name", "ASSETCODE"]);
  const different = computeHeaderSignature(["custodian name", "ASSETCODE", "Value"]);

  assert.equal(first, reordered);
  assert.notEqual(first, different);
});

test("profile replay fills only safe unmapped non-authoritative gaps", () => {
  const headers = ["AssetCode", "LocationName", "Custodian label", "Name label"];
  const suggestions = suggestMapping(headers);
  const withoutProfile = applyMappingProfile(suggestions, headers, undefined);
  const applied = applyMappingProfile(suggestions, headers, {
    "รหัสสินทรัพย์": normalizeText("Custodian label"),
    "ผู้ถือครอง": normalizeText("Custodian label"),
    "ห้อง": normalizeText("LocationName"),
    "ชื่อสินทรัพย์": normalizeText("Name label"),
    "ฝ่าย": normalizeText("Missing header"),
  });

  assert.equal(withoutProfile, suggestions);

  const assetCode = applied.find((item) => item.templateColumn === "รหัสสินทรัพย์");
  assert.equal(assetCode?.sourceColumn, "AssetCode");
  assert.equal(assetCode?.method, "alias");

  const owner = applied.find((item) => item.templateColumn === "ผู้ถือครอง");
  assert.equal(owner?.sourceColumn, "Custodian label");
  assert.equal(owner?.method, "profile");
  assert.equal(owner?.confidenceScore, 90);
  assert.equal(owner?.confidence, "high");
  assert.equal(owner?.status, "guessed");

  assert.equal(
    applied.find((item) => item.templateColumn === "ห้อง")?.sourceColumn,
    null,
    "a profile must not reuse LocationName after alias matching claimed it for อาคาร",
  );
  assert.equal(
    applied.find((item) => item.templateColumn === "ชื่อสินทรัพย์")?.sourceColumn,
    null,
  );
  assert.equal(
    applied.find((item) => item.templateColumn === "ฝ่าย")?.sourceColumn,
    null,
  );
  assert.equal(AUTHORITATIVE_TEMPLATE_COLUMNS.has("ชื่อสินทรัพย์"), true);
});

test("mapping profile storage round-trips and evicts the oldest signature", () => {
  withTempStore((storePath) => {
    saveMappingProfile("round-trip", { ผู้ถือครอง: "custodianlabel" }, storePath);
    assert.deepEqual(loadMappingProfile("round-trip", storePath)?.mapping, {
      ผู้ถือครอง: "custodianlabel",
    });

    for (let index = 0; index <= MAX_PROFILES; index += 1) {
      saveMappingProfile(`signature-${index}`, { ฝ่าย: `header${index}` }, storePath);
    }

    assert.equal(loadMappingProfile("round-trip", storePath), null);
    assert.equal(loadMappingProfile("signature-0", storePath), null);
    assert.deepEqual(loadMappingProfile(`signature-${MAX_PROFILES}`, storePath)?.mapping, {
      ฝ่าย: `header${MAX_PROFILES}`,
    });
  });
});

test("missing or corrupt profile storage is treated as empty", () => {
  withTempStore((storePath) => {
    assert.equal(loadMappingProfile("missing", storePath), null);
    writeFileSync(storePath, "{not valid json", "utf8");
    assert.equal(loadMappingProfile("corrupt", storePath), null);
  });
});

test("only a valid download persists a mapping that replays on the same header set", () => {
  withTempStore((storePath) => {
    const firstHeaders = ["AssetCode", "Custodian label", "Name label"];
    persistConfirmedMappingProfile(
      "download",
      0,
      firstHeaders,
      {
        "รหัสสินทรัพย์": "AssetCode",
        "ผู้ถือครอง": "Custodian label",
        "ชื่อสินทรัพย์": "Name label",
      },
      storePath,
    );

    const signature = computeHeaderSignature([" name LABEL ", " CUSTODIAN LABEL ", "asset code"]);
    const profile = loadMappingProfile(signature, storePath);
    assert.deepEqual(profile?.mapping, {
      "รหัสสินทรัพย์": normalizeText("AssetCode"),
      "ผู้ถือครอง": normalizeText("Custodian label"),
    });

    const headers = [" name LABEL ", " CUSTODIAN LABEL ", "asset code"];
    const sheet: DataSourceSheet = {
      sheetName: "Assets",
      sourceProfile: "UNKNOWN",
      headerRowIndex: 0,
      headers,
      rows: [{
        " name LABEL ": "โต๊ะทำงาน",
        " CUSTODIAN LABEL ": "งานพัสดุ",
        "asset code": "A-001",
      }],
      rowCount: 1,
      eligibility: "unsupported",
      eligibilityReason: "test fixture",
      confidence: 0,
      groupedAssets: [],
      warnings: [],
    };
    const template: AssetTemplateMetadata = { columns: [], references: emptyReferences() };
    const built = buildSheetData(sheet, template, [], profile?.mapping);
    const replayed = built.mapping.find((item) => item.templateColumn === "ผู้ถือครอง");
    assert.equal(replayed?.sourceColumn, " CUSTODIAN LABEL ");
    assert.equal(replayed?.method, "profile");
    assert.equal(built.templateSampleRows?.[0]["ผู้ถือครอง"], "งานพัสดุ");

    const validateHeaders = ["Another custom header"];
    persistConfirmedMappingProfile(
      "validate",
      0,
      validateHeaders,
      { ฝ่าย: "Another custom header" },
      storePath,
    );
    assert.equal(
      loadMappingProfile(computeHeaderSignature(validateHeaders), storePath),
      null,
    );

    const invalidHeaders = ["Invalid custom header"];
    persistConfirmedMappingProfile(
      "download",
      1,
      invalidHeaders,
      { ฝ่าย: "Invalid custom header" },
      storePath,
    );
    assert.equal(
      loadMappingProfile(computeHeaderSignature(invalidHeaders), storePath),
      null,
    );
  });
});

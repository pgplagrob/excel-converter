import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  AUTHORITATIVE_TEMPLATE_COLUMNS,
  normalizeText,
  type TemplateMapping,
} from "./mapping";

export interface MappingProfileRecord {
  mapping: Record<string, string>;
  savedAt: number;
}

type MappingProfileStore = Record<string, MappingProfileRecord>;

export const MAX_PROFILES = 500;

function defaultStorePath(): string {
  return join(process.cwd(), "data", "mapping-profiles.json");
}

function readStore(storePath: string): MappingProfileStore {
  try {
    const parsed: unknown = JSON.parse(readFileSync(storePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const validRecords = Object.entries(parsed).filter(
      (entry): entry is [string, MappingProfileRecord] => {
        const record = entry[1];
        if (!record || typeof record !== "object" || Array.isArray(record)) return false;
        const candidate = record as Partial<MappingProfileRecord>;
        return (
          typeof candidate.savedAt === "number" &&
          Number.isFinite(candidate.savedAt) &&
          !!candidate.mapping &&
          typeof candidate.mapping === "object" &&
          !Array.isArray(candidate.mapping) &&
          Object.values(candidate.mapping).every((value) => typeof value === "string")
        );
      },
    );
    return Object.fromEntries(validRecords);
  } catch {
    return {};
  }
}

export function computeHeaderSignature(headers: string[]): string {
  const normalizedHeaders = [...new Set(headers.map(normalizeText).filter(Boolean))].sort();
  return createHash("sha256").update(normalizedHeaders.join("\u001f")).digest("hex");
}

export function loadMappingProfile(
  signature: string,
  storePath = defaultStorePath(),
): MappingProfileRecord | null {
  return readStore(storePath)[signature] ?? null;
}

export function saveMappingProfile(
  signature: string,
  mapping: Record<string, string>,
  storePath = defaultStorePath(),
): void {
  const store = readStore(storePath);
  store[signature] = { mapping, savedAt: Date.now() };

  const recordsByAge = Object.entries(store).sort(
    ([, left], [, right]) => left.savedAt - right.savedAt,
  );
  const retainedRecords = recordsByAge.slice(Math.max(0, recordsByAge.length - MAX_PROFILES));

  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(Object.fromEntries(retainedRecords), null, 2), "utf8");
}

export function persistConfirmedMappingProfile(
  mode: "validate" | "download",
  errorCount: number,
  headers: string[],
  finalMapping: TemplateMapping,
  storePath = defaultStorePath(),
): void {
  if (mode !== "download" || errorCount !== 0) return;

  const normalizedMapping = Object.fromEntries(
    Object.entries(finalMapping).flatMap(([templateColumn, sourceColumn]) => {
      if (!sourceColumn || AUTHORITATIVE_TEMPLATE_COLUMNS.has(templateColumn)) return [];
      const normalizedHeader = normalizeText(sourceColumn);
      return normalizedHeader ? [[templateColumn, normalizedHeader]] : [];
    }),
  );
  if (Object.keys(normalizedMapping).length === 0) return;

  saveMappingProfile(computeHeaderSignature(headers), normalizedMapping, storePath);
}

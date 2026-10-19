// A curated dataset folder's CSVs as the texts ingest() takes.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FILE_NAMES } from "../src/pipeline/ingest";
import type { DatasetTexts, FileKind } from "../src/pipeline/ingest";
import { column, parseCsv } from "../src/pipeline/csv";

export const DATASETS = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "datasets");

export function curatedNames(): string[] {
  return column(parseCsv(readFileSync(join(DATASETS, "manifest.csv"), "utf8")), "name")!;
}

export function readDataset(name: string): DatasetTexts {
  const texts: Partial<Record<FileKind, string>> = {};
  for (const [kind, file] of Object.entries(FILE_NAMES) as [FileKind, string][]) {
    const path = join(DATASETS, name, file);
    if (existsSync(path)) texts[kind] = readFileSync(path, "utf8");
  }
  return texts as DatasetTexts;
}

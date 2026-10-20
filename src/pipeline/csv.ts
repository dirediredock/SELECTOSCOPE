// RFC 4180 CSV: comma-separated, fields optionally double-quoted, a quote
// inside a quoted field doubled, CRLF or LF line ends. Cells stay strings:
// type inference would turn "007" into 7, and ids must join as written.

export interface Table {
  header: string[];
  rows: string[][];
}

export class CsvError extends Error {}

export function parseCsv(text: string): Table {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; // a byte order mark
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") {
      quoted = true;
      i++;
    } else if (c === ",") {
      record.push(field);
      field = "";
      i++;
    } else if (c === "\n" || c === "\r") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
    } else {
      field += c;
      i++;
    }
  }
  if (quoted) throw new CsvError("a quoted field never closes");
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  // Blank lines carry nothing.
  const kept = records.filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (kept.length === 0) throw new CsvError("the file is empty");
  const header = kept[0].map((h) => h.trim());
  const rows = kept.slice(1);
  rows.forEach((r, k) => {
    if (r.length !== header.length) {
      throw new CsvError(`row ${k + 2} has ${r.length} fields, the header ${header.length}`);
    }
  });
  return { header, rows };
}

// One column's cells, by name in any case ("Source" is source); null when
// the header lacks it.
export function column(table: Table, name: string): string[] | null {
  const at = table.header.findIndex((h) => h.toLowerCase() === name);
  return at < 0 ? null : table.rows.map((r) => r[at]);
}

import { describe, expect, it } from "vitest";
import { CsvError, column, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads a header and rows as strings", () => {
    const t = parseCsv("node_id,label\n007,Bond\n2,Q\n");
    expect(t.header).toEqual(["node_id", "label"]);
    expect(t.rows).toEqual([
      ["007", "Bond"],
      ["2", "Q"],
    ]);
  });

  it("handles quotes, commas, doubled quotes and newlines in fields", () => {
    const t = parseCsv('node_id,label\r\n1,"Smith, ""Jr."""\r\n2,"two\nlines"\r\n');
    expect(column(t, "label")).toEqual(['Smith, "Jr."', "two\nlines"]);
  });

  it("skips blank lines and a byte order mark, and keeps a last line without newline", () => {
    const t = parseCsv("﻿a,b\n\n1,2\n3,4");
    expect(t.header).toEqual(["a", "b"]);
    expect(t.rows).toHaveLength(2);
  });

  it("refuses ragged rows and unclosed quotes", () => {
    expect(() => parseCsv("a,b\n1\n")).toThrow(CsvError);
    expect(() => parseCsv('a\n"open\n')).toThrow(CsvError);
    expect(() => parseCsv("\n\n")).toThrow(CsvError);
  });

  it("finds columns by name", () => {
    const t = parseCsv("x,y\n1,2\n");
    expect(column(t, "y")).toEqual(["2"]);
    expect(column(t, "z")).toBeNull();
  });
});

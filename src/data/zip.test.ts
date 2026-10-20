import { crc32 as nodeCrc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, zip } from "./zip";

// The archive read back from its central directory, as an unzipper would.
function unzip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  // The central directory runs from its offset to the end record.
  expect(view.getUint32(end + 12, true)).toBe(end - at);
  const dec = new TextDecoder();
  const out = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    expect(view.getUint16(at + 10, true)).toBe(0); // stored
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    expect(view.getUint32(at + 24, true)).toBe(size);
    const nameLen = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    expect(view.getUint32(local + 14, true)).toBe(crc);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    out.push({ name, crc, text: dec.decode(data), data });
    at += 46 + nameLen;
  }
  return out;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    const bytes = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
    expect(crc32(bytes)).toBe(0x414fa339);
    expect(crc32(bytes)).toBe(nodeCrc32(bytes));
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("stores each file whole, with its name, size and checksum", () => {
    const files = [
      { name: "edgelist.csv", text: "source,target\na,b\n" },
      { name: "labels.csv", text: "node_id,label\na,Zoë\n" },
      { name: "empty.csv", text: "" },
    ];
    const read = unzip(zip(files, new Date(2026, 9, 19, 12, 30, 10)));
    expect(read.map((f) => [f.name, f.text])).toEqual(files.map((f) => [f.name, f.text]));
    for (const f of read) expect(f.crc).toBe(nodeCrc32(f.data));
  });
});

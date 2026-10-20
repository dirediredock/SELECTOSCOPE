// A ZIP archive of text files, stored uncompressed (method 0): what Export
// CSVs downloads. Small enough to need no Zip64 or deflate: a dataset's CSVs
// stay far below 4 GB, and a browser unzips stored entries as well as any.

export interface ZipFile {
  name: string;
  text: string;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// MS-DOS time and date, local, to the even second.
function dosStamp(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// Names are UTF-8 (flag bit 11).
const UTF8 = 0x0800;

export function zip(files: ZipFile[], when = new Date()): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const { time, date } = dosStamp(when);
  const entries = files.map((f) => {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    return { name, data, crc: crc32(data) };
  });
  const localSize = entries.reduce((s, e) => s + 30 + e.name.length + e.data.length, 0);
  const directorySize = entries.reduce((s, e) => s + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + directorySize + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (v: number) => {
    view.setUint16(at, v, true);
    at += 2;
  };
  const u32 = (v: number) => {
    view.setUint32(at, v, true);
    at += 4;
  };
  const bytes = (b: Uint8Array) => {
    out.set(b, at);
    at += b.length;
  };
  // The fields a local header and its central record share.
  const common = (e: (typeof entries)[number]) => {
    u16(20); // version needed: 2.0
    u16(UTF8);
    u16(0); // stored
    u16(time);
    u16(date);
    u32(e.crc);
    u32(e.data.length);
    u32(e.data.length);
    u16(e.name.length);
    u16(0); // extra field
  };
  const offsets: number[] = [];
  for (const e of entries) {
    offsets.push(at);
    u32(0x04034b50);
    common(e);
    bytes(e.name);
    bytes(e.data);
  }
  const central = at;
  entries.forEach((e, i) => {
    u32(0x02014b50);
    u16(20); // version made by: 2.0
    common(e);
    u16(0); // comment
    u16(0); // disk
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(offsets[i]);
    bytes(e.name);
  });
  const centralSize = at - central;
  u32(0x06054b50);
  u16(0); // this disk
  u16(0); // central directory's disk
  u16(entries.length);
  u16(entries.length);
  u32(centralSize);
  u32(central);
  u16(0); // comment
  return out;
}

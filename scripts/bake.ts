// Builds every curated dataset (or the ones named) in the app itself, and
// writes the builds the app loads out of the box:
//   npm run bake [name ...] [--out dir]
// It builds the app, serves it (vite preview) and opens it in headless Chrome
// at `?bake`, where src/engine/bakeHook.ts runs the engine on each dataset's
// CSVs, in its workers, as for an upload. public/builds/<name>.json per
// dataset, its thumbnail in public/builds/thumbs/<name>.bin, and
// public/builds/index.json listing them in manifest order. Deterministic:
// re-baking unchanged inputs changes no bytes (scripts/bake.chrome.test.ts).
// Needs Google Chrome; CHROME overrides where it is.

import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { OpeningView } from "../src/data/graph";
import { column, parseCsv } from "../src/pipeline/csv";
import { FILE_NAMES } from "../src/pipeline/ingest";
import type { FileKind } from "../src/pipeline/ingest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATASETS = join(ROOT, "public", "datasets");
export const BUILDS = join(ROOT, "public", "builds");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export interface ManifestRow {
  name: string;
  title: string;
  group: string;
  view: OpeningView;
}

export function manifest(): ManifestRow[] {
  const t = parseCsv(readFileSync(join(DATASETS, "manifest.csv"), "utf8"));
  const [name, title, group, view] = ["name", "title", "group", "view"].map((c) => column(t, c)!);
  return name.map((n, i) => ({ name: n, title: title[i], group: group[i], view: (view[i] || null) as OpeningView }));
}

export interface Baked {
  json: string;
  thumb: Uint8Array;
}

export interface Baker {
  bake(row: ManifestRow): Promise<Baked>;
  close(): Promise<void>;
}

const freePort = () =>
  new Promise<number>((done, fail) => {
    const s = createServer();
    s.once("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => done(port));
    });
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(what: string, ms: number, probe: () => Promise<T | undefined>): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const got = await probe().catch(() => undefined);
    if (got !== undefined) return got;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

// One Chrome DevTools Protocol session on a page.
class Cdp {
  private next = 0;
  private waiting = new Map<number, { done: (v: unknown) => void; fail: (e: Error) => void }>();
  private constructor(private ws: WebSocket) {
    ws.onmessage = (e) => {
      const msg = JSON.parse(String(e.data));
      const w = msg.id !== undefined && this.waiting.get(msg.id);
      if (!w) return;
      this.waiting.delete(msg.id);
      if (msg.error) w.fail(new Error(msg.error.message));
      else w.done(msg.result);
    };
  }
  static open(url: string) {
    return new Promise<Cdp>((done, fail) => {
      const ws = new WebSocket(url);
      ws.onopen = () => done(new Cdp(ws));
      ws.onerror = () => fail(new Error(`can't reach Chrome at ${url}`));
    });
  }
  send(method: string, params: object = {}) {
    const id = ++this.next;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise<any>((done, fail) => this.waiting.set(id, { done, fail }));
  }
  // The value of an expression in the page, awaited.
  async evaluate<T>(expression: string): Promise<T> {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  }
  close() {
    this.ws.close();
  }
}

// The app built and served, and Chrome open on it at `?bake`.
export async function openBaker(): Promise<Baker> {
  const build = spawnSync(join(ROOT, "node_modules", ".bin", "vite"), ["build", "--logLevel", "warn"], { cwd: ROOT, stdio: "inherit" });
  if (build.status !== 0) throw new Error("vite build failed");
  const children: ChildProcess[] = [];
  const profile = mkdtempSync(join(tmpdir(), "selectoscope-bake-"));
  // Chrome writes to its profile until it exits, so the profile goes after.
  const close = async () => {
    await Promise.all(
      children.map((c) => (c.exitCode !== null || c.signalCode !== null ? null : new Promise((done) => c.once("exit", done).kill()))),
    );
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  };
  try {
    const port = await freePort();
    const app = `http://127.0.0.1:${port}/`;
    children.push(
      spawn(join(ROOT, "node_modules", ".bin", "vite"), ["preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
        cwd: ROOT,
        stdio: "ignore",
      }),
    );
    await until("vite preview", 20_000, async () => ((await fetch(app)).ok ? true : undefined));
    const debug = await freePort();
    children.push(
      spawn(CHROME, ["--headless=new", `--remote-debugging-port=${debug}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], {
        stdio: "ignore",
      }),
    );
    const target = await until("Chrome", 20_000, async () => {
      const pages = (await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      return pages.find((p) => p.type === "page")?.webSocketDebuggerUrl;
    });
    const cdp = await Cdp.open(target);
    await cdp.send("Page.navigate", { url: `${app}?bake` });
    await until("the bake hook", 20_000, async () => ((await cdp.evaluate<boolean>("typeof window.selectoscopeBake === 'function'")) ? true : undefined));
    return {
      async bake(row) {
        const files = (Object.keys(FILE_NAMES) as FileKind[]).filter((k) => existsSync(join(DATASETS, row.name, FILE_NAMES[k])));
        const args = [row.name, row.title, row.view, files].map((a) => JSON.stringify(a)).join(", ");
        const { json, thumb } = await cdp.evaluate<{ json: string; thumb: string }>(`window.selectoscopeBake(${args})`);
        return { json, thumb: new Uint8Array(Buffer.from(thumb, "base64")) };
      },
      close() {
        cdp.close();
        return close();
      },
    };
  } catch (e) {
    await close();
    throw e;
  }
}

// Run as a script, not when a test imports it. Why the exact path: a looser
// check (a name ending in "bake.ts") once let a scratch script rewrite the builds.
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--out");
  const out = at >= 0 ? resolve(args[at + 1]) : BUILDS;
  const only = args.filter((_, i) => at < 0 || (i !== at && i !== at + 1));
  const rows = manifest();
  const unknown = only.filter((n) => !rows.some((r) => r.name === n));
  if (unknown.length) throw new Error(`not in the manifest: ${unknown.join(", ")}`);
  mkdirSync(join(out, "thumbs"), { recursive: true });
  const baker = await openBaker();
  try {
    for (const row of rows) {
      if (only.length && !only.includes(row.name)) continue;
      const t0 = performance.now();
      const { json, thumb } = await baker.bake(row);
      writeFileSync(join(out, `${row.name}.json`), json);
      writeFileSync(join(out, "thumbs", `${row.name}.bin`), thumb);
      console.log(`${row.name}: ${(json.length / 1e6).toFixed(2)} MB, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    }
  } finally {
    await baker.close();
  }
  // The index reads every build in `out`, falling back to the committed one
  // for a dataset not baked there.
  const index = rows.map((r) => {
    const file = existsSync(join(out, `${r.name}.json`)) ? join(out, `${r.name}.json`) : join(BUILDS, `${r.name}.json`);
    const { meta, nodes } = JSON.parse(readFileSync(file, "utf8"));
    return { name: r.name, title: r.title, group: r.group, view: r.view, nodes: meta.nodes, edges: meta.edges, has_labels: !!nodes.label };
  });
  writeFileSync(join(out, "index.json"), JSON.stringify({ datasets: index }));
}

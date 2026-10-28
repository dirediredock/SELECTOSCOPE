import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The interface store reads the saved theme and settings on import, so each test stubs
// the page and storage first, then imports it afresh.
function stubStorage(saved: Record<string, string> = {}, broken = false) {
  const items = new Map(Object.entries(saved));
  const fail = () => {
    throw new Error("blocked");
  };
  vi.stubGlobal("localStorage", {
    getItem: broken ? fail : (k: string) => items.get(k) ?? null,
    setItem: broken ? fail : (k: string, v: string) => void items.set(k, v),
  });
  return items;
}

async function load() {
  vi.resetModules();
  return import("./interface");
}

beforeEach(() => {
  vi.stubGlobal("document", { documentElement: { dataset: {}, style: { setProperty() {} } } });
});

afterEach(() => vi.unstubAllGlobals());

describe("the help flag", () => {
  it("is off by default", async () => {
    stubStorage();
    const { interfaceStore } = await load();
    expect(interfaceStore.get().help).toBe(false);
  });

  it("starts off on every load, even if it was left on", async () => {
    stubStorage({ "selectoscope-help": "1" });
    const { interfaceStore } = await load();
    expect(interfaceStore.get().help).toBe(false);
  });

  it("toggles without saving", async () => {
    const items = stubStorage();
    const { interfaceStore, toggleHelp } = await load();
    toggleHelp();
    expect(interfaceStore.get().help).toBe(true);
    toggleHelp();
    expect(interfaceStore.get().help).toBe(false);
    expect(items.has("selectoscope-help")).toBe(false);
  });

  it("closes the header menu either way", async () => {
    stubStorage();
    const { interfaceStore, setHelp, toggleMenu } = await load();
    toggleMenu("s0");
    setHelp(true);
    expect(interfaceStore.get().menuOpen).toBeNull();
    toggleMenu("s0");
    setHelp(false);
    expect(interfaceStore.get().menuOpen).toBeNull();
  });

  it("lasts the session when storage is blocked", async () => {
    stubStorage({}, true);
    const { interfaceStore, toggleHelp } = await load();
    expect(interfaceStore.get().help).toBe(false);
    toggleHelp();
    expect(interfaceStore.get().help).toBe(true);
  });
});

describe("+ New", () => {
  it("gives the ring back to the dataset on screen on a selection", async () => {
    stubStorage();
    const { interfaceStore, openNew } = await load();
    const { applySelection } = await import("./selection");
    openNew();
    expect(interfaceStore.get().upload).toBe("csv");
    applySelection("node", "replace", [0]);
    expect(interfaceStore.get().upload).toBe(null);
  });
});

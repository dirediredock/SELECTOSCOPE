import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Store } from "../../state/createStore";
import helpText from "../../../../docs/help_pane.txt?raw";

// uiStore reads the saved theme and settings on import.
vi.hoisted(() => {
  Object.assign(globalThis, {
    document: { documentElement: { dataset: {}, style: { setProperty() {} } } },
    localStorage: { getItem: () => null, setItem() {} },
  });
});

vi.mock("../../state/createStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../state/createStore")>()),
  useStore: <S extends object, T>(store: Store<S>, pick: (state: S) => T) => pick(store.get()),
}));

const { HelpPane } = await import("./HelpPane");
const { HELP_SECTIONS } = await import("./helpNav");
const html = renderToStaticMarkup(<HelpPane />);

describe("Help", () => {
  it("has one section per Sections option, in order", () => {
    const ids = [...html.matchAll(/data-sec="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(HELP_SECTIONS.map((s) => s.id));
  });

  it("shows every line of docs/help_pane.txt word for word", () => {
    // The sheet's words: no copies or figures.
    const shown = html
      .replace(/<div class="help-replica-row">.*?<\/div><\/div>/g, " ")
      .replace(/<svg.*?<\/svg>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");
    const lines = helpText
      .split("\n")
      .map((l) => l.trim().replace(/^\d+\. /, ""))
      .filter((l) => l && l !== "HELP PANE");
    // Headings are written in caps there and set in caps by the sheet's style.
    const missing = lines.filter((l) => !shown.includes(l) && !(l === l.toUpperCase() && shown.toUpperCase().includes(l)));
    expect(missing).toEqual([]);
  });

  it("draws its controls only as inert copies", () => {
    // Walk the tags, tracking how deep inside an inert copy each one sits.
    const VOID = new Set(["input", "br", "img", "hr", "meta", "link"]);
    const stack: boolean[] = [];
    let live = 0;
    let inert = 0;
    for (const [tag, close, name] of html.matchAll(/<(\/?)([a-z0-9]+)\b[^>]*>/g)) {
      if (close) {
        stack.pop();
        continue;
      }
      const inside = stack.includes(true) || tag.includes('inert=""');
      if (/^(button|input|select|textarea)$/.test(name!)) inside ? inert++ : live++;
      if (!VOID.has(name!) && !tag.endsWith("/>")) stack.push(tag.includes('inert=""'));
    }
    expect(inert).toBeGreaterThan(10);
    expect(live).toBe(0);
  });
});

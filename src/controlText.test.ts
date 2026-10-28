import { describe, expect, it } from "vitest";
import helpText from "../docs/help_pane.txt?raw";
import tooltipsText from "../docs/tooltips_ui.txt?raw";
import { parseTooltips, TEXT, TOOLTIPS, TOOLTIPS_READ } from "./controlText";
import "./controlOptions";
import { INTRO } from "./panes/data/intros";

// Tooltips are read from docs/tooltips_ui.txt. The Data list's + New
// sentence is cut from Help: Help's words in Help's order from one paragraph,
// with words left out.

// A word without the punctuation around it, so a cut can end a clause early.
// Case is ignored, and "+NEW" reads as "+ NEW".
const words = (text: string) =>
  text
    .replace(/\+\s+/g, "+")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}%+−▲▼]+|[^\p{L}\p{N}%+−▲▼]+$/gu, "").toLowerCase())
    .filter(Boolean);

const paragraphs = helpText
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .map(words);

// The sentence's words in order within the paragraph's. Taking each word at
// its first place left is never worse than a later one.
function cutFrom(sentence: string[], paragraph: string[]): boolean {
  let at = 0;
  for (const w of sentence) {
    while (at < paragraph.length && paragraph[at] !== w) at++;
    if (at === paragraph.length) return false;
    at++;
  }
  return true;
}

// Every tooltip in TEXT: keys ending in Tip or tip.
function tips(node: object, path: string[] = []): [string, string][] {
  return Object.entries(node).flatMap(([key, value]): [string, string][] => {
    const at = [...path, key];
    if (typeof value === "object") return tips(value as object, at);
    const isTip = /tip$/i.test(key);
    return isTip && typeof value === "string" ? [[at.join("."), value]] : [];
  });
}

describe("cutFrom", () => {
  const help = words("Click STOP, or change the selection, to end the sweep.");
  it("takes words left out", () => {
    expect(cutFrom(words("Click STOP to end the sweep."), help)).toBe(true);
    expect(cutFrom(words("Change the selection."), help)).toBe(true);
  });
  it("refuses a word added, reworded or moved", () => {
    expect(cutFrom(words("Click STOP to end the active sweep."), help)).toBe(false);
    expect(cutFrom(words("Click STOP to stop the sweep."), help)).toBe(false);
    expect(cutFrom(words("End the sweep, click STOP."), help)).toBe(false);
  });
});

describe("parseTooltips", () => {
  it("keys each line by its heading and label, splitting at the first colon", () => {
    const map = parseTooltips("STRIP\n\nTRAY: One: two.\nTRAY, IDLE: Three.\n");
    expect([...map]).toEqual([
      ["STRIP / TRAY", "One: two."],
      ["STRIP / TRAY, IDLE", "Three."],
    ]);
  });
  it("refuses a repeated label or a line that is neither", () => {
    expect(() => parseTooltips("STRIP\nTRAY: One.\nTRAY: Two.")).toThrow();
    expect(() => parseTooltips("STRIP\nA stray line.")).toThrow();
  });
});

describe("tooltips", () => {
  const all = tips(TEXT);

  it("are found", () => {
    expect(all.length).toBe(TOOLTIPS.size);
  });

  it("use every line of docs/tooltips_ui.txt", () => {
    expect(parseTooltips(tooltipsText).size).toBe(TOOLTIPS.size);
    expect([...TOOLTIPS.keys()].filter((k) => !TOOLTIPS_READ.has(k))).toEqual([]);
  });

  it("end every sentence with a full stop", () => {
    expect(all.filter(([, tip]) => !tip.endsWith(".")).map(([key]) => key)).toEqual([]);
  });
});

describe("the Data list's + New sentence", () => {
  it("is cut from Help", () => {
    const uncut = [INTRO].filter((s) => !paragraphs.some((p) => cutFrom(words(s), p)));
    expect(uncut).toEqual([]);
  });
});

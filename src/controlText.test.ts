import { describe, expect, it } from "vitest";
import helpText from "../docs/help.txt?raw";
import { TEXT } from "./controlText";

// Tooltips are cut from Help, never written: each tip sentence is Help's
// words in Help's order from one paragraph, with words left out, its first
// letter capitalised if need be.

// A word without the punctuation around it, so a cut can end a clause early.
const words = (text: string) =>
  text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}%+−▲▼]+|[^\p{L}\p{N}%+−▲▼]+$/gu, ""))
    .filter(Boolean);

const paragraphs = helpText
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .map(words);

const capitalised = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

// The sentence's words in order within the paragraph's. Taking each word at
// its first place left is never worse than a later one.
function cutFrom(sentence: string[], paragraph: string[]): boolean {
  let at = 0;
  for (const [i, w] of sentence.entries()) {
    while (at < paragraph.length && paragraph[at] !== w && !(i === 0 && capitalised(paragraph[at]!) === w)) at++;
    if (at === paragraph.length) return false;
    at++;
  }
  return true;
}

// Every tooltip in TEXT: keys ending in Tip or tip, and every hint.
function tips(node: object, path: string[] = []): [string, string][] {
  return Object.entries(node).flatMap(([key, value]): [string, string][] => {
    const at = [...path, key];
    if (typeof value === "object") return tips(value as object, at);
    const isTip = at[0] === "hints" || /tip$/i.test(key);
    return isTip && typeof value === "string" ? [[at.join("."), value]] : [];
  });
}

describe("cutFrom", () => {
  const help = words("Click STOP, or change the selection, to end the sweep.");
  it("takes words left out and a first letter capitalised", () => {
    expect(cutFrom(words("Click STOP to end the sweep."), help)).toBe(true);
    expect(cutFrom(words("Change the selection."), help)).toBe(true);
  });
  it("refuses a word added, reworded or moved, or a capital mid-sentence", () => {
    expect(cutFrom(words("Click STOP to end the active sweep."), help)).toBe(false);
    expect(cutFrom(words("Click STOP to stop the sweep."), help)).toBe(false);
    expect(cutFrom(words("End the sweep, click STOP."), help)).toBe(false);
    expect(cutFrom(words("Click STOP to End the sweep."), help)).toBe(false);
  });
});

describe("tooltips", () => {
  const all = tips(TEXT);

  it("are found", () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it("are cut from Help, sentence by sentence", () => {
    const uncut = all.flatMap(([key, tip]) =>
      tip
        .split(/(?<=[.!?])\s+/)
        .filter((s) => !paragraphs.some((p) => cutFrom(words(s), p)))
        .map((s) => `${key}: ${s}`),
    );
    expect(uncut).toEqual([]);
  });

  it("end every sentence with a full stop", () => {
    expect(all.filter(([, tip]) => !tip.endsWith(".")).map(([key]) => key)).toEqual([]);
  });
});

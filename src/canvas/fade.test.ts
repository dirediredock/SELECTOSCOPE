import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";
import { contrastShare, fade } from "./fade";

describe("Contrast's fade", () => {
  it("runs from full strength at 0% to the floor at 100%", () => {
    expect(contrastShare(0)).toBe(1);
    expect(contrastShare(50)).toBeCloseTo(0.55);
    expect(contrastShare(100)).toBeCloseTo(0.1);
  });

  it("leaves the ink alone at full strength", () => {
    expect(fade("#2f3540", "#ffffff", 1)).toBe("#2f3540");
    expect(fade("rgba(14, 18, 28, 0.28)", "#ffffff", 1)).toBe("rgba(14, 18, 28, 0.28)");
  });

  it("mixes an opaque ink toward the panel", () => {
    expect(fade("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
    expect(fade("#c4ccd9", "#10141c", 0.1)).toBe("rgb(34, 38, 47)");
    expect(fade("rgb(0, 0, 0)", "#ffffff", 0.1)).toBe("rgb(230, 230, 230)");
  });

  it("scales a translucent ink's alpha", () => {
    expect(fade("rgba(14, 18, 28, 0.28)", "#ffffff", 0.5)).toBe("rgba(14, 18, 28, 0.14)");
    expect(fade("rgba(255, 255, 255, 0.22)", "#10141c", 0.1)).toBe("rgba(255, 255, 255, 0.022)");
  });

  it("reads the short hex forms the built CSS writes", () => {
    expect(fade("#2f3540", "#fff", 0.5)).toBe("rgb(151, 154, 160)");
    expect(fade("#ffffff38", "#10141c", 0.1)).toBe("rgba(255, 255, 255, 0.022)");
    expect(fade("#0e121c47", "#fff", 0.5)).toBe("rgba(14, 18, 28, 0.1392)");
    expect(fade("#0008", "#fff", 0.5)).toBe("rgba(0, 0, 0, 0.2667)");
  });

  it("draws an unreadable colour as it is", () => {
    expect(fade("tomato", "#ffffff", 0.5)).toBe("tomato");
  });
});

// The dev server serves styles.css as written, but the build minifies it with
// Lightning CSS, which rewrites colours. Every ink readInk fades must still
// fade once minified, in both themes.
describe("Contrast's fade in the built CSS", () => {
  const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");
  const built = transform({ filename: "styles.css", code: Buffer.from(css), minify: true }).code.toString();
  const block = (selector: string) => {
    const at = built.indexOf(selector + "{");
    expect(at).toBeGreaterThanOrEqual(0);
    return built.slice(at, built.indexOf("}", at));
  };
  const token = (body: string, name: string) => new RegExp(`${name}:([^;]+)`).exec(body)?.[1]!.trim();

  for (const [theme, selector] of [
    ["light", ":root"],
    ["dark", ":root[data-theme=dark]"],
  ]) {
    it(`fades every unselected ink in ${theme}`, () => {
      const body = block(selector!);
      const panel = token(body, "--panel")!;
      for (const name of ["--mark-node", "--mark-edge", "--edge", "--grid", "--muted"]) {
        const ink = token(body, name);
        expect(ink, name).toBeDefined();
        expect(fade(ink!, panel, 0.5), `${name}: ${ink} over ${panel}`).not.toBe(ink);
      }
    });
  }
});

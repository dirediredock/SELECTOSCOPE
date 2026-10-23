import { createStore } from "./createStore";
import { SELECT_MODES } from "../controlOptions";
import { layout } from "./layout";
import { selection } from "./selection";
import type { SelectTarget } from "./selection";
import type { SlotId } from "./layout";
import { contrastShare } from "../canvas/fade";

export type Tool = "lasso" | "rect";

export type Theme = "light" | "dark";

// UPLOAD YOUR DATA's two ways in.
export type Upload = "csv" | "json";

export interface UiState {
  // The pane whose controls fill the bottom strip: the last one the pointer
  // entered or pressed, or the pane containing keyboard focus. It holds
  // outside panes and on the way from the pane to its controls, so the strip
  // stays put on the way to it (hoverFocus.ts).
  focused: SlotId | null;
  // A pane the pointer is crossing on the way to the strip, which doesn't
  // take focus: its banner turns faintly gray, so the pass reads as seen.
  passed: SlotId | null;
  // The pane whose header menu is open.
  menuOpen: SlotId | null;
  tool: Tool;
  selectMode: SelectTarget;
  theme: Theme;
  // How far the unselected pattern inside the panes fades, as a percent (see
  // CONTRAST).
  contrast: number;
  // The Data pane shows a thumbnail tile per dataset rather than a row.
  thumbnails: boolean;
  // While + New is picked, the way UPLOAD YOUR DATA has chosen, whose trays
  // the Data strip serves; null, it serves the dataset on screen.
  upload: Upload | null;
  // The way + New opens on: CSV at first, then the last one picked.
  lastUpload: Upload;
  // The strip's + New is hovered or focused: the list shows the + New row
  // as hovered.
  newHover: boolean;
  // The Data slot shows Help rather than the dataset list.
  help: boolean;
  // Help shows its diagrams and control copies beside the text.
  figures: boolean;
  // Held Space turns a drag into navigation (the hand).
  spaceHeld: boolean;
}

// Contrast fades every unselected pattern inside the panes toward the pane's
// background, so a selection that is hard to spot stands out: none at 0%, the
// most at 100%, where a floor keeps the pattern faintly visible
// (contrastShare). It lasts the session.
export const CONTRAST = { min: 0, max: 100, opening: 0 } as const;

// Both by default, and remembered across reloads.
const SELECT_KEY = "selectoscope-select";

function savedSelectMode(): SelectTarget {
  try {
    const saved = localStorage.getItem(SELECT_KEY);
    return SELECT_MODES.find((m) => m.id === saved)?.id ?? "both";
  } catch {
    return "both";
  }
}

// NodeLink owns the strip until the pointer enters a pane.
const openingSlot = layout.get().slots.find((s) => s.type === "nodelink")?.slot ?? null;

export const ui = createStore<UiState>({
  focused: openingSlot,
  passed: null,
  menuOpen: null,
  tool: "lasso",
  selectMode: savedSelectMode(),
  // Light on every load, as index.html paints it.
  theme: "light",
  contrast: CONTRAST.opening,
  // On on every load: the pictures are the quickest read of each dataset.
  thumbnails: true,
  upload: null,
  lastUpload: "csv",
  newHover: false,
  // Off on every load: the list is where a session starts.
  help: false,
  // On on every load: a first read of Help wants its pictures.
  figures: true,
  spaceHeld: false,
});

// Hover, a press or keyboard focus in a pane gives it the strip.
export function focus(slot: SlotId) {
  if (ui.get().focused !== slot) ui.set({ focused: slot });
}

export function toggleMenu(slot: SlotId) {
  ui.set((s) => ({ menuOpen: s.menuOpen === slot ? null : slot }));
}

export function closeMenu() {
  ui.set({ menuOpen: null });
}

// Space, as in Photoshop: held, a drag navigates.
export function pressSpace() {
  ui.set({ spaceHeld: true });
}

// Also when Space is let go in another window, so no hand is stuck on.
export function releaseSpace() {
  if (ui.get().spaceHeld) ui.set({ spaceHeld: false });
}

export function setTool(tool: Tool) {
  ui.set({ tool });
}

export function setSelectMode(selectMode: SelectTarget) {
  try {
    localStorage.setItem(SELECT_KEY, selectMode);
  } catch {
    // As for the theme: without storage it lasts the session.
  }
  ui.set({ selectMode });
}

export function toggleTheme() {
  const theme: Theme = ui.get().theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  ui.set({ theme });
}

// The canvases read it through readInk; Labels' rows through --contrast.
export function setContrast(contrast: number) {
  document.documentElement.style.setProperty("--contrast", String(contrastShare(contrast)));
  ui.set({ contrast });
}

// A canvas repaints when its ink changes: a new theme or a new contrast.
export function inkChanged(s: UiState, prev: UiState) {
  return s.theme !== prev.theme || s.contrast !== prev.contrast;
}

export function toggleThumbnails() {
  ui.set({ thumbnails: !ui.get().thumbnails });
}

export function setUpload(upload: Upload | null) {
  if (ui.get().upload !== upload) ui.set(upload ? { upload, lastUpload: upload } : { upload });
}

// The Data pane's + New: the strip turns to uploading, on the way last used.
export function openNew() {
  setUpload(ui.get().lastUpload);
}

// A selection in any pane works on the dataset on screen, so + New gives the
// ring and the strip back to it. The draft keeps what was picked.
selection.subscribe((s, prev) => {
  if (s.nodes !== prev.nodes || s.edges !== prev.edges) setUpload(null);
});

export function setNewHover(newHover: boolean) {
  if (ui.get().newHover !== newHover) ui.set({ newHover });
}

export function toggleFigures() {
  ui.set((s) => ({ figures: !s.figures }));
}

// The menu row and both ? buttons set this one flag, so they always agree.
// Either way the header menu closes.
export function setHelp(help: boolean) {
  ui.set({ help, menuOpen: null });
}

export function toggleHelp() {
  setHelp(!ui.get().help);
}

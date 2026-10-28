import { createStore } from "./createStore";
import type { SelectTarget } from "./selection";
import { contrastShare } from "../canvas/fade";

// The app-wide settings a user picks and expects to stay put while they work:
// the selection tool and mode, the look of the panes, and two show/hide
// toggles. What is open, focused or held right now is interface.ts's.

export type Tool = "lasso" | "rect";

export type Theme = "light" | "dark";

export interface ControlsState {
  tool: Tool;
  selectMode: SelectTarget;
  theme: Theme;
  // How far the unselected pattern inside the panes fades, as a percent (see
  // CONTRAST).
  contrast: number;
  // The Data pane shows a thumbnail tile per dataset rather than a row.
  thumbnails: boolean;
  // Help shows its diagrams and control copies beside the text.
  figures: boolean;
}

// Contrast fades every unselected pattern inside the panes toward the pane's
// background, so a selection that is hard to spot stands out: none at 0%, the
// most at 100%, where a floor keeps the pattern faintly visible
// (contrastShare). It lasts the session.
export const CONTRAST = { min: 0, max: 100, opening: 20 } as const;

export const controlsStore = createStore<ControlsState>({
  tool: "lasso",
  // Both on every load.
  selectMode: "both",
  // Light on every load, as index.html paints it.
  theme: "light",
  contrast: CONTRAST.opening,
  // On on every load: the pictures are the quickest read of each dataset.
  thumbnails: true,
  // On on every load: a first read of Help wants its pictures.
  figures: true,
});

export function setTool(tool: Tool) {
  controlsStore.set({ tool });
}

export function setSelectMode(selectMode: SelectTarget) {
  controlsStore.set({ selectMode });
}

export function toggleTheme() {
  const theme: Theme = controlsStore.get().theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  controlsStore.set({ theme });
}

// The canvases read it through readInk; Labels' rows through --contrast.
export function setContrast(contrast: number) {
  document.documentElement.style.setProperty("--contrast", String(contrastShare(contrast)));
  controlsStore.set({ contrast });
}

// A canvas repaints when its ink changes: a new theme or a new contrast.
export function inkChanged(s: ControlsState, prev: ControlsState) {
  return s.theme !== prev.theme || s.contrast !== prev.contrast;
}

export function toggleThumbnails() {
  controlsStore.set((s) => ({ thumbnails: !s.thumbnails }));
}

export function toggleFigures() {
  controlsStore.set((s) => ({ figures: !s.figures }));
}

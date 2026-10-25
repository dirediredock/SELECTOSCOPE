import { TEXT } from "../controlText";

// The pane types, in the default line-up. `native` is the item type the pane
// selects and hovers; `list` panes scroll vertically with the wheel. `ar` is
// the default width / height (styles.css `--ar`). Data's gives it 70% of the
// share a 1 / 3 would in Fit's opening row, so the room goes to the plots.
export const PANES = [
  { id: "dataset", title: "Data", native: null, list: true, ar: 0.224 },
  { id: "labels", title: "Labels", native: "node", list: true, ar: 1 / 3 },
  { id: "nodelink", title: "NodeLink", native: "node", list: false, ar: 1 },
  { id: "matrix", title: "Matrix", native: "edge", list: false, ar: 1 / 3 },
  { id: "ksnakes", title: "Shells", native: "node", list: false, ar: 1 / 3 },
  { id: "hopcensus", title: "Hops", native: "node", list: false, ar: 1 / 3 },
] as const;

export type PaneType = (typeof PANES)[number]["id"];

export const paneInfo = (type: PaneType) => PANES.find((p) => p.id === type)!;
export const paneTitle = (type: PaneType) => paneInfo(type).title;

// The widest a pane may be, as width / height. Data's rows read at portrait
// golden, and a wider list only adds empty room: the menu offers no wider
// shape, and in Fit its width stops there and the other panes take the rest.
export const MAX_AR: Partial<Record<PaneType, number>> = { dataset: 0.618 };

// Every pane's opening ratio in the Scroll row: tall 3:1, the middle of
// SCROLL_SHAPES, NodeLink included.
export const SCROLL_OPENING_AR = 1 / 3;

// What the header menu offers. Data is fixed at the far left: it is never
// offered, and it can only become Help (DATASET_VIEWS).
export const SWAPPABLE = PANES.filter((p) => p.id !== "dataset");

// What the Data slot's menu offers in place of the types: its list, or the
// Help in the same slot.
export const DATASET_VIEWS = [
  { id: "list", title: "Data" },
  { id: "help", title: "Help" },
] as const;

// A slot's title: the Data slot's names what it shows.
export const slotTitle = (type: PaneType, help: boolean) =>
  type === "dataset" && help ? DATASET_VIEWS[1].title : paneTitle(type);

// The shapes the header menu offers, as width / height. `ar` null is the
// narrowest a pane gets: the row's minimum width, whatever the height.
const MINIMUM = { ar: null, glyph: 1 / 6, label: TEXT.shapes.minimum } as const;
const PORTRAIT_GOLDEN = { ar: 0.618, glyph: 0.618, label: TEXT.shapes.portraitGolden } as const;

// In Fit: minimum, portrait golden and square.
export const FIT_SHAPES = [MINIMUM, PORTRAIT_GOLDEN, { ar: 1, glyph: 1, label: TEXT.shapes.square }] as const;

// In Scroll: minimum, tall 3:1 (every pane's opening shape there) and
// portrait golden, the widest: a portrait window has no room for a square at
// full height.
export const SCROLL_SHAPES = [MINIMUM, { ar: 1 / 3, glyph: 1 / 3, label: TEXT.shapes.tall }, PORTRAIT_GOLDEN] as const;

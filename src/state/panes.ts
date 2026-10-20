import { TEXT } from "../controlText";

// The pane types, in the default line-up. `native` is the item type the pane
// selects and hovers; `list` panes scroll vertically with the wheel. `ar` is
// the default width / height (styles.css `--ar`).
export const PANES = [
  { id: "dataset", title: "Data", native: null, list: true, ar: 1 / 3 },
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

// The four ratios in the header menu in Scroll, as width / height.
export const RATIOS = [
  { ar: 1 / 3, label: TEXT.shapes.tall },
  { ar: 0.618, label: TEXT.shapes.portraitGolden },
  { ar: 1, label: TEXT.shapes.square },
  { ar: 1.618, label: TEXT.shapes.landscapeGolden },
] as const;

// The three shapes the header menu offers in Fit: the narrowest a pane gets
// (`ar` null: its width is the row's minimum, whatever the height; its tile
// shows the 3:1 glyph), portrait golden and square.
export const FIT_SHAPES = [
  { ar: null, glyph: 1 / 3, label: TEXT.shapes.minimum },
  { ar: 0.618, glyph: 0.618, label: TEXT.shapes.portraitGolden },
  { ar: 1, glyph: 1, label: TEXT.shapes.square },
] as const;

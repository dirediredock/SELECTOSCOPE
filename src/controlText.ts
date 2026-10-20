import dataTooltipsText from "../docs/tooltips_data.txt?raw";
import tooltipsText from "../docs/tooltips_ui.txt?raw";
import { parseTooltipLines } from "./tooltipLines";

// Every word the controls speak or show on hover but never print: accessible
// names where there is no visible text (a glyph, a tile), and every tooltip (a
// tooltip is also its tray's accessible description). A control with visible
// text is named by that text, so a group of controls is named by its
// section's caps label. Visible words (option labels, section labels, pane
// titles) stay beside their ids.
//
// Format:
//   names         sentence case, a few words, no full stop ("Zoom out"),
//                 kept here
//   tooltips      read from docs/tooltips_ui.txt, the one place their wording is
//                 edited. Each sentence ends with a full stop
//                 (controlText.test.ts checks every one, and that every line
//                 there is used).
//   trays         only trays carry tooltips, never a single control: a tray's
//                 tip is its lead, then why it is idle, joined by trayTip
//                 (controls.tsx). A file pill shows its file's report alone.
//                 The one row with a tip of its own: a curated dataset's,
//                 what its nodes and edges are (and any licence or
//                 acknowledgement), read from docs/tooltips_data.txt.

// docs/tooltips_ui.txt: the headings are a strip or a pane, and a label is the
// tray's caps label, with ", VARIANT" for a state of it.
export function parseTooltips(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const { heading, label, text: tip } of parseTooltipLines(text, "docs/tooltips_ui.txt")) {
    const key = `${heading} / ${label}`;
    if (out.has(key)) throw new Error(`docs/tooltips_ui.txt: ${key} is given twice`);
    out.set(key, tip);
  }
  return out;
}

export const TOOLTIPS = parseTooltips(tooltipsText);

// docs/tooltips_data.txt: the headings are the Data pane's groups, and a
// label is a curated dataset's name (scripts/datasets.test.ts holds the file
// to the manifest).
export const DATA_TOOLTIPS = new Map(parseTooltipLines(dataTooltipsText, "docs/tooltips_data.txt").map((l) => [l.label, l.text]));

// The keys TEXT reads, so a line nothing reads is caught (controlText.test.ts).
export const TOOLTIPS_READ = new Set<string>();

function tip(heading: string, label: string): string {
  const key = `${heading} / ${label}`;
  const text = TOOLTIPS.get(key);
  if (text === undefined) throw new Error(`docs/tooltips_ui.txt has no ${label} under ${heading}`);
  TOOLTIPS_READ.add(key);
  return text;
}

const TOP = "TOP CONTROL STRIP";
const HEADER = "PANE HEADER";
const STRIP = "EVERY PANE'S BOTTOM CONTROL STRIP";
const DATA = "DATA PANE";
const HELP = "HELP PANE";
const LABELS = "LABELS PANE";
const NODELINK = "NODELINK PANE";
const MATRIX = "MATRIX PANE";
const CORES = "CORES PANE";
const HOPS = "HOPS PANE";

export const TEXT = {
  // The top strip.
  top: {
    selectSetTip: tip(TOP, "SELECTION SET"),
    countTip: tip(TOP, "SELECTION COUNT"),
    // While a sweep is active the count follows the band and offers no Clear.
    countSweepTip: tip(TOP, "SELECTION COUNT, SWEEPING"),
    brushTip: tip(TOP, "BRUSH"),
    extendTip: tip(TOP, "EXTEND SET"),
    // Brush and Extend set, while a sweep is active.
    sweepingTip: tip(TOP, "BRUSH AND EXTEND SET, SWEEPING"),
    themeTip: tip(TOP, "THEME"),
    grow: "Grow",
    shrink: "Shrink",
  },

  // Every pane's banner and header menu.
  pane: {
    sweepRunning: "Auto Sweep active",
    // The header, a tray of its own: the title's menu, then the zoom percent's fit or Data's ?.
    menuTip: tip(HEADER, "TITLE"),
    fitTip: tip(HEADER, "ZOOM %"),
    helpTip: tip(HEADER, "?"),
    menu: "Pane type and shape",
    menuTypes: "Pane type",
    menuShapes: "Pane shape",
  },

  // The header menu's shape tiles, which show only a glyph.
  shapes: {
    tall: "Tall 3:1",
    portraitGolden: "Portrait golden",
    square: "Square",
    landscapeGolden: "Landscape golden",
    minimum: "Minimum",
  },

  // The bottom strip's Zoom stepper.
  zoom: {
    name: "Zoom",
    out: "Zoom out",
    in: "Zoom in",
    tip: tip(STRIP, "ZOOM"),
  },

  // The bottom strip's Auto Sweep and Sweep controls sections.
  sweep: {
    // Auto Sweep, by sweep state: idle, running, paused.
    runTip: tip(STRIP, "AUTO SWEEP, IDLE"),
    stopTip: tip(STRIP, "AUTO SWEEP, RUNNING"),
    resumeTip: tip(STRIP, "AUTO SWEEP, PAUSED"),
    controlsTip: tip(STRIP, "SWEEP CONTROLS"),
    // Labels' strip has no Vertical.
    controlsLabelsTip: tip(STRIP, "SWEEP CONTROLS, LABELS PANE"),
    idleTip: tip(STRIP, "SWEEP CONTROLS, IDLE"),
    stepForward: "Forwards step",
    stepBack: "Backwards step",
  },

  // Help's ? buttons, which show only a glyph, and its strip.
  help: {
    name: "Help",
    sections: "Sections",
    // The ? at every pane strip's left end.
    stripTip: tip(STRIP, "?"),
    figuresTip: tip(HELP, "SHOW"),
  },

  dataset: {
    // Dataset, by what the Data pane rings.
    csvTip: tip(DATA, "DATASET, BUILDING FROM CSV"),
    jsonTip: tip(DATA, "DATASET, UPLOADING FROM JSON"),
    curatedTip: tip(DATA, "DATASET, CURATED"),
    ownTip: tip(DATA, "DATASET, YOUR OWN"),
    buildingTip: tip(DATA, "DATASET, BUILDING"),
    changeTip: tip(DATA, "CHANGE"),
    changeJsonTip: tip(DATA, "CHANGE, FROM JSON"),
    thumbnailsTip: tip(DATA, "SHOW"),
    newTip: tip(DATA, "ADD DATASET"),
    // The refusal hue's dot, which shows only a colour.
    alert: "Did not load",
  },

  labels: {
    sortTip: tip(LABELS, "VERTICAL ORDER BY"),
    // Shown in place of the rows when Labels (A–Z) has no labels to sort.
    missing: "Add labels",
  },

  nodelink: {
    // Shown in place of the drawing when the dataset lacks the layout picked.
    missing: {
      fd: "",
      fd3d: "Compute 3D layout",
      own2d: "Add a bespoke 2D layout",
      own3d: "Add a bespoke 3D layout",
    },
    layoutTip: tip(NODELINK, "LAYOUT"),
    tooLargeTip: tip(NODELINK, "LAYOUT, TOO LARGE"),
  },

  matrix: {
    seriationTip: tip(MATRIX, "DIAGONAL ORDER BY"),
    formTip: tip(MATRIX, "LAYOUT"),
  },

  ksnakes: {
    orderingTip: tip(CORES, "HORIZONTAL ORDER BY"),
    verticalTip: tip(CORES, "VERTICAL"),
  },

  hopcensus: {
    measureTip: tip(HOPS, "HORIZONTAL WAVE ORDER BY"),
  },
} as const;

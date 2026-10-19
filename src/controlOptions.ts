// The options each Choice offers: its id, its visible label and, where Help
// describes the option one by one, its hint (worded in controlText.ts), which
// its tray's tip adds while it is chosen. Kept free of the stores and the DOM.
import { TEXT } from "./controlText";
import type { SelectTarget } from "./state/selection";

// The chosen option's hint, for its tray's tip.
export const hintOf = <T extends string>(options: readonly { id: T; hint?: string }[], id: T | null) =>
  options.find((o) => o.id === id)?.hint;
import type { Tool, Upload } from "./state/uiStore";

// Where a lasso or rect writes. In a node pane: the nodes inside it, the
// edges those nodes share (both endpoints inside), or both. In the matrix:
// the edges' endpoints, the edges inside it, or both. One setting for the
// whole app.
export const SELECT_MODES = [
  { id: "node", label: "Nodes" },
  { id: "edge", label: "Edges" },
  { id: "both", label: "Both" },
] as const satisfies readonly { id: SelectTarget; label: string }[];

export const TOOLS: readonly { id: Tool; label: string }[] = [
  { id: "rect", label: "Rectangle" },
  { id: "lasso", label: "Lasso" },
];

export const LABEL_SORTS = [
  { id: "alpha", label: "Labels (A–Z)", hint: TEXT.hints.labelSort.alpha },
  { id: "degree", label: "Degree", hint: TEXT.hints.labelSort.degree },
  { id: "onion", label: "Onion", hint: TEXT.hints.labelSort.onion },
  { id: "eigenvector", label: "Eigenvector", hint: TEXT.hints.labelSort.eigenvector },
] as const;

// NodeLink's layouts. 2D and 3D are the force-directed ones, computed from the
// edges alone with spectral seeds; Bespoke 2D and Bespoke 3D are the dataset's
// own, from its source or drawn by another method.
export const LAYOUTS = [
  { id: "fd", label: "2D", hint: TEXT.hints.layout.fd },
  { id: "fd3d", label: "3D", hint: TEXT.hints.layout.fd3d },
  { id: "own2d", label: "Bespoke 2D", hint: TEXT.hints.layout.own2d },
  { id: "own3d", label: "Bespoke 3D", hint: TEXT.hints.layout.own3d },
] as const;

// The node orders the matrix offers (src/pipeline/seriations.ts). Six from
// two eigendecompositions: the harmonics first, the Laplacian's waves,
// smoothest first (linked nodes sit close), then the principal components of
// the adjacency rows, strongest first (nodes that stand alike sit close).
export const SERIATIONS = [
  { id: "harm1", label: "H1", hint: TEXT.hints.seriation.harm1 },
  { id: "harm2", label: "H2", hint: TEXT.hints.seriation.harm2 },
  { id: "harm3", label: "H3", hint: TEXT.hints.seriation.harm3 },
  { id: "pc1", label: "PC1", hint: TEXT.hints.seriation.pc1 },
  { id: "pc2", label: "PC2", hint: TEXT.hints.seriation.pc2 },
  { id: "pc3", label: "PC3", hint: TEXT.hints.seriation.pc3 },
] as const;

// How the node x node matrix is drawn (panes/matrix/geometry.ts).
export const FORMS = [
  { id: "square", label: "Square" },
  { id: "diamond", label: "Diamond" },
] as const;

// How each shell's bins are ordered across its row (src/pipeline/ksnakes.ts).
// Two edges cross when they join the same two shells and their bins' orders
// swap. The strip offers Top-down and Packed, the baseline, which it names
// Size: it sorts by the bins' onions and sizes alone.
export const ORDERINGS = [
  { id: "topdown", label: "Top-down", hint: TEXT.hints.ordering.topdown },
  { id: "packed", label: "Size", hint: TEXT.hints.ordering.packed },
] as const;

// Hops' wave orders: one measure of each node's census, each a percent
// (panes/hopcensus/geometry.ts). Each label names the wave's measure and
// reads after the section's caps, as "Horizontal wave order by reach".
// They run: Degree, the line's first value; then three read
// along the line, as a wave's shape is: Reach, its centre of mass, when it
// arrives on average (the default); Spread, over how much of its length it arrives, the
// pane's own, drawn by no other pane; and Skew, which side of its middle that
// width lies on.
export const CENSUS_MEASURES = [
  { id: "degree", label: "Degree", hint: TEXT.hints.censusMeasure.degree },
  { id: "reach", label: "Reach", hint: TEXT.hints.censusMeasure.reach },
  { id: "spread", label: "Spread", hint: TEXT.hints.censusMeasure.spread },
  { id: "skew", label: "Skew", hint: TEXT.hints.censusMeasure.skew },
] as const;

// UPLOAD YOUR DATA's two ways in: a dataset built from CSV files, or a build
// file saved by Export, opened as it is.
export const UPLOADS = [
  { id: "csv", label: "Build from CSV", hint: TEXT.hints.upload.csv },
  { id: "json", label: "Upload from JSON", hint: TEXT.hints.upload.json },
] as const satisfies readonly { id: Upload; label: string; hint: string }[];

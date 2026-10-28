// The options each Choice offers: its id and its visible label. Kept free of
// the stores and the DOM.
import type { SelectTarget } from "./state/selection";
import type { Tool, Upload } from "./state/uiStore";

// Where a lasso or rect writes. In a node pane: the nodes inside it, the
// edges those nodes share (both endpoints inside), or both. In the matrix:
// the nodes whose columns it crosses, the edges inside it, or those edges
// with their endpoints. One setting for the whole app.
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
  { id: "alpha", label: "Labels (A–Z)" },
  { id: "degree", label: "Degree" },
  { id: "onion", label: "Onion" },
] as const;

// NodeLink's layouts. 2D and 3D are the force-directed ones, computed from the
// edges alone with spectral seeds; Bespoke 2D and Bespoke 3D are the dataset's
// own, from its source or drawn by another method.
export const LAYOUTS = [
  { id: "fd", label: "2D" },
  { id: "fd3d", label: "3D" },
  { id: "own2d", label: "Bespoke 2D" },
  { id: "own3d", label: "Bespoke 3D" },
] as const;

// The node orders the matrix offers (src/pipeline/seriations.ts). Six from
// two eigendecompositions: the harmonics first, the Laplacian's waves,
// smoothest first (linked nodes sit close), then the principal components of
// the adjacency rows, strongest first (nodes that stand alike sit close).
export const SERIATIONS = [
  { id: "harm1", label: "H1" },
  { id: "harm2", label: "H2" },
  { id: "harm3", label: "H3" },
  { id: "pc1", label: "PC1" },
  { id: "pc2", label: "PC2" },
  { id: "pc3", label: "PC3" },
] as const;

// How the node x node matrix is drawn (panes/matrix/geometry.ts).
export const FORMS = [
  { id: "square", label: "Square" },
  { id: "diamond", label: "Diamond" },
] as const;

// How each shell's bins are ordered across its row (src/pipeline/ksnakes.ts).
// Two edges cross when they join the same two shells and their bins' orders
// swap. The strip offers Packed first, the baseline, which it names Size: it
// sorts by the bins' onions and sizes alone; then Barycenter (topdown).
export const ORDERINGS = [
  { id: "packed", label: "Size" },
  { id: "topdown", label: "Barycenter" },
] as const;

// Hops' shape orders: one measure of each node's census, each a percent
// (panes/hopcensus/geometry.ts). Each label names the shape's measure and
// reads after the section's caps, as "Horizontal order by shape: reach".
// They run: Degree, the line's first value; then three read
// along the line, as its shape is: Reach, its centre of mass, when it
// arrives on average (the default); Spread, over how much of its length it arrives, the
// pane's own, drawn by no other pane; and Skew, which side of its middle that
// width lies on.
export const CENSUS_MEASURES = [
  { id: "degree", label: "Degree" },
  { id: "reach", label: "Reach" },
  { id: "spread", label: "Spread" },
  { id: "skew", label: "Skew" },
] as const;

// UPLOAD YOUR DATA's two ways in: a dataset built from CSV files, or a build
// file saved by Export, opened as it is.
export const UPLOADS = [
  { id: "csv", label: "Build from CSV" },
  { id: "json", label: "Upload from JSON" },
] as const satisfies readonly { id: Upload; label: string }[];

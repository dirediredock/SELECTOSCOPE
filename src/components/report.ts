import type { CleanReport, FileKind, Refusal, Warning } from "../pipeline/ingest";

// Each file by the role the user gave it, never by its name in a dataset
// folder (layout_2d.csv), which the user never saw.
export const ROLE_NAMES: Record<FileKind, string> = {
  edgelist: "Edgelist",
  labels: "Labels",
  layout2d: "Bespoke 2D",
  layout3d: "Bespoke 3D",
};

const FILE_ORDER = Object.keys(ROLE_NAMES) as FileKind[];

export interface ReportGroup {
  kind: FileKind;
  refused: boolean;
  lines: string[];
}

const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? "" : "s"}`;

// A phrase as a line or a reason of its own.
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// What loading a dataset refused and changed, one group per file: the
// refused files first, then the rest in file order. What the cleaning
// changed is the edge list's; a graph loaded from a build file has no record
// of it, and no edge list pill to show it on.
export function describeReport(g: { report: CleanReport | null; refused: Refusal[]; warnings: Warning[] }): ReportGroup[] {
  const r = g.report;
  const notes = new Map<FileKind, string[]>();
  const note = (kind: FileKind, line: string) => notes.set(kind, [...(notes.get(kind) ?? []), line]);
  if (r?.selfLoops) note("edgelist", `${plural(r.selfLoops, "self-loop")} dropped`);
  if (r?.repeated) note("edgelist", `${plural(r.repeated, "repeated edge")} merged`);
  if (r && r.components > 1) {
    note(
      "edgelist",
      `kept the largest of ${r.components} components (${plural(r.droppedNodes, "node")}, ${plural(r.droppedEdges, "edge")} dropped)`,
    );
  }
  for (const w of g.warnings) note(w.kind, w.reason);
  const refused = FILE_ORDER.flatMap((kind) => {
    const lines = g.refused.filter((f) => f.kind === kind).map((f) => f.reason);
    return lines.length ? [{ kind, refused: true, lines }] : [];
  });
  const rest = FILE_ORDER.flatMap((kind) => (notes.has(kind) ? [{ kind, refused: false, lines: notes.get(kind)! }] : []));
  return [...refused, ...rest];
}

// One file's part of the report: why it was refused (`refusal`, the edge
// list's own, else the graph's), then its notes and warnings. `graph` is the
// one built from the files as they stand, or null.
export function fileLines(
  kind: FileKind,
  graph: { report: CleanReport | null; refused: Refusal[]; warnings: Warning[] } | null,
  refusal: string | null = null,
): { refused: string[]; notes: string[] } {
  const groups = graph ? describeReport(graph).filter((g) => g.kind === kind) : [];
  const refused = groups.filter((g) => g.refused).flatMap((g) => g.lines);
  const notes = groups.filter((g) => !g.refused).flatMap((g) => g.lines);
  return { refused: refusal ? [refusal, ...refused] : refused, notes };
}

// A file pill's tip, block by block: the file's role (shown in caps) and its
// own name, the edge list's with n / m; then its refusal and its notes. Null
// when there is nothing to report, so the pill has no tip.
export type TipBlock =
  | { kind: "head"; role: string; file: string | null; counts: string | null }
  | { kind: "lines"; lines: { text: string; refused: boolean }[] };

export function reportTip(
  head: { role: string; file: string | null; counts?: string | null },
  lines: { refused: string[]; notes: string[] },
): TipBlock[] | null {
  if (!lines.refused.length && !lines.notes.length) return null;
  return [
    { kind: "head", role: head.role, file: head.file, counts: head.counts ?? null },
    {
      kind: "lines",
      lines: [
        ...lines.refused.map((r) => ({ text: `Refused: ${r}.`, refused: true })),
        ...lines.notes.map((n) => ({ text: `${sentence(n)}.`, refused: false })),
      ],
    },
  ];
}

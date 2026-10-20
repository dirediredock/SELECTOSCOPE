import type { ReactNode } from "react";
import { useStore } from "../../state/createStore";
import { ui } from "../../state/uiStore";
import type { CensusMeasure } from "../../state/hopcensus";
import { arrival, censusOrder, censusStructure } from "../hopcensus/geometry";

// Help's diagrams: small schematics drawn as the panes draw (the neutral mark
// inks, the node set in blue, the edge set in orange, gridlines and enclosure
// hairlines), so a reader matches each to the pane it explains. Static,
// with no hover or motion, and outside the drawn pattern, so Contrast never
// fades them. Each scales with the sheet's width, up to its natural size.

const INK = {
  node: "var(--mark-node)",
  edge: "var(--mark-edge)",
  nodeSel: "var(--node-sel)",
  edgeSel: "var(--edge-sel)",
  hair: "var(--edge)",
  grid: "var(--grid)",
  text: "var(--text)",
  panel: "var(--panel)",
  fill: "var(--panel-2)",
};

// A figure: a viewBox drawn at most `width` design px wide, centred, with a
// figure's air above and below. Figures off hides it.
function Figure({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const figures = useStore(ui, (s) => s.figures);
  if (!figures) return null;
  return (
    <div className="help-figure">
      <svg viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: `${w / 12}rem` }} aria-hidden="true">
        {children}
      </svg>
    </div>
  );
}

function Caption({ x, y, children, anchor = "middle" }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="help-fig-text">
      {children}
    </text>
  );
}

const Dot = ({ x, y, sel = false, r = 3 }: { x: number; y: number; sel?: boolean; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill={sel ? INK.nodeSel : INK.node} />
);

const Line = ({ a, b, sel = false }: { a: readonly number[]; b: readonly number[]; sel?: boolean }) => (
  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={sel ? INK.edgeSel : INK.edge} strokeWidth={sel ? 2.5 : 1.2} strokeLinecap="round" />
);

const poly = (pts: readonly (readonly number[])[]) => pts.map((p) => p.join(",")).join(" ");

// Quick start's three parts: the top strip, the pane row and the bottom
// strip. The panes are bare frames: the figure is about where things are.
// Their name sits on a plate of pane fill, centred on the row, so it reads
// across the frames' edges.
export function InterfaceMap() {
  const W = 260;
  const widths = [30, 30, 70, 37, 36, 34];
  const xs = widths.map((_, i) => 4 + widths.slice(0, i).reduce((a, b) => a + b + 3, 0));
  const top = 26;
  const h = 70;
  const mid = top + h / 2;
  const bottom = top + h + 6;
  return (
    <Figure w={W} h={bottom + 20}>
      <rect x={4} y={2} width={W - 8} height={18} rx={9} fill={INK.fill} stroke={INK.hair} />
      <Caption x={W / 2} y={14}>TOP CONTROL STRIP</Caption>
      {widths.map((w, i) => (
        <rect key={i} x={xs[i]} y={top} width={w} height={h} rx={3} fill={INK.panel} stroke={INK.hair} />
      ))}
      <rect x={W / 2 - 22} y={mid - 7} width={44} height={14} rx={7} fill={INK.panel} />
      <Caption x={W / 2} y={mid + 3}>PANES</Caption>
      <rect x={4} y={bottom} width={W - 8} height={18} rx={9} fill={INK.fill} stroke={INK.hair} />
      <Caption x={W / 2} y={bottom + 12}>BOTTOM CONTROL STRIP</Caption>
    </Figure>
  );
}

// Extend set: a node set, then one hop and two hops grown from it.
export function ExtendHops() {
  const centre = [0, 0];
  const ring1 = [[0, -18], [16, 9], [-16, 9]];
  const ring2 = [[0, -34], [24, -22], [30, 17], [-30, 17], [-24, -22]];
  const edges: [number[], number[]][] = [
    [centre, ring1[0]!],
    [centre, ring1[1]!],
    [centre, ring1[2]!],
    [ring1[0]!, ring2[0]!],
    [ring1[0]!, ring2[1]!],
    [ring1[1]!, ring2[2]!],
    [ring1[2]!, ring2[3]!],
    [ring1[0]!, ring2[4]!],
  ];
  const panel = (dx: number, hops: number, label: string) => {
    const inSet = (p: number[]) => p === centre || (hops >= 1 && ring1.includes(p)) || (hops >= 2 && ring2.includes(p));
    const at = (p: number[]) => [p[0]! + dx, p[1]! + 46];
    return (
      <g key={label}>
        {edges.map(([a, b], i) => (
          <Line key={i} a={at(a)} b={at(b)} sel={inSet(a) && inSet(b)} />
        ))}
        {[centre, ...ring1, ...ring2].map((p, i) => {
          const [x, y] = at(p);
          return <Dot key={i} x={x!} y={y!} sel={inSet(p)} />;
        })}
        <Caption x={dx} y={90}>{label}</Caption>
      </g>
    );
  };
  return (
    <Figure w={250} h={96}>
      {panel(42, 0, "0 hops")}
      {panel(125, 1, "+1 hop")}
      {panel(208, 2, "+2 hops")}
    </Figure>
  );
}

// An arrowhead for the figures' motion arrows, defined once per figure.
function ArrowHead({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
        <path d="M0 0 L6 3 L0 6 z" fill={INK.node} />
      </marker>
    </defs>
  );
}

const Arrow = ({ id, d }: { id: string; d: string }) => (
  <path d={d} fill="none" stroke={INK.node} strokeWidth={1.1} markerEnd={`url(#${id})`} />
);

// A small graph, for the gesture cards' effects: a triangle with a tail.
const MINI = {
  nodes: [[-8, -2], [2, -8], [3, 4], [12, 0], [-3, 9]],
  edges: [[0, 1], [1, 2], [0, 2], [2, 3], [1, 3], [0, 4]],
};

function MiniGraph({ x, y, scale = 1, ghost = false }: { x: number; y: number; scale?: number; ghost?: boolean }) {
  const at = (i: number) => [x + MINI.nodes[i]![0]! * scale, y + MINI.nodes[i]![1]! * scale];
  return (
    <g opacity={ghost ? 0.25 : 1}>
      {MINI.edges.map(([a, b], i) => (
        <Line key={i} a={at(a!)} b={at(b!)} />
      ))}
      {MINI.nodes.map((_, i) => {
        const [cx, cy] = at(i);
        return <Dot key={i} x={cx!} y={cy!} r={2.2} />;
      })}
    </g>
  );
}

// Navigation's gestures, each on a portrait golden card: the trackpad above,
// with its fingers and their motion, and below the pane it moves, the
// picture's earlier place a faint ghost.
export function Gestures() {
  const W = 60;
  const H = Math.round(W * 1.618);
  const gap = 14;
  const id = "help-gesture-arrow";
  const finger = (x: number, y: number) => <circle cx={x} cy={y} r={4} fill={INK.panel} stroke={INK.node} strokeWidth={1.1} />;
  const card = (i: number, lines: [string, string], pad: ReactNode, effect: ReactNode) => {
    const x = 4 + i * (W + gap);
    return (
      <g key={i} transform={`translate(${x} 4)`}>
        <rect x={0} y={0} width={W} height={H} rx={5} fill={INK.panel} stroke={INK.hair} />
        <rect x={5} y={5} width={W - 10} height={H / 2 - 8} rx={4} fill={INK.fill} />
        <rect x={5} y={H / 2 + 3} width={W - 10} height={H / 2 - 8} rx={2} fill={INK.panel} stroke={INK.grid} />
        {pad}
        {effect}
        <Caption x={W / 2} y={H + 14}>{lines[0]}</Caption>
        <Caption x={W / 2} y={H + 25}>{lines[1]}</Caption>
      </g>
    );
  };
  const top = H / 4 + 1;
  const low = (3 * H) / 4 - 1;
  return (
    <Figure w={4 * W + 3 * gap + 8} h={H + 34}>
      <ArrowHead id={id} />
      {card(
        0,
        ["Pinch", "to zoom"],
        <>
          {finger(22, top - 4)}
          {finger(38, top + 6)}
          <Arrow id={id} d={`M18 ${top - 8} L11 ${top - 13}`} />
          <Arrow id={id} d={`M42 ${top + 10} L49 ${top + 15}`} />
        </>,
        <>
          <MiniGraph x={W / 2} y={low} scale={0.55} ghost />
          <MiniGraph x={W / 2} y={low} scale={1.3} />
        </>,
      )}
      {card(
        1,
        ["Scroll", "to pan"],
        <>
          {finger(25, top + 4)}
          {finger(35, top + 4)}
          <Arrow id={id} d={`M30 ${top - 3} L30 ${top - 13}`} />
        </>,
        <>
          <MiniGraph x={W / 2} y={low + 6} ghost />
          <MiniGraph x={W / 2} y={low - 6} />
        </>,
      )}
      {card(
        2,
        ["Scroll in 3D", "to rotate"],
        <>
          {finger(20, top)}
          {finger(30, top)}
          <Arrow id={id} d={`M37 ${top} L49 ${top}`} />
        </>,
        <>
          <circle cx={W / 2} cy={low} r={15} fill="none" stroke={INK.edge} />
          <ellipse cx={W / 2} cy={low} rx={15} ry={5} fill="none" stroke={INK.edge} />
          <ellipse cx={W / 2} cy={low} rx={9} ry={15} fill="none" stroke={INK.edge} opacity={0.4} />
          <ellipse cx={W / 2} cy={low} rx={4} ry={15} fill="none" stroke={INK.node} />
          <Arrow id={id} d={`M${W / 2 - 12} ${low + 19} Q${W / 2} ${low + 24} ${W / 2 + 12} ${low + 19}`} />
        </>,
      )}
      {card(
        3,
        ["Space + drag", "to pan"],
        <>
          <rect x={12} y={top + 4} width={W - 24} height={10} rx={3} fill={INK.panel} stroke={INK.hair} />
          <text x={W / 2} y={top + 11.5} textAnchor="middle" className="help-fig-count">
            Space
          </text>
          {finger(18, top - 8)}
          <Arrow id={id} d={`M25 ${top - 8} L45 ${top - 8}`} />
        </>,
        <>
          <MiniGraph x={W / 2 - 8} y={low} ghost />
          <MiniGraph x={W / 2 + 8} y={low} />
        </>,
      )}
    </Figure>
  );
}

// The matrix drawn both ways: two communities and one bridge, every edge
// twice, with a cell of air between the points and the outline.
export function MatrixForms() {
  const n = 10;
  const cell = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const same = (i < 5) === (j < 5);
      const bridge = (i === 4 && j === 5) || (i === 5 && j === 4);
      if ((same && (i + j) % 3 !== 0) || bridge) pts.push([i, j]);
    }
  const side = (n + 2) * cell;
  const matrix = (
    <>
      <rect x={0} y={0} width={side} height={side} fill="none" stroke={INK.hair} />
      <line x1={0} y1={0} x2={side} y2={side} stroke={INK.grid} strokeDasharray="2 2" />
      {pts.map(([i, j]) => (
        <circle key={`${i}-${j}`} cx={(j + 1.5) * cell} cy={(i + 1.5) * cell} r={1.8} fill={INK.node} />
      ))}
    </>
  );
  const diag = side * Math.SQRT2;
  const H = Math.ceil(diag) + 4;
  return (
    <Figure w={260} h={H + 18}>
      <g transform={`translate(24 ${(H - side) / 2 + 2})`}>{matrix}</g>
      <Caption x={24 + side / 2} y={H + 14}>SQUARE</Caption>
      <g transform={`translate(${190} 2) rotate(45)`}>{matrix}</g>
      <Caption x={190} y={H + 14}>DIAMOND</Caption>
    </Figure>
  );
}

// Shells: shells as K spans, onion layers as heights, components in tubes.
export function ShellsAnatomy() {
  const W = 260;
  const step = 11;
  // Onion layer 1 at the bottom; each boundary between spans adds two steps.
  const spans = [
    { k: 3, layers: [6, 5] },
    { k: 2, layers: [4, 3] },
    { k: 1, layers: [2, 1] },
  ];
  const yOf = (onion: number) => {
    const boundaries = onion > 4 ? 2 : onion > 2 ? 1 : 0;
    return 150 - (onion + boundaries * 2) * step;
  };
  const tube = (pts: number[][], key: string) => (
    <g key={key}>
      <polyline points={poly(pts)} fill="none" stroke={INK.hair} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={poly(pts)} fill="none" stroke={INK.panel} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
  const k3 = [[70, yOf(6)], [86, yOf(6)], [102, yOf(5)], [118, yOf(5)], [134, yOf(5)]];
  const k2a = [[58, yOf(4)], [74, yOf(4)], [90, yOf(3)]];
  const k2b = [[150, yOf(4)], [166, yOf(3)], [182, yOf(3)]];
  const single = [126, yOf(3)];
  const k1 = [[70, yOf(2)], [86, yOf(1)]];
  const pill = [170, yOf(1)];
  const lines = [yOf(6) - step * 1.5, yOf(5) + step * 1.5, yOf(3) + step * 1.5, yOf(1) + step * 1.5];
  return (
    <Figure w={W} h={160}>
      {lines.map((y, i) => (
        <line key={i} x1={24} y1={y} x2={W - 30} y2={y} stroke={INK.grid} />
      ))}
      {[6, 5, 4, 3, 2, 1].map((o) => (
        <Caption key={o} x={14} y={yOf(o) + 3.5}>
          {o}
        </Caption>
      ))}
      {spans.map((s) => (
        <Caption key={s.k} x={W - 16} y={(yOf(s.layers[0]!) + yOf(s.layers[1]!)) / 2 + 3.5}>
          {`K${s.k}`}
        </Caption>
      ))}
      {tube(k3, "k3")}
      {tube(k2a, "k2a")}
      {tube(k2b, "k2b")}
      {tube(k1, "k1")}
      <rect x={pill[0]! - 9} y={pill[1]! - 6.5} width={18} height={13} rx={6.5} fill={INK.panel} stroke={INK.hair} />
      <text x={pill[0]} y={pill[1]! + 3} textAnchor="middle" className="help-fig-count">
        3
      </text>
      <Line a={k3[4]!} b={k2b[0]!} sel />
      {[...k3, ...k2a, ...k2b, single, ...k1].map(([x, y], i) => (
        <Dot key={i} x={x!} y={y!} />
      ))}
    </Figure>
  );
}

// Hops: square bins stacked with no gap, the most central on top, each line
// running its eccentricity in hops on one x scale, heights on one y scale,
// and the E labels in a gutter at the right.
//
// The censuses are hand-drawn but keep a stub census's rules, so they read as
// real lines: the first entry is the node's degree; the last is the edges
// inside the farthest layer, counted twice, so it is even and small; a line
// rises as the search spreads and falls at the periphery; and lines of one
// graph meet about the same total. The central bin's lines arrive at once,
// the far bin's over more hops with a lower peak.
const HOPS_BINS: { ecc: number; lines: number[][] }[] = [
  { ecc: 2, lines: [[4, 32, 4], [9, 27, 4], [16, 22, 2]] },
  { ecc: 3, lines: [[3, 12, 21, 4], [4, 15, 19, 2], [5, 18, 15, 2]] },
  { ecc: 4, lines: [[2, 6, 14, 16, 2], [2, 8, 16, 12, 2], [3, 10, 17, 8, 2]] },
];
const HOPS_TOP = Math.max(...HOPS_BINS.flatMap((b) => b.lines.flat())); // the top of every bin
const HOPS_MAX_ECC = 4;

// A census as a polyline: x from hop 0 at `x0`, `side / maxEcc` a hop; y
// from a bin's bottom to its top at HOPS_TOP, with a little headroom.
const censusPoints = (census: number[], x0: number, top: number, side: number, max = HOPS_TOP) =>
  census.map((c, i) => [x0 + (i * side) / HOPS_MAX_ECC, top + side - (c / max) * (side - 6)]);

// A census line in the figures: few lines, so a firmer ink than the pane's
// half, with round joins and ends.
const CensusLine = ({ pts, solid = false }: { pts: number[][]; solid?: boolean }) => (
  <polyline points={poly(pts)} fill="none" stroke={INK.node} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={solid ? 0.85 : 0.5} />
);

// Where the pane opens: each line slid by its reach, Ranking off, at Spacing
// 1×, read from the pane's own code over every line in the figure. Lines of
// one reach share a place, as the pane draws twins.
const HOPS_PLACE = (() => {
  const lines = HOPS_BINS.flatMap((b) => b.lines);
  const ecc = HOPS_BINS.flatMap((b) => b.lines.map(() => b.ecc));
  const offset = [0];
  for (const l of lines) offset.push(offset[offset.length - 1]! + l.length);
  const st = censusStructure({ ecc: Uint32Array.from(ecc), offset: Uint32Array.from(offset), stubs: Uint32Array.from(lines.flat()) });
  return censusOrder(st, "reach", false).place;
})();

export function HopsAnatomy() {
  const side = 84;
  const x0 = 8;
  const gutter = 30;
  let n = 0;
  return (
    <Figure w={x0 + 2 * side + gutter} h={3 * side + 8}>
      {HOPS_BINS.map((b, i) => {
        const top = 4 + i * side;
        return (
          <g key={b.ecc}>
            <line x1={x0} y1={top + side} x2={x0 + 2 * side} y2={top + side} stroke={INK.grid} />
            {b.lines.map((l, j) => (
              <CensusLine key={j} solid pts={censusPoints(l, x0 + HOPS_PLACE[n++]! * side, top, side)} />
            ))}
            <Caption x={x0 + 2 * side + gutter / 2} y={top + side / 2 + 3.5}>{`E${b.ecc}`}</Caption>
          </g>
        );
      })}
    </Figure>
  );
}

// Each shape order's two ends, read from real data: in Game of Thrones' E5
// bin, the mean shape (shares of each line's total, in %) of the tenth of its
// lines the order puts furthest left, and of those it puts furthest right.
// So each figure shows what the order really does there, alikeness included.
// The figure then exaggerates each end (exaggerate), so the contrast reads at
// a glance.
const SHAPE_ENDS: Record<Exclude<CensusMeasure, "degree">, [number[], number[]]> = {
  reach: [[1.5, 21.8, 56.4, 17.2, 3.1, 0], [0.6, 3.8, 8.3, 47.2, 39.0, 1.0]],
  spread: [[1.2, 10.6, 28.5, 39.1, 19.8, 0.9], [0.6, 9.1, 60.6, 26.4, 3.2, 0]],
  skew: [[0.4, 7.5, 60.0, 27.7, 4.4, 0], [1.4, 13.8, 36.1, 44.5, 4.3, 0]],
};

// The bin's mean shape, which each end is pushed away from.
const SHAPE_MEAN = [0.9, 11.0, 44.1, 34.3, 9.4, 0.3];
// How far each order's ends are pushed, each as far as reads at the figure's
// size: Reach's mean hop needs a clear gap from hop 0; Spread and Skew lie
// in the polyline's shape, which needs most.
const AMPLIFY: Record<Exclude<CensusMeasure, "degree">, number> = { reach: 2.2, spread: 3, skew: 3 };

// An end pushed `k` times as far from the bin's mean shape, every hop but the
// last kept at 1% or more (a search always meets something on its way out),
// and scaled back to 100.
function exaggerate(c: number[], k: number): number[] {
  const last = c.length - 1;
  const pushed = c.map((x, i) => Math.max(i < last ? 1 : 0, SHAPE_MEAN[i]! + k * (x - SHAPE_MEAN[i]!)));
  const total = pushed.reduce((a, x) => a + x, 0);
  return pushed.map((x) => (100 * x) / total);
}

const meanHop = (c: number[]) => c.reduce((a, x, i) => a + x * i, 0) / c.reduce((a, x) => a + x, 0);
const spreadHops = (c: number[]) => {
  const m = meanHop(c);
  return Math.sqrt(c.reduce((a, x, i) => a + x * (i - m) ** 2, 0) / c.reduce((a, x) => a + x, 0));
};

// Degree's two lines, hand-drawn in raw counts, as the pane draws them: a
// hub's line, starting high, and one starting at a single edge. They keep a
// census's rules (each meets a total of 40, the last entry even), and need no
// exaggeration: the contrast is the start, which a dot marks.
const DEGREE_LINES: [number[], number[]] = [
  [12, 20, 6, 2, 0],
  [1, 5, 14, 16, 4],
];

// One shape order: its left end, and its right end slid two bins' widths
// along, as Spacing spreads them. Beneath each, faint, what the measure reads
// off the shape: Degree a dot at the line's first value, Reach a dashed
// line at the mean hop and a bracket from hop 0 to it, Spread a bracket of 1.5 standard deviations either side of it,
// Skew a dashed line at the mean hop with the lead from the first tenth to it
// and the tail from it to the last tenth.
const SHAPE_SLIDE = 2;

export function ShapeOrder({ measure }: { measure: CensusMeasure }) {
  const side = 60;
  const x0 = 8;
  const base = 4 + side;
  const ends = measure === "degree" ? DEGREE_LINES : SHAPE_ENDS[measure].map((c) => exaggerate(c, AMPLIFY[measure]));
  const ecc = ends[0].length - 1;
  const top = Math.max(...ends.flat());
  const hop = side / ecc;
  const right = x0 + (1 + SHAPE_SLIDE) * side;
  const mark = (c: number[], dx: number, i: number) => {
    const at = (h: number) => dx + h * hop;
    if (measure === "reach") {
      const m = at(meanHop(c));
      return (
        <g key={i}>
          <line x1={m} y1={4} x2={m} y2={base} stroke={INK.text} strokeWidth={1} strokeDasharray="3 2" />
          <path d={`M${at(0)} ${base + 3} v4 H${m} v-4`} fill="none" stroke={INK.text} strokeWidth={1.2} />
        </g>
      );
    }
    if (measure === "skew") {
      const m = at(meanHop(c));
      const bracket = (x1: number, x2: number) => `M${x1} ${base + 3} v4 H${x2} v-4`;
      return (
        <g key={i}>
          <line x1={m} y1={4} x2={m} y2={base} stroke={INK.text} strokeWidth={1} strokeDasharray="3 2" />
          <path d={bracket(at(arrival(c, 0.1)), m) + bracket(m, at(arrival(c, 0.9)))} fill="none" stroke={INK.text} strokeWidth={1.2} />
        </g>
      );
    }
    if (measure === "spread") {
      const m = meanHop(c);
      // 1.5 standard deviations either side, the same for both lines, so the
      // brackets compare as the spreads do and still read at the figure's size.
      const sd = 1.5 * spreadHops(c);
      return <path key={i} d={`M${at(m - sd)} ${base + 3} v4 H${at(m + sd)} v-4`} fill="none" stroke={INK.text} strokeWidth={1.2} />;
    }
    return null;
  };
  return (
    <Figure w={right + x0} h={side + 30}>
      {ends.map((c, i) => mark(c, x0 + i * SHAPE_SLIDE * side, i))}
      <line x1={x0} y1={base} x2={right} y2={base} stroke={INK.grid} />
      {ends.map((c, i) => (
        <CensusLine key={i} solid pts={c.map((v, h) => [x0 + i * SHAPE_SLIDE * side + h * hop, base - (v / top) * (side - 6)])} />
      ))}
      {measure === "degree" &&
        ends.map((c, i) => <Dot key={i} x={x0 + i * SHAPE_SLIDE * side} y={base - (c[0]! / top) * (side - 6)} r={3.2} />)}
      <Caption x={x0} y={side + 26} anchor="start">← left</Caption>
      <Caption x={right} y={side + 26} anchor="end">right →</Caption>
    </Figure>
  );
}

// Auto Sweep's band, evoked: a portrait golden pane body with the band a
// fifth of the way through, one thickness in both panes, its tint fading out at
// both edges along its travel so it reads as light passing, and at the
// pane's centre a chevron knocked out of a slate disc (the focused pane's
// colour) pointing the way it travels: top to bottom and, with Vertical off,
// left to right.
export function SweepBand() {
  const W = 70;
  const H = Math.round(W * 1.618);
  const reach = 0.2;
  const band = 18;
  const glow = (gid: string, vertical: boolean) => (
    <linearGradient id={gid} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
      <stop offset="0" style={{ stopColor: INK.edgeSel, stopOpacity: 0 }} />
      <stop offset="0.5" style={{ stopColor: INK.edgeSel, stopOpacity: 0.45 }} />
      <stop offset="1" style={{ stopColor: INK.edgeSel, stopOpacity: 0 }} />
    </linearGradient>
  );
  const pane = (dx: number, vertical: boolean, label: string) => {
    const gid = `help-band-${vertical ? "down" : "across"}`;
    return (
      <g key={label} transform={`translate(${dx} 4)`}>
        <defs>
          <clipPath id={`${gid}-clip`}>
            <rect x={0} y={0} width={W} height={H} rx={4} />
          </clipPath>
        </defs>
        <rect x={0} y={0} width={W} height={H} rx={4} fill={INK.panel} />
        <g clipPath={`url(#${gid}-clip)`}>
          {vertical ? (
            <rect x={0} y={reach * H} width={W} height={band} fill={`url(#${gid})`} />
          ) : (
            <rect x={reach * W} y={0} width={band} height={H} fill={`url(#${gid})`} />
          )}
        </g>
        <rect x={0} y={0} width={W} height={H} rx={4} fill="none" stroke={INK.hair} />
        <g transform={`translate(${W / 2} ${H / 2}) rotate(${vertical ? 0 : -90})`}>
          <circle r={8} fill="var(--pane-focused)" />
          <path d="M-3.5 -1.6 L0 2 L3.5 -1.6" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <Caption x={W / 2} y={H + 16}>{label}</Caption>
      </g>
    );
  };
  return (
    <Figure w={2 * W + 50} h={H + 24}>
      <defs>
        {glow("help-band-down", true)}
        {glow("help-band-across", false)}
      </defs>
      {pane(10, true, "VERTICAL on")}
      {pane(W + 40, false, "VERTICAL off")}
    </Figure>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useStore } from "../../state/createStore";
import { LIST_ROWS } from "../../components/VirtualList";
import {
  ArrowStepper,
  FilePill,
  HelpToggle,
  HoldStepper,
  PlayGlyph,
  RUN_CELLS,
  Slider,
  Stepper,
  Switch,
  Transport,
} from "../../components/controls";

// Add's look, for the Uploaded copy.
const ADD_COPY = [
  {
    id: "idle",
    content: (
      <>
        <PlayGlyph /> Add
      </>
    ),
  },
] as const;
import { Choice } from "../../components/Choice";
import { SetCountView } from "../../components/TopBar";
import { CONTRAST, ui } from "../../state/uiStore";
import {
  CENSUS_MEASURES,
  FORMS,
  LABEL_SORTS,
  LAYOUTS,
  ORDERINGS,
  SELECT_MODES,
  SERIATIONS,
  TOOLS,
  UPLOADS,
} from "../../controlOptions";
import { BIN_SPACING } from "../../state/ksnakes";
import { SWEEP_AREA, SWEEP_SPEED } from "../../state/sweep";
import {
  railOfSlide,
  SLIDE,
  SLIDE_RAIL,
  slideText,
} from "../../state/hopcensus";
import { TEXT } from "../../controlText";
import { glideScroll } from "../../components/glideScroll";
import { attachListPan } from "../../interaction/listPan";
import { HELP_SECTIONS, helpNav, sectionAt, topTarget } from "./helpNav";
import {
  ExtendHops,
  Gestures,
  HopsAnatomy,
  InterfaceMap,
  MatrixForms,
  ShellsAnatomy,
  SweepBand,
  ShapeOrder,
} from "./helpFigures";

// Where the sheet was left, for the session, so closing and reopening it
// returns to the same place.
let savedScroll = 0;

// How long the scrollbar stays after the last scroll, as in VirtualList.
const SCROLLBAR_IDLE_MS = 1000;

// The Data slot's other face: docs/help_pane.txt, word for word, with an inert
// copy of each control it names and diagrams of what the panes draw. It
// scrolls as the Data list does (a drag or Space + drag, the same slim
// scrollbar), with no hover, no selection and no Contrast fade, since it is
// outside the drawn pattern. Its strip's Sections follows the section in view,
// and a pick there glides its heading to the top.
export function HelpPane() {
  const ref = useRef<HTMLDivElement>(null);
  const goto = useStore(helpNav, (s) => s.goto);
  const figures = useStore(ui, (s) => s.figures);
  const [scrolling, setScrolling] = useState(false);
  const idleTimer = useRef(0);

  const spy = () => {
    const el = ref.current!;
    const tops = Array.from(
      el.querySelectorAll<HTMLElement>("[data-sec]"),
      (s) => sectionTop(s),
    );
    const section =
      HELP_SECTIONS[
        sectionAt(tops, el.scrollTop, el.clientHeight, el.scrollHeight)
      ]!.id;
    if (helpNav.get().section !== section) helpNav.set({ section });
  };

  useLayoutEffect(() => {
    const el = ref.current!;
    el.scrollTop = savedScroll;
    spy();
    const ro = new ResizeObserver(spy);
    ro.observe(el);
    const detach = attachListPan(el, { plainDrag: true });
    return () => {
      ro.disconnect();
      detach();
      clearTimeout(idleTimer.current);
    };
  }, []);

  // Each pick glides its section's heading to the top of the pane, where the
  // first heading sits at rest (topTarget).
  const seen = useRef(goto);
  useEffect(() => {
    if (!goto || goto === seen.current) return;
    seen.current = goto;
    const el = ref.current!;
    const sec = el.querySelector<HTMLElement>(`[data-sec="${goto.id}"]`);
    if (!sec) return;
    return glideScroll(
      el,
      topTarget(sectionTop(sec), el.clientHeight, el.scrollHeight),
    );
  }, [goto]);

  return (
    <div
      ref={ref}
      className={`vlist help-sheet${scrolling ? " is-scrolling" : ""}`}
      style={
        {
          "--list-pad": `${LIST_ROWS.pad}px`,
          "--list-pad-end": `${LIST_ROWS.padEnd}px`,
          "--list-top": `${LIST_ROWS.top}px`,
        } as CSSProperties
      }
      onScroll={(e) => {
        savedScroll = e.currentTarget.scrollTop;
        spy();
        setScrolling(true);
        clearTimeout(idleTimer.current);
        idleTimer.current = window.setTimeout(
          () => setScrolling(false),
          SCROLLBAR_IDLE_MS,
        );
      }}
    >
      <div className="help-body">
        <Sec id="start" title="Quick start">
          <p>
            Selectoscope is a visual tool that lets you explore network
            structure through linked interpretable views. Select nodes and/or
            edges from the visual pattern in one pane to examine the same
            selection set in other panes.
          </p>
          <p>
            The interface has three parts. The top control strip has selection
            set choice (node sets, edge sets, or both), a report of selection
            counts, choice of brush modality, and controls that grow or shrink
            sets. Then the main section is composed of horizontally juxtaposed
            panes that show the same network dataset in various ways, surfacing
            different yet interpretable visual patterns. Finally, the bottom
            control strip is dynamic, changing the controls offered in response
            to the focused pane.
          </p>
          <InterfaceMap />
          <p>Consider these steps as a quick start:</p>
          <ol className="help-steps">
            <li>
              Change the loaded data from the DATA pane, which can be toggled
              back from this HELP pane by clicking the ? button.
            </li>
            <li>
              Drag in any pane to brush a selection area around a visual pattern
              that catches your eye.
              <Replica>
                <Choice
                  label="Brush"
                  options={TOOLS}
                  value="lasso"
                  onPick={none}
                />
              </Replica>
            </li>
            <li>
              Then look across to other panes, the same nodes highlight with
              blue and edges with orange, wherever they sit in their respective
              visual patterns.
              <SetCounts />
            </li>
            <li>
              Click ▲ in EXTEND SET to grow your selection by one hop, and see
              how far the selection spreads.
              <Replica>
                <ExtendStepper />
              </Replica>
            </li>
            <li>
              Hover the SELECTION COUNT in the top control strip and click CLEAR
              to start over, or lasso an empty region in any pane.
            </li>
            <li>
              Run AUTO SWEEP at the bottom control strip to scan an animated
              selection band area across the vertical span of the pane, then
              watch the selection across every other pane.
              <Replica>
                <Transport
                  cells={RUN_CELLS}
                  state="idle"
                  running={false}
                  onClick={none}
                />
              </Replica>
            </li>
          </ol>
          <p>Click ? to come back to this HELP pane at any time.</p>
        </Sec>

        <Sec id="select" title="Selection controls">
          <p>
            Each color shows in every pane. Hover an item to highlight it red
            everywhere.
          </p>
          {figures ? (
            <ul className="help-legend">
              <li>
                <Mark kind="node" />
                <span>Node set: the nodes you picked</span>
              </li>
              <li>
                <Mark kind="edge" />
                <span>Edge set: the edges you picked</span>
              </li>
              <li>
                <Mark kind="hover" />
                <span>Hovered item: under your pointer</span>
              </li>
            </ul>
          ) : (
            <p>
              Node set: the nodes you picked. Edge set: the edges you picked.
              Hovered item: under your pointer.
            </p>
          )}
          <p>
            Drag in any pane to draw a selection area, any selected items
            replace the existing selection.
          </p>
          <p>With BRUSH choose a modality for the drawn selection.</p>
          <Replica>
            <Choice label="Brush" options={TOOLS} value="lasso" onPick={none} />
          </Replica>
          <p>
            Hold Shift while dragging to add to the selection, or Alt (Windows)
            or Option (MacOS) to remove.
          </p>
          <p>
            Click a hovered item (in red) to add or remove it from the selection
            set.
          </p>
          <p>
            Choose in SELECTION SET whether a drawn area takes NODES, EDGES or
            BOTH. In a pane with only node items, EDGES mode takes the edges
            between the nodes inside the drawn area.
          </p>
          <Replica>
            <Choice
              label="Selection set"
              options={SELECT_MODES}
              value="both"
              onPick={none}
            />
          </Replica>
          <p>
            SELECTION COUNT shows how much of the graph each set holds. Hover
            and click CLEAR to empty the selection set.
          </p>
          <SetCounts />
          <p>
            Click ▲ in EXTEND SET to grow your selection by one hop; ▼ steps
            back, but never removes what you picked yourself.
          </p>
          <Replica>
            <ExtendStepper />
          </Replica>
          <ExtendHops />
          <p>An empty drawn area in any pane clears an existing selection.</p>
        </Sec>

        <Sec id="navigate" title="General navigation">
          <p>Two-finger pinch to zoom at the pointer in any pane.</p>
          <p>
            Two-finger scroll or scroll wheel to pan in any pane. Special cases
            are NODELINK in a 3D layout, where it rotates, and the DATA, HELP,
            and LABELS panes, where it scrolls the list vertically.
          </p>
          <p>Hold Space and drag to pan.</p>
          <Gestures />
          <p>
            Click a pane's zoom % at the respective pane header (or bottom
            control strip) to fit the visual pattern into the pane.
          </p>
          <Replica>
            <Stepper
              label={TEXT.zoom.name}
              readout="85%"
              onLess={none}
              onMore={none}
              onReadout={none}
              lessLabel={TEXT.zoom.out}
              moreLabel={TEXT.zoom.in}
            />
          </Replica>
          <p>
            Click a pane's title or header to change pane type or pane aspect
            ratio.
          </p>
          <p>
            Drag the border between two panes to resize them. Double-click it to
            make panes on each side of the border have equal pane width. When
            the browser window is taller than it is wide, panes keep their
            shapes at full height and scroll sideways instead.
          </p>
          <p>
            Slide CONTRAST in the top control strip to fade everything but the
            selection set, and turn on DARK to make selections stand out more,
            in some cases.
          </p>
          <Replica>
            <Slider
              label="Contrast"
              range={CONTRAST}
              value={40}
              onChange={none}
            />
          </Replica>
          <Replica>
            <Switch label="Dark" on={false} onToggle={none} />
          </Replica>
        </Sec>

        <Sec id="panes" title="Panes">
          <p>
            Each pane draws the same loaded network in its own way. Here is what
            each pane shows, and what its bottom control strip offers.
          </p>
          <PaneBlock title="Data + Help">
            <p>
              In the DATA pane, click a dataset from the list to load it,
              replacing the already loaded dataset. Loading a fresh dataset also
              clears any node or edge selection set. The bottom control strip
              then serves that dataset: its export, and for your own data its
              files (see USING YOUR OWN DATA below).
            </p>
            <p>
              Turn on THUMBNAILS to see a NODELINK edges-only preview of the
              dataset's BESPOKE 2D view when the layout is available, else falls
              back to the force-directed 2D layout.
            </p>
            <Replica>
              <Switch label="Thumbnails" on onToggle={none} />
            </Replica>
            <p>
              Click ? in the pane's header, or at the left corner of the bottom
              control strip, to switch between the DATA pane and this HELP pane.
            </p>
            <Replica>
              <HelpToggle on onToggle={none} label={TEXT.help.name} />
            </Replica>
          </PaneBlock>
          <PaneBlock title="Labels">
            <p>
              One row per node, where rows selected are automatically sorted to
              the top for visibility, once the pointer leaves the list.
            </p>
            <p>
              Select nodes with the same operations as the other panes: hover to
              highlight, click a row to select or unselect a node row, drag to
              select many contiguous node rows (Alt or Option to remove from the
              selection set).
            </p>
            <p>Sort the vertical order of rows by:</p>
            <Replica>
              <Choice
                label="Vertical order by"
                options={LABEL_SORTS}
                value="degree"
                onPick={none}
              />
            </Replica>
            <p>
              LABELS (A–Z) for an alphabetical sort, ignoring case, with numbers
              in numeric order, and unlabeled nodes last.
            </p>
            <p>
              DEGREE for a sort based on degree centrality, or how many
              neighbors each node has, the most first. Degree is also the
              tie-breaker in the other numeric sorts.
            </p>
            <p>
              ONION for a sort based on the onion decomposition, or how deep a
              node sits in the graph's density gradient: the later a peeling of
              the least-connected nodes removes the node at hand, the higher its
              onion value.
            </p>
            <p>
              EIGENVECTOR for a sort based on eigenvector centrality directly
              from the Adjacency matrix, or how well connected a node's
              neighbors are, the highest first.
            </p>
            <p>
              Every sort but LABELS (A–Z) shows each node's value in a column
              between its number and its label: whole numbers for DEGREE and
              ONION, three decimals for EIGENVECTOR. When the pane is narrow,
              the node number hides first, so the value and the label keep the
              room.
            </p>
          </PaneBlock>
          <PaneBlock title="NodeLink">
            <p>
              Nodes are points and edges are lines that link connected node
              pairs, a familiar and intuitive visual representation of network
              structure. For selection, a drawn area takes the node points
              inside in NODES mode, the edges they share in EDGES mode, and both
              in BOTH mode.
            </p>
            <p>
              Layout: All datasets can be shown with a standard force-directed
              2D layout, seeded by the first two harmonics of the spectral
              eigendecomposition (see MATRIX PANE description below). Similarly,
              a force-directed 3D layout, seeded by the first three harmonics,
              can be computed on demand. Additionally, datasets can have their
              own bespoke layouts, shown with BESPOKE 2D and BESPOKE 3D when
              available.
            </p>
            <Replica>
              <Choice
                label="Layout"
                options={LAYOUTS}
                value="fd"
                onPick={none}
              />
            </Replica>
            <p>
              Toggle INTERACTIVE mode to start a force-directed simulation from
              the current layout. In INTERACTIVE mode nodes can be moved by
              dragging. Because of runtime computing cost, INTERACTIVE mode is
              unavailable for datasets above 6000 nodes or 20000 edges.
            </p>
            <Replica>
              <Switch label="Interactive" on onToggle={none} />
            </Replica>
          </PaneBlock>
          <PaneBlock title="Matrix">
            <p>
              This pane surfaces visual patterns from matrix seriation, or the
              symmetric ordering of nodes along the side of the matrix. For
              selection, a drawn area takes the edge points inside it: in EDGES
              mode the edge points directly, in BOTH mode their node endpoints
              as well. In NODES mode a drawn area only selects matrix
              gridlines.
            </p>
            <p>
              Layout: The visual idiom is the classic Adjacency Matrix, where
              edges are points, and their respective nodes drawn as lines along
              rows and columns. By default the matrix is shown as a DIAMOND with
              the diagonal running vertically, though the traditional SQUARE
              view is also available.
            </p>
            <MatrixForms />
            <Replica>
              <Choice
                label="Layout"
                options={FORMS}
                value="diamond"
                onPick={none}
              />
            </Replica>
            <p>
              The visual pattern surfaced by edge points can reveal positional
              or structural information about nodes. We use spectral seriation
              to capture positional information, or where in the topology two
              nodes are; and Principal Component Analysis (PCA) seriation to
              capture structural information, or how similar the neighborhoods
              of two nodes are.
            </p>
            <p>
              For positional information: the H1, H2 and H3 diagonal orders are
              the first three harmonics of the graph's Laplacian, smoothest
              first. Each spectral harmonic places linked nodes close in the
              visual pattern. The first harmonic is H1, which surfaces a visual
              pattern that results from the node ordering following the Fiedler
              eigenvector, the smoothest harmonic. The next harmonics are H2 and
              H3 (no eponyms), each orthogonal to all previous harmonics.
            </p>
            <p>
              For structural information: the PC1, PC2 and PC3 diagonal orders
              come from the PCA of the nodes' neighborhoods. Each PC places
              nodes with similar neighborhoods close, whether or not they are
              linked. The first PC is PC1, which explains the most variance: the
              diagonal polar ends, or the extremes of the visual pattern,
              surface the strongest contrast between neighborhoods. Next are PC2
              and PC3, which explain the next most variance, each orthogonal to
              the PCs before them.
            </p>
            <p>
              Every diagonal order starts from its denser pole, with the higher
              mean degree facing the top of the pane.
            </p>
            <Replica>
              <Choice
                label="Diagonal order by"
                options={SERIATIONS}
                value="harm1"
                onPick={none}
              />
            </Replica>
          </PaneBlock>
          <PaneBlock title="Shells">
            <p>
              This pane shows how density varies within the graph. Density is a
              measure of edge saturation, or how connected a group of nodes are
              to each other, from sparse (least density) to complete (most
              density). For selection, a drawn area takes the node points inside
              it in NODES mode, while edges are drawn only when selected, as
              orange chords; or hovered, as a red chord. These chords can't be
              clicked, but a drawn area in EDGES or BOTH mode does select the
              edges between the nodes it covers.
            </p>
            <p>
              Layout: A new visual idiom we call kSnakes, where nodes are points
              that are vertically placed according to k-core shell membership
              (reported as text on the right side of the pane), which maps
              height to the depth into the graph's dense core. Nodes in the
              densest core are at the top, while nodes in the sparse periphery
              are at the bottom. Within each k-core shell, the onion
              decomposition (numbers on the left) sets every node's height,
              which creates snake-like visual patterns. Node points are drawn
              within an enclosure if they are part of the same connected
              component within that k-core shell.
            </p>
            <ShellsAnatomy />
            <p>The horizontal order of connected components can be by:</p>
            <Replica>
              <Choice
                label="Horizontal order by"
                options={ORDERINGS}
                value="topdown"
                onPick={none}
              />
            </Replica>
            <p>
              SIZE packs components within a k-core shell horizontally from
              sparse to dense: by a component's highest onion value, then by its
              total onion value, then its size in number of nodes, arranged from
              left to right.
            </p>
            <p>
              BARYCENTER places each component at the barycenter, or mean
              horizontal position, of its neighbors in denser shells, nearer
              shells counting more, so components that connect across shells
              line up, a layout that results from reducing edge crossings.
            </p>
            <p>
              The aspect ratio of the visual pattern can be adjusted with the
              SPACING slider. The vertical GRIDLINES that bin component
              locations for horizontal SIZE or BARYCENTER ordering can be made
              visible as well.
            </p>
            <Replica>
              <Slider
                label="Spacing"
                range={BIN_SPACING}
                value={BIN_SPACING.opening}
                onChange={none}
              />
              <Switch label="Gridlines" on={false} onToggle={none} />
            </Replica>
            <p>
              Sometimes a k-core shell can have many singleton nodes, which can
              make the visual pattern crowded. Singletons are bare node points
              with no enclosure, placed vertically according to their onion
              value. The GROUP SINGLETONS toggle collects singletons within a
              k-core shell, holding one enclosure per onion value that
              aggregates and counts all of its singletons. A group's enclosure
              acts as all its singletons: hovering highlights them all, a click
              selects them all, and once some are selected it reads selected
              over total.
            </p>
            <Replica>
              <Switch label="Group singletons" on={false} onToggle={none} />
            </Replica>
          </PaneBlock>
          <PaneBlock title="Hops">
            <p>
              This pane shows how eccentricity varies within the graph.
              Eccentricity is the distance in hops a given node is from its
              furthest reachable nodes, from central nodes (low eccentricity) to
              peripheral nodes (high eccentricity). For selection, a drawn area
              takes any overlapping node polylines in NODES mode. Edges are
              never drawn in this pane, but EDGES and BOTH modes take the edges
              between the polylines the area covers.
            </p>
            <p>
              Layout: Shown is a new visual idiom we call HopCensus, where each
              node is visually encoded by a polyline. A polyline is drawn from a
              vector of integers in a shared coordinate system: stubs (edge
              ends) met for the first time at each hop from the node, starting
              from its degree at hop 0, until the whole graph is traversed. The
              shape of the polyline comes from the varying stub counts, while
              the traversal extent in hops maps to the length of polyline, or
              the node's eccentricity (reported as text on the right side of the
              pane). Locally, polylines are drawn within a unit square, all
              share the same vertical scale; the tallest and longest set the
              relative extremes within the unit square. In the overall vertical
              span of the pane, the most central nodes are at the top (shortest
              polyline lengths, the radius nodes), while the nodes on the
              graph's perimeter are at the bottom (longest polyline lengths, the
              diameter endpoint nodes).
            </p>
            <HopsAnatomy />
            <p>
              The SPACING slider sets how far the polylines move horizontally,
              following a chosen ordering by polyline shape similarity:
            </p>
            <Replica>
              <Choice
                label="Horizontal order by shape"
                options={CENSUS_MEASURES}
                value="reach"
                onPick={none}
              />
            </Replica>
            <Replica>
              <Slider
                label="Spacing"
                range={SLIDE_RAIL}
                value={railOfSlide(SLIDE.opening)}
                readout={slideText(SLIDE.opening)}
                onChange={none}
              />
            </Replica>
            <p>
              DEGREE is a measure of degree centrality in percent, or the number
              of neighbor nodes a given node has, divided by the number of other
              nodes (node count minus one). The first value of a polyline is the
              node's degree, the stubs met at hop 0. Polylines that start high
              (large degree) move to the left, while polylines that start low
              (small degree) move to the right.
            </p>
            <ShapeOrder measure="degree" />
            <p>
              REACH is a measure of where the mean of the polyline shape is, in
              terms of hops. Polyline shapes with a small mean hop move to the
              left, while shapes with a large mean hop move to the right. In
              percent, the mean hop, as a share of length in hops.
            </p>
            <ShapeOrder measure="reach" />
            <p>
              SPREAD is a measure of how much of the polyline shape spreads
              horizontally over hops. Polyline shapes that spread over many hops
              move to the left, while polylines that have a narrow peak move to
              the right. In percent, the standard deviation of the polyline in
              hops, as a share of length in hops.
            </p>
            <ShapeOrder measure="spread" />
            <p>
              SKEW is a measure of how much of the polyline shape exists before
              or after the mean hop. Polylines whose bulk shape occurs in early
              hops and trail off in a long tail move to the left, while a
              polyline shape that starts shallow and climbs later moves to the
              right. In percent, how much further the polyline's last tenth of
              stubs lies past its mean hop, versus its first tenth lies before
              the mean hop, as a share of length in hops.
            </p>
            <ShapeOrder measure="skew" />
            <p>
              The RANKING toggle places polyline shapes following an evenly
              spaced horizontal ranking, with polylines of equal values
              superimposed. When off, each polyline sits at its numeric value,
              so gaps and outliers show.
            </p>
            <Replica>
              <Switch label="Ranking" on={false} onToggle={none} />
            </Replica>
          </PaneBlock>
        </Sec>

        <Sec id="sweep" title="Auto Sweep">
          <p>
            Click RUN in the bottom control strip to automatically sweep a
            selection area across the extent of the focused pane. By default the
            scan runs from the top of the pane to the bottom. Turn off VERTICAL
            to sweep left to right. The AREA setting sets how much of the pane
            the band covers, while SPEED sets how fast the band travels. The
            band highlights what a drawn area would take with the current
            SELECTION SET mode. The animated thin strip in the pane footer
            reports the progress of the sweep; click to toggle wrap around
            behavior that restarts as it leaves the end, rather than restarting
            after a full sweep.
          </p>
          <Replica>
            <Transport
              cells={RUN_CELLS}
              state="idle"
              running={false}
              onClick={none}
            />
            <Transport
              cells={RUN_CELLS}
              state="running"
              running
              onClick={none}
            />
          </Replica>
          <SweepBand />
          <Replica>
            <Switch label="Vertical" on onToggle={none} />
          </Replica>
          <Replica>
            <Slider
              label="Area"
              range={SWEEP_AREA}
              value={SWEEP_AREA.opening}
              onChange={none}
            />
          </Replica>
          <Replica>
            <Slider
              label="Speed"
              range={SWEEP_SPEED}
              value={SWEEP_SPEED.opening}
              onChange={none}
            />
          </Replica>
          <p>
            While a sweep is active, BRUSH and EXTEND SET are on hold and
            inactive, so the SELECTION COUNT follows the band. At any time press
            ↓ or → for a MANUAL step forward, or ↑ or ← to step back; or hold to
            keep the band moving. A step pauses the sweep; click RESUME to carry
            on automatically.
          </p>
          <Replica>
            <Transport
              cells={RUN_CELLS}
              state="paused"
              running={false}
              onClick={none}
            />
            <HoldStepper
              label="Manual"
              word="Manual"
              forwardLabel={TEXT.sweep.stepForward}
              backLabel={TEXT.sweep.stepBack}
              onPress={none}
              onRelease={none}
            />
          </Replica>
          <p>
            Click STOP, or change the selection by drawing an area, clicking an
            item, or loading a dataset, to end the AUTO SWEEP and resume manual
            selection. General navigation like zooming, panning and rotating
            within panes does not stop an active sweep.
          </p>
        </Sec>

        <Sec id="data" title="Using your own data">
          <p>
            Click the +NEW row at the top of the DATA pane to add your own
            network data.
          </p>
          <p>
            Choose BUILD FROM CSV to create a dataset from an edgelist, or
            UPLOAD FROM JSON to open a previously built and exported
            SELECTOSCOPE dataset. All processing happens in your browser, and
            your files never leave it. Selectoscope supports up to 10,000 nodes
            and 100,000 edges.
          </p>
          <Replica>
            <Choice
              label="Upload your data"
              options={UPLOADS}
              value="csv"
              onPick={none}
            />
          </Replica>
          <p>
            To build a dataset, the main file format is the EDGELIST, a CSV file
            with 'source' and 'target' columns, with one edge per row. Column
            names can be in any case. For example, 'Source' reads as 'source'.
            Nodes must match across CSVs under a 'node_id' column, where values
            are treated as plain trimmed strings. For example, "1" and "01"
            count as different 'node_id' entries. The 'node_id' strings can be
            any text, but must match exactly across EDGELIST, LABELS, BESPOKE
            2D, and BESPOKE 3D files to build correctly.
          </p>
          <p>
            Selectoscope automatically cleans the EDGELIST information: edge
            direction is ignored, self-loops are removed, duplicate edges are
            merged, and only the largest connected component is kept. Click ADD
            to build.
          </p>
          <Replica>
            <FilePill
              name="Edgelist"
              added={false}
              accent="key"
              onPick={none}
            />
            <Transport
              cells={ADD_COPY}
              state="idle"
              running={false}
              onClick={none}
            />
          </Replica>
          <p>
            Per dataset built through CSV, optional files must use the 'node_id'
            column and match the EDGELIST. There are three optional CSV files to
            upload. The BESPOKE 2D layout requires 'node_id', 'x', and 'y'
            columns, and BESPOKE 3D requires 'node_id', 'x', 'y', and 'z'
            columns, both of which must account for every node in EDGELIST. The
            LABELS requires 'node_id' and 'label' columns. In contrast to the
            bespoke layouts, labels can be partial.
          </p>
          <Replica>
            <FilePill
              name="Labels"
              added={false}
              accent="extra"
              onPick={none}
            />
            <FilePill
              name="Bespoke 2D"
              added={false}
              accent="extra"
              onPick={none}
            />
            <FilePill
              name="Bespoke 3D"
              added={false}
              accent="extra"
              onPick={none}
            />
          </Replica>
          <p>
            Once built, the options in CHANGE can add, replace, or remove files.
            Click EXPORT CSVS to save the built CSV files, or click EXPORT JSON
            to save a built dataset as a single file. Reopen the dataset through
            +NEW and UPLOAD FROM JSON, without rebuilding.
          </p>
        </Sec>
      </div>
    </div>
  );
}

// Selection count's copies, each pill on its own live tray, one above the
// other, so they fit the sheet's width.
function SetCounts() {
  return (
    <>
      <Replica tray>
        <SetCountView
          type="node"
          count={121}
          total={484}
          clearable={false}
          onClear={none}
        />
      </Replica>
      <Replica tray>
        <SetCountView
          type="edge"
          count={798}
          total={1597}
          clearable={false}
          onClear={none}
        />
      </Replica>
    </>
  );
}

// Extend set's copy, as the top strip draws it after one Grow.
function ExtendStepper() {
  return (
    <ArrowStepper
      label="Extend set"
      readout="+1 hop"
      down={{ label: TEXT.top.shrink, onClick: none }}
      up={{ label: TEXT.top.grow, onClick: none }}
    />
  );
}

const none = () => {};

// Where a section sits at the top of the view: its heading as far from the
// top as the first heading is at rest.
const sectionTop = (sec: HTMLElement) => sec.offsetTop - LIST_ROWS.top;

// The largest a copy of a control is drawn, as a share of its strip size.
const REPLICA_ZOOM = 0.8;

// An inert copy of a real control, so the reader matches it by its look: no
// tab stop, click, hover or tooltip. Drawn at 80%, and smaller still only
// when it would be wider than the sheet. `tray` sets it on a live tray, for
// the count pills, which have no outline of their own. Figures off hides it.
function Replica(props: { tray?: boolean; children: ReactNode }) {
  const figures = useStore(ui, (s) => s.figures);
  return figures ? <ReplicaRow {...props} /> : null;
}

function ReplicaRow({
  tray,
  children,
}: {
  tray?: boolean;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(REPLICA_ZOOM);
  useLayoutEffect(() => {
    const row = rowRef.current!;
    const el = ref.current!;
    const fit = () => {
      const style = getComputedStyle(row);
      const room =
        row.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const natural =
        el.getBoundingClientRect().width /
        (Number(el.style.zoom) || REPLICA_ZOOM);
      if (natural > 0 && room > 0)
        setZoom(Math.min(REPLICA_ZOOM, room / natural));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={rowRef} className="help-replica-row">
      <div
        ref={ref}
        className={`help-replica${tray ? " control is-live" : ""}`}
        inert
        aria-hidden="true"
        style={{ zoom }}
      >
        {children}
      </div>
    </div>
  );
}

// A section, headed by its title.
function Sec({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="help-sec" data-sec={id}>
      <h3 className="help-head">{title}</h3>
      {children}
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="help-pane">
      <h4 className="help-head help-subhead">{title}</h4>
      {children}
    </div>
  );
}

const PaneBlock = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => <Block title={`${title} pane`}>{children}</Block>;

// A two-node snippet drawn as the panes draw it: the node set's nodes in
// blue, the edge set's edge in orange, a hovered node in red, the rest in the
// neutral mark ink. The hovered node is a little larger, as it reads first.
// Data colours describing data, so they may carry them.
function Mark({ kind }: { kind: "node" | "edge" | "hover" }) {
  const ink = (on: boolean, colour: string, plain: string) =>
    `var(${on ? colour : plain})`;
  return (
    <svg className="help-mark" viewBox="0 0 44 16" aria-hidden="true">
      <line
        x1="8"
        y1="8"
        x2="36"
        y2="8"
        stroke={ink(kind === "edge", "--edge-sel", "--mark-edge")}
        strokeWidth={kind === "edge" ? 4.5 : 1.5}
        strokeLinecap="round"
      />
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill={ink(kind === "node", "--node-sel", "--mark-node")}
      />
      <circle
        cx="36"
        cy="8"
        r={kind === "hover" ? 6.5 : 5.5}
        fill={ink(
          kind !== "edge",
          kind === "hover" ? "--hover" : "--node-sel",
          "--mark-node",
        )}
      />
    </svg>
  );
}

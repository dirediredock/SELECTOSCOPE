import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useStore } from "../../state/createStore";
import { LIST_ROWS } from "../../components/VirtualList";
import {
  Action,
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
const ADD_COPY = [{ id: "idle", content: <><PlayGlyph /> Add</> }] as const;
import { Choice } from "../../components/Choice";
import { SetCountView } from "../../components/TopBar";
import { CONTRAST, ui } from "../../state/uiStore";
import { CENSUS_MEASURES, FORMS, LABEL_SORTS, LAYOUTS, ORDERINGS, SELECT_MODES, SERIATIONS, TOOLS, UPLOADS } from "../../controlOptions";
import { BIN_SPACING } from "../../state/ksnakes";
import { SWEEP_AREA, SWEEP_SPEED } from "../../state/sweep";
import { railOfSlide, SLIDE, SLIDE_RAIL, slideText } from "../../state/hopcensus";
import { TEXT } from "../../controlText";
import { glideScroll } from "../../components/glideScroll";
import { attachListPan } from "../../interaction/listPan";
import { HELP_SECTIONS, helpNav, sectionAt, topTarget } from "./helpNav";
import { CoresAnatomy, ExtendHops, Gestures, HopsAnatomy, InterfaceMap, MatrixForms, SweepBand, WaveOrder } from "./helpFigures";

// Where the sheet was left, for the session, so closing and reopening it
// returns to the same place.
let savedScroll = 0;

// How long the scrollbar stays after the last scroll, as in VirtualList.
const SCROLLBAR_IDLE_MS = 1000;

// The Data slot's other face: docs/help.txt, word for word, with an inert
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
    const tops = Array.from(el.querySelectorAll<HTMLElement>("[data-sec]"), (s) => sectionTop(s));
    const section = HELP_SECTIONS[sectionAt(tops, el.scrollTop, el.clientHeight, el.scrollHeight)]!.id;
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
    return glideScroll(el, topTarget(sectionTop(sec), el.clientHeight, el.scrollHeight));
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
        idleTimer.current = window.setTimeout(() => setScrolling(false), SCROLLBAR_IDLE_MS);
      }}
    >
      <div className="help-body">
        <Sec id="start" title="Quick start">
          <p>
            Selectoscope is a visual tool that lets you explore network structure through linked interpretable views.
            Select nodes and/or edges from the visual pattern in one pane to examine the same selection set in other
            panes.
          </p>
          <p>
            The interface has three parts. The top control strip has selection set choice (node sets, edge sets, or
            both), a report of selection counts, choice of brush modality, and controls that grow or shrink sets. Then
            the primary view, or the main middle view, is composed of panes that show the same network dataset in
            various ways, surfacing different yet interpretable visual patterns. Finally, the bottom control strip is
            dynamic, changing offered controls in response to the focused pane.
          </p>
          <InterfaceMap />
          <p>Consider these steps as a quick start:</p>
          <ol className="help-steps">
            <li>
              Change the loaded data from the DATA pane, which can be toggled back from this HELP pane by clicking the ?
              button.
            </li>
            <li>
              Drag in any pane to brush a selection area around a visual pattern that catches your eye.
              <Replica>
                <Choice label="Brush" options={TOOLS} value="lasso" onPick={none} />
              </Replica>
            </li>
            <li>
              Then look across to other panes, the same nodes light up blue and edges orange, wherever they sit.
              <SetCounts />
            </li>
            <li>
              Click ▲ in EXTEND SET to grow your selection by one hop, and see how far the selection spreads.
              <Replica>
                <ExtendStepper />
              </Replica>
            </li>
            <li>
              Run AUTO SWEEP at the bottom control strip to scan an animated selection band area across the vertical
              span of the pane, then watch the selection across every other pane.
              <Replica>
                <Transport cells={RUN_CELLS} state="idle" running={false} onClick={none} />
              </Replica>
            </li>
            <li>
              Hover the SELECTION COUNT in the top control strip and click CLEAR to start over, or lasso an empty
              region in any pane.
            </li>
          </ol>
          <p>Click ? to come back to this HELP pane at any time.</p>
        </Sec>

        <Sec id="select" title="Selection controls">
          <p>Each color shows in every pane. Hover an item to light it red everywhere.</p>
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
            <p>Node set: the nodes you picked. Edge set: the edges you picked. Hovered item: under your pointer.</p>
          )}
          <p>Drag in any pane to draw a selection area, any selected items replace the existing selection.</p>
          <p>With BRUSH choose a modality for the drawn selection.</p>
          <Replica>
            <Choice label="Brush" options={TOOLS} value="lasso" onPick={none} />
          </Replica>
          <p>
            Hold Shift while dragging to add to the selection, or Alt (Windows) or Option (MacOS) to remove.
          </p>
          <p>Click a hovered item (in red) to add or remove it from the selection set.</p>
          <p>
            Choose in SELECTION SET whether a drawn area takes NODES, EDGES or BOTH. In a pane with only node items,
            EDGES mode takes the edges between the nodes inside the drawn area.
          </p>
          <Replica>
            <Choice label="Selection set" options={SELECT_MODES} value="both" onPick={none} />
          </Replica>
          <p>SELECTION COUNT shows how much of the graph each set holds. Hover and click CLEAR to empty the selection set.</p>
          <SetCounts />
          <p>
            Click ▲ in EXTEND SET to grow your selection by one hop; ▼ steps back, but never
            removes what you picked yourself.
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
            Two-finger scroll or scroll wheel to pan in any pane. Special cases are NODELINK in a 3D layout, where it
            rotates, and the DATA, HELP, and LABELS panes, where it scrolls the list vertically.
          </p>
          <p>
            Hold Space and drag to pan.
          </p>
          <Gestures />
          <p>
            Click a pane's zoom % at the respective pane header (or bottom control strip) to fit the visual pattern into
            the pane.
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
          <p>Click a pane's title or header to change pane type or pane aspect ratio.</p>
          <p>
            Drag the border between two panes to resize them. Double-click it to make panes on each side of the border
            have equal pane width.
          </p>
          <p>
            Slide CONTRAST in the top control strip to fade everything but the selection set, and turn on DARK to make
            selections stand out more, in some cases.
          </p>
          <Replica>
            <Slider label="Contrast" range={CONTRAST} value={40} onChange={none} />
          </Replica>
          <Replica>
            <Switch label="Dark" on={false} onToggle={none} />
          </Replica>
        </Sec>

        <Sec id="panes" title="Panes">
          <p>
            Each pane draws the same loaded network in its own way. Here is what each pane shows, and what its bottom
            control strip offers.
          </p>
          <PaneBlock title="Data + Help">
            <p>
              In the DATA pane, click a dataset from the list to load it, replacing the already loaded dataset. Loading
              a fresh dataset also clears any node or edge selection set. The bottom control strip then serves that
              dataset: its export, and for your own data its files (see UPLOADED below).
            </p>
            <p>
              Turn on THUMBNAILS to see a NODELINK preview of the dataset's BESPOKE 2D layout, or else the default
              force-directed 2D, with edges only.
            </p>
            <Replica>
              <Switch label="Thumbnails" on onToggle={none} />
            </Replica>
            <p>
              Click ? in the pane's header, or at the left corner of the bottom control strip, to switch between the
              DATA pane and this HELP pane.
            </p>
            <Replica>
              <HelpToggle on onToggle={none} label={TEXT.help.name} />
            </Replica>
            <p>In the HELP pane, turn off FIGURES to hide the diagrams and control copies, leaving the text alone.</p>
            <Replica>
              <Switch label="Figures" on onToggle={none} />
            </Replica>
          </PaneBlock>
          <PaneBlock title="Labels">
            <p>
              One row per node, where rows selected are automatically sorted to the top for visibility, once the pointer
              leaves the list.
            </p>
            <p>
              Select nodes with the same operations as the other panes: hover to highlight, click a row to select or
              unselect a node row, drag to select many contiguous node rows (Alt or Option to remove from the selection set).
            </p>
            <p>Sort the vertical order of rows by:</p>
            <Replica>
              <Choice label="Vertical order by" options={LABEL_SORTS} value="degree" onPick={none} />
            </Replica>
            <p>LABELS (A–Z) for an alphabetical sort, ignoring case, with numbers in numeric order, and unlabeled nodes last.</p>
            <p>
              DEGREE for a sort based on degree centrality, or how many neighbors each node has, the most first. Degree is
              also the tie-breaker in the other numeric sorts.
            </p>
            <p>
              ONION for a sort based on the onion decomposition, or how deep a node sits in the graph's density gradient:
              the later a peeling of the least-connected nodes removes the node at hand, the higher its onion value. The
              deepest nodes come first.
            </p>
            <p>
              EIGENVECTOR for a sort based on eigenvector centrality, or how well connected a node's neighbors are,
              counted recursively, the highest first.
            </p>
            <p>
              Every sort but LABELS (A–Z) shows each node's value in a column between its number and its label: whole
              numbers for DEGREE and ONION, three decimals for EIGENVECTOR. When the pane is narrow, the node number hides
              first, so the value and the label keep the room.
            </p>
          </PaneBlock>
          <PaneBlock title="NodeLink">
            <p>
              Nodes are points and edges are lines that link connected node pairs, a familiar and intuitive visual
              representation of network structure. For selection, a drawn area takes the node points inside it in NODES
              mode, the edges they share in EDGES mode, and both in BOTH mode.
            </p>
            <p>
              Layout: All datasets can be shown with a standard force-directed 2D, seeded by the first two harmonics of
              the spectral eigendecomposition (see MATRIX PANE description below). Similarly, a force-directed 3D, seeded
              by the first three harmonics, is computed last for datasets that don't bring their own 3D layout; for those
              that do, click COMPUTE 3D LAYOUT in the 3D layout. Datasets can bring their own layouts: BESPOKE 2D
              shows the dataset's own 2D layout, and BESPOKE 3D shows the dataset's own 3D layout.
            </p>
            <Replica>
              <Choice label="Layout" options={LAYOUTS} value="fd" onPick={none} />
            </Replica>
            <p>
              Toggle INTERACTIVE mode on to start a force-directed simulation from the current layout. In INTERACTIVE
              mode nodes can be moved by dragging. Because of computing cost, INTERACTIVE mode is unavailable for datasets above
              6000 nodes or 20000 edges.
            </p>
            <Replica>
              <Switch label="Interactive" on onToggle={none} />
            </Replica>
          </PaneBlock>
          <PaneBlock title="Matrix">
            <p>
              This pane surfaces visual patterns from matrix seriation, or the symmetric ordering of nodes along the side
              of the matrix. For selection, a drawn area takes the edge points inside it: in EDGES mode the edge points
              directly, in NODES mode their endpoint nodes, and in BOTH the two modes act together.
            </p>
            <p>
              Layout: The visual idiom is the classic Adjacency Matrix, where edges are points, and their respective
              nodes drawn as lines along rows and columns. By default the matrix is shown as a DIAMOND with the diagonal
              running vertically, though the traditional SQUARE view is also available.
            </p>
            <MatrixForms />
            <Replica>
              <Choice label="Layout" options={FORMS} value="diamond" onPick={none} />
            </Replica>
            <p>
              The visual pattern surfaced by edge points can reveal positional or structural information about nodes. We
              use spectral seriation to capture positional information, or where in the topology two nodes are; and
              Principal Component Analysis (PCA) seriation to capture structural information, or how similar the
              neighborhoods of two nodes are.
            </p>
            <p>
              For positional information: the H1, H2 and H3 diagonal orders are the first three harmonics of the graph's
              Laplacian, smoothest first. Each spectral harmonic places linked nodes close in the visual pattern. The
              first harmonic is H1, which surfaces a visual pattern that results from the node ordering following the
              Fiedler eigenvector, the smoothest harmonic. The next harmonics are H2 and H3 (no eponyms), each orthogonal
              to all previous harmonics.
            </p>
            <p>
              For structural information: the PC1, PC2 and PC3 diagonal orders come from the PCA of the nodes'
              neighborhoods. Each PC places nodes with similar neighborhoods close, whether or not they are linked. The
              first PC is PC1, which explains the most variance: the diagonal polar ends, or the extremes of the visual
              pattern, surface the strongest contrast between neighborhoods. Next are PC2 and PC3, which explain the next
              most variance, each orthogonal to the PCs before them.
            </p>
            <Replica>
              <Choice label="Diagonal order by" options={SERIATIONS} value="harm1" onPick={none} />
            </Replica>
          </PaneBlock>
          <PaneBlock title="Cores">
            <p>
              This pane is about the graph's density. For selection, a drawn area takes the node points inside it in
              NODES mode, while edges are drawn only when selected, as orange chords; or hovered, as a red chord. These
              chords can't be clicked, but a drawn area in EDGES or BOTH mode does select the edges between the nodes it
              covers.
            </p>
            <p>
              Layout: A new visual idiom we call kSnakes, where nodes are points that are vertically placed according to
              k-core shell membership (reported as text on the right side of the pane), which maps height to the depth
              into the graph's dense core. Nodes in the densest core are at the top, while nodes in the sparse periphery
              are at the bottom. Within each k-core shell, the onion decomposition (numbers on the left) sets every
              node's height, which creates snake-like visual patterns. Node points are drawn within an enclosure if they
              are part of the same connected component within that k-core shell.
            </p>
            <CoresAnatomy />
            <p>The horizontal order of connected components can be by:</p>
            <Replica>
              <Choice label="Horizontal order by" options={ORDERINGS} value="topdown" onPick={none} />
            </Replica>
            <p>
              TOP-DOWN places each component at the mean horizontal position of its neighbors in denser shells,
              nearer shells counting more, so components that connect across shells line up, a layout that results
              from reducing edge crossings.
            </p>
            <p>
              SIZE packs components within a k-core shell horizontally from sparse to dense: by a component's highest
              onion value, then by its total onion value, then its size in number of nodes, arranged from left to right.
            </p>
            <p>
              The aspect ratio of the visual pattern can be adjusted with the SPACING slider. The vertical GRIDLINES that
              bin component locations for horizontal TOP-DOWN or SIZE ordering can be made visible as well.
            </p>
            <Replica>
              <Slider label="Spacing" range={BIN_SPACING} value={BIN_SPACING.opening} onChange={none} />
              <Switch label="Gridlines" on={false} onToggle={none} />
            </Replica>
            <p>
              Sometimes a k-core shell can have many singleton nodes, which can make the visual pattern crowded.
              Singletons are bare node points with no enclosure, placed vertically according to their onion value. The
              GROUP SINGLETONS toggle collects singletons within a k-core shell, holding one enclosure per onion value
              that aggregates and counts all of its singletons.
            </p>
            <Replica>
              <Switch label="Group singletons" on={false} onToggle={none} />
            </Replica>
          </PaneBlock>
          <PaneBlock title="Hops">
            <p>
              This pane is about the graph's eccentricity. It shows a new visual idiom we call HopCensus, where nodes are
              represented by polylines. For selection, a drawn area takes any overlapping node polylines in NODES mode.
              Edges are never drawn in this pane, but EDGES and BOTH modes take the edges between the polylines the area
              covers.
            </p>
            <p>
              Layout: A polyline is drawn from a vector of integers in a shared coordinate system: stubs (edge ends) met
              for the first time at each hop from the node, starting from its degree at hop 0, until the whole graph is
              traversed. The shape of the polyline comes from the varying stub counts, while the traversal extent in
              hops maps to the length of polyline, or the node's eccentricity (reported as text on the right side of the
              pane). In the vertical span of the pane, the most central nodes are at the top (shortest polyline lengths,
              the radius nodes), while the nodes on the graph's perimeter are at the bottom (longest polyline lengths,
              the diameter endpoint nodes).
            </p>
            <HopsAnatomy />
            <p>
              The SPACING slider sets how far the polylines move horizontally, following a chosen ordering by polyline
              wave shape:
            </p>
            <Replica>
              <Choice label="Horizontal wave order by" options={CENSUS_MEASURES} value="reach" onPick={none} />
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
              DEGREE moves to the left polylines that start high (large degree), and those that start low right (low
              degree). In %, the share of the graph's stubs met at hop 0, which is the polyline's first value.
            </p>
            <WaveOrder measure="degree" />
            <p>
              REACH moves to the left waves whose bulk shape arrives in a few hops, and those whose bulk occurs late
              right. In %, the wave's mean hop, its centre of mass, as a share of its length.
            </p>
            <WaveOrder measure="reach" />
            <p>
              SPREAD moves to the left polylines whose wave shapes spread over many of their hops, and moves to the
              right polyline shapes that form a tight wave. In %, the wave's standard deviation in hops as a share of
              its length.
            </p>
            <WaveOrder measure="spread" />
            <p>
              SKEW moves to the left wave shapes whose bulk arrives early and trails off in a long tail, and moves to the
              right polylines that climb for long and end abruptly. In %, how much further the wave's last tenth of stubs
              lies past its mean hop than its first tenth lies before it, as a share of its length.
            </p>
            <WaveOrder measure="skew" />
            <p>
              The RANKING toggle converts each set of equal values into one evenly spaced column (so twins share one).
              When off, each polyline sits at its numeric value, so gaps and outliers show.
            </p>
            <Replica>
              <Switch label="Ranking" on={false} onToggle={none} />
            </Replica>
          </PaneBlock>
        </Sec>

        <Sec id="sweep" title="Auto Sweep">
          <p>
            Click RUN in a pane's bottom control strip to animate a band across the pane, lighting what it covers in
            every pane. While a sweep is active, BRUSH and EXTEND SET are inactive, and the SELECTION COUNT follows the
            band. Press ↓ or → to step forward and ↑ or ← to step back. Hold
            to keep it moving.
          </p>
          <Replica>
            <Transport cells={RUN_CELLS} state="idle" running={false} onClick={none} />
            <Transport cells={RUN_CELLS} state="running" running onClick={none} />
          </Replica>
          <SweepBand />
          <p>A step pauses the sweep; click RESUME to carry on.</p>
          <Replica>
            <Transport cells={RUN_CELLS} state="paused" running={false} onClick={none} />
            <HoldStepper
              label="Arrow"
              word="Arrow"
              forwardLabel={TEXT.sweep.stepForward}
              backLabel={TEXT.sweep.stepBack}
              onPress={none}
              onRelease={none}
            />
          </Replica>
          <p>
            Turn off VERTICAL to sweep left to right. The AREA setting sets how much of the pane the band covers, while
            SPEED sets how fast the band travels.
          </p>
          <Replica>
            <Switch label="Vertical" on onToggle={none} />
          </Replica>
          <Replica>
            <Slider label="Area" range={SWEEP_AREA} value={SWEEP_AREA.opening} onChange={none} />
          </Replica>
          <Replica>
            <Slider label="Speed" range={SWEEP_SPEED} value={SWEEP_SPEED.opening} onChange={none} />
          </Replica>
          <p>
            Click STOP, or change the selection by drawing an area, clicking an item, or loading a dataset, to end the
            sweep. In contrast, general navigation like zooming, panning and rotating within panes does not stop an
            active sweep.
          </p>
        </Sec>

        <Sec id="data" title="Uploaded">
          <p>
            Your own networks sit at the top of the DATA pane, under UPLOADED, newest first, for as long as the page stays
            open. Everything is computed in your browser, and your files never leave it.
          </p>
          <p>
            Click + NEW at the top of UPLOADED, or in ADD DATASET, to upload your own data: it takes the ring, and the
            bottom control strip turns to UPLOAD YOUR DATA. Choose BUILD FROM CSV to build a dataset from your own CSV
            files, computed in your browser, or UPLOAD FROM JSON to open a build file saved by EXPORT, without computing
            anything.
          </p>
          <Replica>
            <Choice label="Upload your data" options={UPLOADS} value="csv" onPick={none} />
          </Replica>
          <p>
            With BUILD FROM CSV, add an edge list with + EDGELIST, type a NAME if you like, and click ADD to add the
            dataset to UPLOADED and show it. Once your edge list is read, its row takes the ring and the bottom control
            strip, and each pane fades in as its part of the build finishes; the force-directed 3D layout comes last.
            Click STOP to stop the build; the row keeps what has landed.
          </p>
          <Replica>
            <FilePill name="Edgelist" added={false} accent="key" onPick={none} />
            <Transport cells={ADD_COPY} state="idle" running={false} onClick={none} />
          </Replica>
          <p>
            An edge list is a CSV file with a header row and the columns source and target, one edge per row; any other
            column is ignored. Each node is named by its node_id, exactly as written in the file. Up to 10000 nodes and
            100000 edges are supported.
          </p>
          <p>
            Once your dataset is built, CHANGE in the bottom control strip shows which files it has and which it lacks,
            and adds files that join on node_id: LABELS (node_id,label), BESPOKE 2D (node_id,x,y) and BESPOKE 3D
            (node_id,x,y,z). A pane with nothing to show for want of one offers the same file under its message. Matching
            their node_id values to the edge list is up to you: a file with a node_id the edge list never names or a
            repeated node_id is refused whole, with counts, and everything else still loads. A layout must place every
            node; labels may cover only some, and the report counts the nodes left unlabeled.
          </p>
          <Replica>
            <FilePill name="Labels" added={false} accent="extra" onPick={none} />
            <FilePill name="Bespoke 2D" added={false} accent="extra" onPick={none} />
            <FilePill name="Bespoke 3D" added={false} accent="extra" onPick={none} />
          </Replica>
          <p>
            Your edge list is cleaned rather than refused, and the report says what changed: direction is ignored,
            self-loops are dropped, repeated edges are merged, and only the largest connected component is kept.
          </p>
          <p>
            Red, the colour of a hovered item, also marks whatever stopped your data loading: a refused file, a part of
            the build that failed, or a file that could not be read. Rest the pointer on a file to read its report: why
            it was refused, then what cleaning changed. Hover a file to REPLACE the edge list, or to REMOVE any other
            file.
          </p>
          <Replica>
            <FilePill name="Edgelist" added accent="key" replace onPick={none} />
            <FilePill name="Labels" added accent="extra" refused onPick={none} onRemove={none} />
          </Replica>
          <p>
            Click one of your rows to bring its CHANGE back to the bottom control strip: replacing the edge list, or
            adding or removing another file, builds it again at once. Click REMOVE in DATASET to take the row off the
            list.
          </p>
          <p>
            A curated dataset shows its download on its own row in the DATA pane; if a download fails, the row reads
            failed, and clicking it tries again. If the list of datasets can't be read, click RETRY to try the download
            again.
          </p>
          <p>
            Click EXPORT JSON in DATASET to save a finished dataset as one build file. To open it again, click + NEW and
            choose UPLOAD FROM JSON: + DATASET takes a build file saved by EXPORT and reads it at once, refusing a file
            that is not a build. Name it if you like, and click ADD to open it as a new row. The precomputed samples in
            the list are such builds of their own CSV files.
          </p>
          <Replica>
            <Action onClick={none}>Export JSON</Action>
            <FilePill name="Dataset" added={false} accent="key" onPick={none} />
            <Transport cells={ADD_COPY} state="idle" running={false} onClick={none} />
          </Replica>
        </Sec>

        {/* One line per tray, strip by strip: the leads its tip is cut from. */}
        <Sec id="strips" title="Control strips">
          <p>Rest the pointer on a tray of controls in either control strip to read what it does, in these words.</p>
          <Block title="Top control strip">
            <p>SELECTION SET chooses whether a drawn area takes NODES, EDGES or BOTH.</p>
            <p>SELECTION COUNT shows how much of the graph each set holds; hover it and click CLEAR to empty the selection set.</p>
            <p>BRUSH chooses a RECTANGLE or a LASSO as the modality for the drawn selection.</p>
            <p>EXTEND SET grows your selection by one hop with ▲; ▼ steps back, but never removes what you picked yourself.</p>
            <p>THEME: CONTRAST fades everything but the selection set, and DARK can make selections stand out more.</p>
          </Block>
          <Block title="Every pane's bottom control strip">
            <p>ZOOM: − and + zoom the pane out and in; click the % to fit the visual pattern into the pane.</p>
            <p>
              AUTO SWEEP: click RUN to animate a band across the pane, lighting what it covers in every pane. STOP ends
              the sweep, and RESUME carries on a paused sweep.
            </p>
            <p>
              SWEEP CONTROLS shape the band: VERTICAL sets its direction, AREA how much of the pane it covers, SPEED how
              fast it travels, and ARROW steps it, as the arrow keys do. They work only while a sweep is active.
            </p>
          </Block>
          <PaneBlock title="Data">
            <p>UPLOAD YOUR DATA chooses how your data comes in: BUILD FROM CSV or UPLOAD FROM JSON.</p>
            <p>
              DATASET, building from CSV: add an edge list with + EDGELIST, type a NAME if you like, and click ADD to add
              the dataset to UPLOADED and show it.
            </p>
            <p>
              DATASET, uploading from JSON: + DATASET takes a build file saved by EXPORT; type a NAME if you like, and
              click ADD to open it as a new row.
            </p>
            <p>
              DATASET, for the dataset on screen: EXPORT JSON saves a finished dataset as one build file, and REMOVE
              takes your own row off the list. While your dataset builds, STOP stops the build; the row keeps what has
              landed.
            </p>
            <p>
              CHANGE shows which files your dataset has and which it lacks; replacing the edge list, or adding or
              removing another file, builds it again at once.
            </p>
            <p>
              SHOW: turn on THUMBNAILS to see a NODELINK preview of each dataset's BESPOKE 2D layout, or else the
              default force-directed 2D, with edges only.
            </p>
            <p>ADD DATASET: click + NEW to upload your own data.</p>
          </PaneBlock>
          <PaneBlock title="Help">
            <p>SECTIONS follows the section of Help in view; pick one to go there.</p>
            <p>SHOW: turn off FIGURES to hide the diagrams and control copies, leaving the text alone.</p>
          </PaneBlock>
          <PaneBlock title="Labels">
            <p>VERTICAL ORDER BY sorts the vertical order of rows by LABELS (A–Z), DEGREE, ONION or EIGENVECTOR.</p>
          </PaneBlock>
          <PaneBlock title="NodeLink">
            <p>
              LAYOUT shows the network in a force-directed 2D or 3D, or in the dataset's own BESPOKE 2D or BESPOKE 3D,
              and INTERACTIVE starts a force-directed simulation from the current layout, where nodes can be moved by
              dragging.
            </p>
          </PaneBlock>
          <PaneBlock title="Matrix">
            <p>
              DIAGONAL ORDER BY sets the matrix seriation, or the symmetric ordering of nodes along the side of the
              matrix: H1, H2 and H3, or PC1, PC2 and PC3.
            </p>
            <p>LAYOUT shows the matrix as a DIAMOND, with the diagonal running vertically, or as the traditional SQUARE.</p>
          </PaneBlock>
          <PaneBlock title="Cores">
            <p>
              HORIZONTAL ORDER BY sets the horizontal order of connected components, by TOP-DOWN or SIZE, and GROUP
              SINGLETONS collects the singletons within each k-core shell.
            </p>
            <p>
              VERTICAL adjusts the aspect ratio of the visual pattern with SPACING, and GRIDLINES makes visible the
              vertical lines that bin component locations.
            </p>
          </PaneBlock>
          <PaneBlock title="Hops">
            <p>
              HORIZONTAL WAVE ORDER BY orders the polylines by wave shape, by DEGREE, REACH, SPREAD or SKEW; SPACING sets
              how far they move horizontally, and RANKING sets each set of equal values in one evenly spaced column.
            </p>
          </PaneBlock>
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
        <SetCountView type="node" count={121} total={484} clearable={false} onClear={none} />
      </Replica>
      <Replica tray>
        <SetCountView type="edge" count={798} total={1597} clearable={false} onClear={none} />
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

function ReplicaRow({ tray, children }: { tray?: boolean; children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(REPLICA_ZOOM);
  useLayoutEffect(() => {
    const row = rowRef.current!;
    const el = ref.current!;
    const fit = () => {
      const style = getComputedStyle(row);
      const room = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const natural = el.getBoundingClientRect().width / (Number(el.style.zoom) || REPLICA_ZOOM);
      if (natural > 0 && room > 0) setZoom(Math.min(REPLICA_ZOOM, room / natural));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={rowRef} className="help-replica-row">
      <div ref={ref} className={`help-replica${tray ? " control is-live" : ""}`} inert aria-hidden="true" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}

// A section, headed by its title.
function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
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

const PaneBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <Block title={`${title} pane`}>{children}</Block>
);

// A two-node snippet drawn as the panes draw it: the node set's nodes in
// blue, the edge set's edge in orange, a hovered node in red, the rest in the
// neutral mark ink. The hovered node is a little larger, as it reads first.
// Data colours describing data, so they may carry them.
function Mark({ kind }: { kind: "node" | "edge" | "hover" }) {
  const ink = (on: boolean, colour: string, plain: string) => `var(${on ? colour : plain})`;
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
      <circle cx="8" cy="8" r="5.5" fill={ink(kind === "node", "--node-sel", "--mark-node")} />
      <circle cx="36" cy="8" r={kind === "hover" ? 6.5 : 5.5} fill={ink(kind !== "edge", kind === "hover" ? "--hover" : "--node-sel", "--mark-node")} />
    </svg>
  );
}

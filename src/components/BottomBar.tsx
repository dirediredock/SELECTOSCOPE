import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { controlsStore, toggleFigures, toggleThumbnails } from "../state/controls";
import { focus, interfaceStore, openNew, setNewHover, setUpload, toggleHelp } from "../state/interface";
import { datasetStore, exportCsvs, exportJson } from "../state/dataset";
import { exportable } from "../data/format";
import { reportTip } from "./report";
import { UserFilePill } from "./UserFilePill";
import { useStore } from "../state/createStore";
import { slotTitle } from "../state/panes";
import type { Upload } from "../state/interface";
import type { PaneType } from "../state/panes";
import { paneRowStore } from "../state/paneRow";
import type { SlotId } from "../state/paneRow";
import { matrixIn, matrixPaneStore, setForm, setSeriation } from "../state/matrixPane";
import { CENSUS_MEASURES, FORMS, LABEL_SORTS, LAYOUTS, ORDERINGS, SERIATIONS, UPLOADS } from "../controlOptions";
import {
  setSweepArea,
  setSweepSideways,
  setSweepSpeed,
  sweepSettingsStore,
  SWEEP_AREA,
  SWEEP_SPEED,
} from "../state/sweepSettings";
import {
  pressStep,
  releaseStep,
  sweepRunStore,
  resumeSweep,
  startSweep,
  stopSweep,
} from "../state/sweepRun";
import { labelSortIn, labelsMissing, labelsPaneStore, setLabelSort } from "../state/labelsPane";
import { fitView } from "../state/fitRequests";
import { viewIn, paneViewsStore, ZOOM_STEP, zoomBy, zoomLabel } from "../state/paneViews";
import { Choice } from "./Choice";
import { Action, FilePill, HelpToggle, HoldStepper, PlayGlyph, RUN_CELLS, Section, Slider, Stepper, StopGlyph, Switch, Transport, trayTip } from "./controls";
import { HELP_SECTIONS, helpPaneStore, goToSection } from "../state/helpPane";
import { TEXT } from "../controlText";
import {
  OPTIONAL_KINDS,
  addJson,
  buildDraft,
  buildState,
  commitJsonName,
  commitName,
  datasetOf,
  draftOf,
  pickJson,
  removeRow,
  restoreJsonName,
  restoreName,
  setJsonName,
  setName,
  stopBuild,
  userDatasetsStore,
} from "../state/userDatasets";
import {
  hopsIn,
  hopsPaneStore,
  railOfSlide,
  setMeasure,
  setSlide,
  SLIDE_RAIL,
  slideFromRail,
  slideText,
  toggleRank,
} from "../state/hopsPane";
import {
  shellsIn,
  shellsPaneStore,
  BIN_SPACING,
  setOrdering,
  setBinSpacing,
  toggleGridlines,
  toggleGroup,
} from "../state/shellsPane";
import {
  layoutMissing,
  liveAllowed,
  nodelinkIn,
  nodelinkPaneStore,
  setNodeLinkLayout,
  setNodeLinkLive,
} from "../state/nodelinkPane";

// The header's zoom percent again, between − and +, which step about the
// pane's centre. A click on the percent fits all, as in the header.
function ZoomSection({ slot }: { slot: SlotId }) {
  const k = useStore(paneViewsStore, (s) => viewIn(s, slot).k);
  return (
    <Section label="Zoom" tip={TEXT.zoom.tip}>
      <Stepper
        label={TEXT.zoom.name}
        readout={zoomLabel(k)}
        onLess={() => zoomBy(slot, 1 / ZOOM_STEP)}
        onMore={() => zoomBy(slot, ZOOM_STEP)}
        onReadout={() => fitView(slot)}
        lessLabel={TEXT.zoom.out}
        moreLabel={TEXT.zoom.in}
      />
    </Section>
  );
}

// Every graph pane's last two sections. Auto Sweep, on its own white tray:
// Run, Stop or Resume (a paused sweep ends with Resume, then Stop). Sweep
// controls, on a gray tray: Vertical, on by default (down the diagonal in
// the matrix), off the band runs left to right (Labels' rows run one way, so it has none),
// the band's area (% of the axis's extent), its speed, and the Manual pill,
// whose buttons step it as the arrow keys do, drawn ◀ ▶ while the band runs
// sideways. The switch, area and speed are shared by every pane's strip. The controls live only while a sweep is
// active; idle their tray fades whole but keeps its place, so nothing in the
// strip moves on Run or Stop. While any sweep is active, every strip shows it,
// so it can be stopped from wherever the pointer last was. A pane showing a
// message in place of its pattern (`blocked`) has nothing to sweep, so Run
// is disabled there.
function SweepSection({ slot, type, blocked = false }: { slot: SlotId; type: PaneType; blocked?: boolean }) {
  const state = useStore(sweepRunStore, (s) => (s.slot === null ? "idle" : s.paused ? "paused" : "running"));
  const sideways = useStore(sweepSettingsStore, (st) => st.sideways);
  const area = useStore(sweepSettingsStore, (st) => st.area);
  const speed = useStore(sweepSettingsStore, (st) => st.speed);
  const held = useStore(sweepRunStore, (s) => s.held);
  // The pill draws the band's way: the sweeping pane's, else this one's.
  const sweeping = useStore(sweepRunStore, (s) => s.slot);
  const bandType = useStore(paneRowStore, (s) => s.slots.find((x) => x.slot === sweeping)?.type ?? type);
  const idle = state === "idle";
  return (
    <>
      <Section label="Auto Sweep" tip={idle ? TEXT.sweep.runTip : state === "running" ? TEXT.sweep.stopTip : TEXT.sweep.resumeTip} live>
        <Transport
          cells={RUN_CELLS}
          state={state}
          running={state === "running"}
          disabled={idle && blocked}
          onClick={() => (idle ? startSweep(slot) : state === "running" ? stopSweep() : resumeSweep())}
        />
      </Section>
      <Section
        label="Sweep controls"
        tip={trayTip(type === "labels" ? TEXT.sweep.controlsLabelsTip : TEXT.sweep.controlsTip, idle && TEXT.sweep.idleTip)}
        idle={idle}
      >
        <div className="veil">
          {type !== "labels" && (
            <Switch
              label="Vertical"
              on={!sideways}
              onToggle={() => setSweepSideways(!sideways)}
              disabled={idle}
            />
          )}
          <Slider label="Area" range={SWEEP_AREA} value={area} onChange={setSweepArea} disabled={idle} />
          <Slider label="Speed" range={SWEEP_SPEED} value={speed} onChange={setSweepSpeed} disabled={idle} />
          <HoldStepper
            label="Manual"
            word="Manual"
            forwardLabel={TEXT.sweep.stepForward}
            backLabel={TEXT.sweep.stepBack}
            onPress={pressStep}
            onRelease={releaseStep}
            held={held}
            disabled={idle}
            sideways={sideways && bandType !== "labels"}
          />
        </div>
      </Section>
    </>
  );
}

// The two ways' key files. Each pill is as wide as the other, so switching
// between CSV and JSON moves nothing after them.
const CSV_FILE = "Edgelist";
const JSON_FILE = "Dataset";

// Add, in the Run look: + New's way to make the row.
const ADD_CELLS = [{ id: "idle", content: <><PlayGlyph /> Add</> }] as const;

// A row's build, while it runs: Stop.
const STOP_CELLS = [{ id: "running", content: <><StopGlyph /> Stop</> }] as const;

// A dataset's title, edited in place: no field, only the caret. Enter keeps
// it, Esc drops the edit (`onRestore`, back to how it was on focus), and
// `onCommit` sends an emptied name back to its file's. `wide`: + New's,
// with room to type a name in full.
function NameField(props: {
  value: string;
  edited: boolean;
  onChange: (name: string) => void;
  onCommit: () => void;
  onRestore: (name: string, edited: boolean) => void;
  wide?: boolean;
  disabled?: boolean;
}) {
  const before = useRef({ name: "", edited: false });
  return (
    <label className={"track name-field" + (props.wide ? " is-wide" : "")}>
      <span className="name-label control-text" aria-hidden="true">
        Name
      </span>
      <input
        className="name-input control-text"
        aria-label="Name"
        value={props.value}
        spellCheck={false}
        autoComplete="off"
        disabled={props.disabled}
        onFocus={() => {
          before.current = { name: props.value, edited: props.edited };
        }}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            props.onRestore(before.current.name, before.current.edited);
            e.currentTarget.blur();
          }
        }}
        onBlur={props.onCommit}
      />
    </label>
  );
}

// A user dataset's name: a row's, or the CSV draft's.
function RowName({ id, wide }: { id: string; wide?: boolean }) {
  const name = useStore(userDatasetsStore, (s) => datasetOf(s, id)?.name ?? "");
  const edited = useStore(userDatasetsStore, (s) => datasetOf(s, id)?.nameEdited ?? false);
  return (
    <NameField
      value={name}
      edited={edited}
      onChange={(v) => setName(id, v)}
      onCommit={() => commitName(id)}
      onRestore={(v, e) => restoreName(id, v, e)}
      wide={wide}
    />
  );
}

// Build from CSV: the edge list, its name and Add, disabled until the edge
// list is in and, after a refused one, until it changes. Once the edge list is
// read the new row takes the strip over (state/userDatasets.ts handOver); the
// other files wait for its Change.
function CsvControls() {
  const id = useStore(userDatasetsStore, (s) => s.draft);
  const state = useStore(userDatasetsStore, (s) => buildState(draftOf(s), s.building === s.draft));
  const hasEdges = useStore(userDatasetsStore, (s) => !!draftOf(s).files.edgelist);
  return (
    <>
      <Section label="Dataset" tip={TEXT.dataset.csvTip}>
        <UserFilePill id={id} kind="edgelist" rebuild={false} disabled={state === "running"} sizeAs={JSON_FILE} />
        <RowName id={id} wide />
        <Transport
          cells={ADD_CELLS}
          state="idle"
          running={false}
          disabled={!hasEdges || state !== "idle"}
          onClick={buildDraft}
        />
      </Section>
    </>
  );
}

// Upload from JSON: a build file saved by Export, read on pick, so one that
// isn't a build is refused at once, in the refusal hue, why in its tip; then
// its name, and Add, which opens it as a row with no engine run.
function JsonControls() {
  const picked = useStore(userDatasetsStore, (s) => s.jsonDraft !== null);
  const refused = useStore(userDatasetsStore, (s) => s.jsonRefusal !== null);
  // As JSON, so the selector returns a plain value.
  const report = useStore(userDatasetsStore, (s) => {
    const r = s.jsonRefusal;
    const blocks = r && reportTip({ role: JSON_FILE, file: r.fileName }, { refused: [r.reason], notes: [] });
    return blocks ? JSON.stringify(blocks) : null;
  });
  const name = useStore(userDatasetsStore, (s) => s.jsonName);
  const edited = useStore(userDatasetsStore, (s) => s.jsonNameEdited);
  return (
    <>
      <Section label="Dataset" tip={TEXT.dataset.jsonTip}>
        <FilePill
          name={JSON_FILE}
          sizeAs={CSV_FILE}
          accept=".json,application/json"
          added={picked || refused}
          accent="key"
          replace
          refused={refused}
          onPick={pickJson}
          report={report}
        />
        <NameField
          value={name}
          edited={edited}
          onChange={setJsonName}
          onCommit={commitJsonName}
          onRestore={restoreJsonName}
          wide
        />
        <Transport
          cells={ADD_CELLS}
          state="idle"
          running={false}
          disabled={!picked}
          onClick={addJson}
        />
      </Section>
    </>
  );
}

// + New's strip: UPLOAD YOUR DATA, Build from CSV or Upload from JSON, one
// always chosen, then that way's Dataset tray.
function UploadControls({ upload }: { upload: Upload }) {
  return (
    <>
      <Section label="Upload your data">
        <Choice label="Upload your data" options={UPLOADS} value={upload} onPick={setUpload} />
      </Section>
      {upload === "csv" ? <CsvControls /> : <JsonControls />}
    </>
  );
}

// A row of the user's own: its files again, what it has and what it lacks.
// Replacing a CSV row's edge list, or adding or removing another file,
// builds the row again at once. A row opened from JSON or copied from a
// curated dataset has no edge list to replace: its other files go over the
// graph as it came.
function ChangeSection({ id, csv }: { id: string; csv: boolean }) {
  return (
    <Section label="Change" tip={csv ? TEXT.dataset.changeTip : TEXT.dataset.changeJsonTip}>
      {csv && <UserFilePill id={id} kind="edgelist" rebuild />}
      <RowName id={id} />
      {OPTIONAL_KINDS.map((kind) => (
        <UserFilePill key={kind} id={id} kind={kind} rebuild />
      ))}
    </Section>
  );
}

// The dataset on screen, as its row: Stop while this row's build runs (a
// build is stopped from its own row only), Export JSON and Export CSVs once
// its build is finished, and, for the user's own rows, Remove.
function DatasetSection() {
  const current = useStore(datasetStore, (s) => s.current);
  const origin = useStore(userDatasetsStore, (s) => datasetOf(s, current)?.origin ?? null);
  const building = useStore(userDatasetsStore, (s) => s.building !== null && s.building === current);
  const ready = useStore(datasetStore, (s) => !s.running && !!s.graph && exportable(s.graph));
  return (
    <Section label="Dataset" tip={trayTip(origin === null ? TEXT.dataset.curatedTip : TEXT.dataset.ownTip, building && TEXT.dataset.buildingTip)}>
      {building && <Transport cells={STOP_CELLS} state="running" running onClick={stopBuild} />}
      <Action onClick={exportJson} disabled={!ready}>
        Export JSON
      </Action>
      <Action onClick={exportCsvs} disabled={!ready}>
        Export CSVs
      </Action>
      {origin !== null && (
        <Action onClick={() => removeRow(current!)}>
          Remove
        </Action>
      )}
    </Section>
  );
}

// + New again, last in every dataset's strip: a click is a click on the + New
// row, and hovering it shows that row, gliding the list to the top
// (DataPane). A click swaps the strip for uploading, so leaving clears it.
function AddDatasetSection() {
  useEffect(() => () => setNewHover(false), []);
  return (
    <Section label="Add dataset" tip={TEXT.dataset.newTip}>
      <Action onClick={openNew} onHover={setNewHover}>
        + New
      </Action>
    </Section>
  );
}

// The Data strip serves what the Data pane has ringed. + New: uploading
// alone. A dataset: its row's actions, an own row's Change, Thumbnails, which
// turns each row into a picture of the dataset's 2D layout, then + New.
function DataControls() {
  const upload = useStore(interfaceStore, (s) => s.upload);
  const thumbnails = useStore(controlsStore, (s) => s.thumbnails);
  const current = useStore(datasetStore, (s) => s.current);
  const origin = useStore(userDatasetsStore, (s) => datasetOf(s, current)?.origin ?? null);
  if (upload) return <UploadControls upload={upload} />;
  return (
    <>
      <DatasetSection />
      {origin && <ChangeSection id={current!} csv={origin === "csv"} />}
      <Section label="Show" tip={TEXT.dataset.thumbnailsTip}>
        <Switch label="Thumbnails" on={thumbnails} onToggle={toggleThumbnails} />
      </Section>
      <AddDatasetSection />
    </>
  );
}

// Help's sections: Sections follows the scroll, and a pick glides
// the sheet to that section. Figures shows or hides its pictures, as
// Thumbnails does the list's.
function HelpControls() {
  const section = useStore(helpPaneStore, (s) => s.section);
  const figures = useStore(controlsStore, (s) => s.figures);
  return (
    <>
      <Section label={TEXT.help.sections}>
        <Choice label={TEXT.help.sections} options={HELP_SECTIONS} value={section} onPick={goToSection} />
      </Section>
      <Section label="Show" tip={TEXT.help.figuresTip}>
        <Switch label="Figures" on={figures} onToggle={toggleFigures} />
      </Section>
    </>
  );
}

// The Data slot's strip: Help's, while it shows, else the list's.
function DataSlotControls() {
  const help = useStore(interfaceStore, (s) => s.help);
  return help ? <HelpControls /> : <DataControls />;
}

// Toggles Help and hands the strip to the Data slot, so the
// sheet's Sections (or the list's controls) show at once. Focus then holds while
// the pointer is outside every pane, as ever.
export function toggleFromStrip() {
  toggleHelp();
  const dataset = paneRowStore.get().slots.find((x) => x.type === "data");
  if (dataset) focus(dataset.slot);
}

// The strip's left end, in every pane's strip: shows or hides Help
// in the Data slot, as Theme sits at the top strip's right.
export function StripHelp() {
  const on = useStore(interfaceStore, (s) => s.help);
  return (
    <HelpToggle
      on={on}
      onToggle={toggleFromStrip}
      label={TEXT.help.name}
      tip={TEXT.help.stripTip}
    />
  );
}

// The rows' order under the selected rows, which always come first.
function LabelsControls({ slot }: { slot: SlotId }) {
  const sort = useStore(labelsPaneStore, (s) => labelSortIn(s, slot));
  const g = useStore(datasetStore, (st) => st.graph);
  return (
    <>
      <Section label="Vertical order by" tip={TEXT.labels.sortTip}>
        <Choice label="Vertical order by" options={LABEL_SORTS} value={sort} onPick={(v) => setLabelSort(slot, v)} />
      </Section>
      <SweepSection slot={slot} type="labels" blocked={labelsMissing(g, sort)} />
    </>
  );
}

// The layout (2D, 3D, Bespoke 2D, Bespoke 3D) and the live simulation, which starts from
// the layout shown; while it runs, the layout waits under a veil. Every
// layout can be picked; one the dataset lacks shows a message in the pane,
// with nothing to simulate or sweep.
function NodeLinkControls({ slot }: { slot: SlotId }) {
  const s = useStore(nodelinkPaneStore, (st) => nodelinkIn(st, slot));
  const g = useStore(datasetStore, (st) => st.graph);
  // The computed layouts land after the graph: read again as they do.
  useStore(datasetStore, (st) => `${!!st.graph?.layoutFd}${!!st.graph?.layoutFd3d}`);
  const missing = layoutMissing(g, s);
  const canLive = liveAllowed(g) && !missing;
  return (
    <>
      <Section
        label="Layout"
        tip={trayTip(TEXT.nodelink.layoutTip, !liveAllowed(g) && TEXT.nodelink.tooLargeTip)}
      >
        <div className={`veil${s.live ? " is-idle" : ""}`}>
          <Choice
            label="Layout"
            options={LAYOUTS}
            value={s.layout}
            onPick={(v) => setNodeLinkLayout(slot, v)}
            disabled={s.live}
          />
        </div>
        <Switch
          label="Interactive"
          on={s.live}
          onToggle={() => setNodeLinkLive(slot, !s.live)}
          disabled={!canLive}
        />
      </Section>
      <ZoomSection slot={slot} />
      <SweepSection slot={slot} type="nodelink" blocked={missing} />
    </>
  );
}

// The seriation (node order) and the form the matrix is drawn in.
function MatrixControls({ slot }: { slot: SlotId }) {
  const s = useStore(matrixPaneStore, (st) => matrixIn(st, slot));
  return (
    <>
      <Section label="Diagonal order by" tip={TEXT.matrix.seriationTip}>
        <Choice
          label="Diagonal order by"
          options={SERIATIONS}
          value={s.seriation}
          onPick={(v) => setSeriation(slot, v)}
        />
      </Section>
      <Section label="Layout" tip={TEXT.matrix.formTip}>
        <Choice label="Layout" options={FORMS} value={s.form} onPick={(v) => setForm(slot, v)} />
      </Section>
      <ZoomSection slot={slot} />
      <SweepSection slot={slot} type="matrix" />
    </>
  );
}

// Horizontal order by: the bins' order and the singleton group, both of which glide the nodes.
// Vertical: how the pattern is drawn, its width at 100% zoom (% of the room
// between the axis labels) and the hairlines between bins.
function ShellsControls({ slot }: { slot: SlotId }) {
  const s = useStore(shellsPaneStore, (st) => shellsIn(st, slot));
  return (
    <>
      <Section label="Horizontal order by" tip={TEXT.ksnakes.orderingTip}>
        <Choice label="Horizontal order by" options={ORDERINGS} value={s.ordering} onPick={(v) => setOrdering(slot, v)} />
        <Switch
          label="Group singletons"
          on={s.group}
          onToggle={() => toggleGroup(slot)}
        />
      </Section>
      <Section label="Vertical" tip={TEXT.ksnakes.verticalTip}>
        <Slider
          label="Spacing"
          range={BIN_SPACING}
          value={s.spacing}
          onChange={(v) => setBinSpacing(slot, v)}
        />
        <Switch
          label="Gridlines"
          on={s.gridlines}
          onToggle={() => toggleGridlines(slot)}
        />
      </Section>
      <ZoomSection slot={slot} />
      <SweepSection slot={slot} type="shells" />
    </>
  );
}

// Horizontal order by shape: the measure that orders the lines sideways,
// whether they are spaced by rank or by its value (Ranking), and how far they
// slide (Spacing, multiples of a bin's side, on a squared rail).
function HopsControls({ slot }: { slot: SlotId }) {
  const s = useStore(hopsPaneStore, (st) => hopsIn(st, slot));
  return (
    <>
      <Section label="Horizontal order by shape" tip={TEXT.hopcensus.measureTip}>
        <Choice
          label="Horizontal order by shape"
          options={CENSUS_MEASURES}
          value={s.measure}
          onPick={(v) => setMeasure(slot, v)}
        />
        <Slider
          label="Spacing"
          range={SLIDE_RAIL}
          value={railOfSlide(s.slide)}
          readout={slideText(s.slide)}
          onChange={(r) => setSlide(slot, slideFromRail(r))}
        />
        <Switch label="Ranking" on={s.rank} onToggle={() => toggleRank(slot)} />
      </Section>
      <ZoomSection slot={slot} />
      <SweepSection slot={slot} type="hops" />
    </>
  );
}

const CONTROLS: Partial<Record<PaneType, (slot: SlotId) => ReactNode>> = {
  data: () => <DataSlotControls />,
  labels: (slot) => <LabelsControls slot={slot} />,
  nodelink: (slot) => <NodeLinkControls slot={slot} />,
  matrix: (slot) => <MatrixControls slot={slot} />,
  shells: (slot) => <ShellsControls slot={slot} />,
  hops: (slot) => <HopsControls slot={slot} />,
};

// Contextual strip: shows the focused pane's controls, with its title at the
// far right. Keyed by slot, so two panes of one type each show their own
// settings. Help's ? at the far left balances the title, so the
// controls stay centred.
export function BottomBar() {
  const shown = useStore(interfaceStore, (s) => s.focused);
  const type = useStore(paneRowStore, (s) => (shown ? s.slots.find((x) => x.slot === shown)!.type : null));
  const title = useStore(interfaceStore, (s) => (type ? slotTitle(type, s.help) : ""));
  const titleId = useId();
  return (
    <footer className="bottombar" aria-labelledby={shown && type ? titleId : undefined}>
      <div className="strip-help">
        <StripHelp />
      </div>
      {shown && type ? (
        <>
          <div key={shown} className="strip-sections">
            {CONTROLS[type]?.(shown) ?? <span className="placeholder">no controls yet</span>}
          </div>
          <span id={titleId} className="strip-label">
            {title}
          </span>
        </>
      ) : (
        <span className="placeholder">Point at a pane</span>
      )}
    </footer>
  );
}

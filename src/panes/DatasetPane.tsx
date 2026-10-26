import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { data, initData, loadDataset } from "../data/dataStore";
import type { DatasetEntry } from "../data/dataStore";
import { exportable } from "../data/format";
import { stopBuild } from "../engine/engine";
import { useStore } from "../state/createStore";
import type { SlotId } from "../state/layout";
import { openNew, setUpload, ui } from "../state/uiStore";
import { datasetAlert, pickRow, userData } from "../state/userData";
import type { UserDataset } from "../state/userData";
import { LIST_ROWS, VirtualList } from "../components/VirtualList";
import { Action, AlertDot, Rail } from "../components/controls";
import { attachListPan } from "../interaction/listPan";
import { DatasetTile } from "./dataset/DatasetTile";
import { CURATED_INTRO, INTRO } from "./dataset/intros";
import { scaled } from "../uiScale";
import { DATA_TOOLTIPS } from "../controlText";

type Row =
  | { group: string; spaced?: boolean }
  | { intro: string }
  | { fresh: true }
  | { user: UserDataset }
  | { entry: DatasetEntry }
  | { listFailed: true };

const USER_GROUP = "Uploaded";

// The row that opens uploading.
const NEW_TITLE = "+ New";

// A tile's picture sits this far inside its card, at the top and sides; the
// caption under it is a little taller than a pill row, to clear the rounded
// corners (styles.css, .tile-caption).
const TILE_INSET = scaled(10);
const TILE_CAPTION = LIST_ROWS.rowHeight + scaled(8);

// The air above a group header, dividing it from the group before, and the
// extra gap between its label and its first row (styles.css, .list-group).
const GROUP_AIR = scaled(16);
const GROUP_GAP = scaled(6);

// The curated groups' first header takes this much more air again, so the
// samples stand apart from Uploaded by space alone.
const SAMPLES_AIR = scaled(24);

// Uploaded first: what uploading is for, + New, then the user's rows, newest
// first.
// Then the curated datasets in index order, with a header row wherever the
// group changes, the first set off from Uploaded by more air and followed by
// what the curated datasets are. If the list itself couldn't be read, one row
// says so in their place, with Retry.
function listRows(entries: DatasetEntry[], users: UserDataset[], listFailed: boolean): Row[] {
  const rows: Row[] = [{ group: USER_GROUP }, { intro: INTRO }, { fresh: true }, ...users.map((user) => ({ user }))];
  if (listFailed) rows.push({ listFailed: true });
  entries.forEach((entry, i) => {
    if (i === 0 || entry.group !== entries[i - 1]!.group) rows.push({ group: entry.group, spaced: i === 0 });
    if (i === 0) rows.push({ intro: CURATED_INTRO });
    rows.push({ entry });
  });
  return rows;
}

// An intro wraps with the pane's width, so it reports its own height, for
// VirtualList to place the rows under it.
function Intro({ text, onHeight }: { text: string; onHeight: (text: string, h: number) => void }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => onHeight(text, el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, onHeight]);
  return (
    <p ref={ref} className="list-intro">
      {text}
    </p>
  );
}

// The zeroth pane: picks the dataset. Rows are the Labels pane's pills, kept
// neutral: picking a dataset is not a data selection, so the rows answer the
// pointer whether or not the pane is focused. Each group opens with a plain
// header row set off by air above it, like the section headings of a sidebar.
//   click   a dataset: show it (a fresh start that clears both sets), and
//           hand the strip its controls
//   drag    scroll (interaction/listPan.ts)
// The pointer entering it focuses it, for the strip's controls.
// Uploaded heads the list: a sentence on what uploading is for, then + New,
// which loads nothing but takes the ring and hands the strip to UPLOAD YOUR
// DATA (the dataset on screen gives the ring back when a dataset is
// clicked; as a tile, a dashed blob holds the thumbnail's place), then a row
// per dataset the user made this session, reading "building" while its build runs, its counts once built,
// or "stopped" if its build was cut short (a click builds it again). A dot
// in the refusal hue marks a row whose loading something stopped. A curated
// row shows its own download: a rail in place of its counts while it comes,
// and "failed" with the dot if it didn't (a click tries again).
// Thumbnails turns each dataset row into a tile the pane's width, a picture
// of the dataset's 2D layout over its title; an uploaded one's fills in once
// its layout lands. The curated groups' first header opens with a sentence on
// what they are. A curated row's tooltip says what its nodes and edges are,
// and cites where they came from (docs/tooltips_data.txt).
// The strip's + New stands for the + New row: hovering it glides the list to
// the top with that row hovered, and leaving glides back to the ringed row.
// When another pane takes focus the list glides the ringed row to its middle.
// A resize keeps whatever is at the list's middle there, focused or not.
export function DatasetPane({ slot }: { slot: SlotId }) {
  const focused = useStore(ui, (s) => s.focused === slot);
  const index = useStore(data, (s) => s.index);
  // Ringed: the dataset on screen, curated or the user's.
  const shown = useStore(data, (s) => s.current);
  // + New holds the ring while the strip serves it, and the dataset on
  // screen holds it otherwise.
  const uploading = useStore(ui, (s) => s.upload !== null);
  const current = uploading ? null : shown;
  const datasets = useStore(userData, (s) => s.datasets);
  const building = useStore(userData, (s) => s.building);
  const thumbnails = useStore(ui, (s) => s.thumbnails);
  const newHover = useStore(ui, (s) => s.newHover);
  // The curated build downloading or failed, its share received, and
  // whether the dataset list itself failed.
  const requested = useStore(data, (s) => s.requested);
  const downloading = useStore(data, (s) => s.loading);
  const received = useStore(data, (s) => s.progress);
  const loadFailed = useStore(data, (s) => s.loadError !== null);
  const listFailed = useStore(data, (s) => s.loadError !== null && s.index === null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // The list's inner width, which sets a tile's size.
  const [width, setWidth] = useState(0);
  // Each intro's height, by its text, as it last measured; a guess until it
  // mounts.
  const [introHeights, setIntroHeights] = useState<Record<string, number>>({});
  const setIntroHeight = useCallback(
    (text: string, h: number) => setIntroHeights((hs) => (hs[text] === h ? hs : { ...hs, [text]: h })),
    [],
  );
  const users = useMemo(() => datasets.filter((d) => d.graph !== null), [datasets]);
  const rows = useMemo(() => listRows(index ?? [], users, listFailed), [index, users, listFailed]);
  const ringedRow = useMemo(
    () =>
      rows.findIndex(
        (r) => ("fresh" in r && uploading) || ("user" in r && r.user.id === current) || ("entry" in r && r.entry.name === current),
      ),
    [rows, current, uploading],
  );
  // Each new object scrolls VirtualList to its row.
  const [reveal, setReveal] = useState<{ row: number; smooth?: boolean }>();
  // A new row of the user's reveals it, as a new look does the ringed one.
  const revealKey = `${thumbnails}:${users.length}`;
  const revealedKey = useRef<string | null>(null);

  useEffect(() => attachListPan(scrollerRef.current!, { plainDrag: true }), []);

  useLayoutEffect(() => {
    const el = scrollerRef.current!;
    const measure = () => setWidth(el.clientWidth - LIST_ROWS.pad - LIST_ROWS.padEnd);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Open with the ringed dataset in view (Finder reveals the selection), and
  // again when Thumbnails changes the rows or a new row lists; the top if it
  // isn't listed.
  useEffect(() => {
    if (revealedKey.current === revealKey || !shown || !index) return;
    revealedKey.current = revealKey;
    setReveal({ row: Math.max(0, ringedRow) });
  }, [shown, index, revealKey, ringedRow]);

  // Leaving for another pane glides the ringed row to the middle. Not on
  // mount: the opening reveal above already centres it.
  const wasFocused = useRef(focused);
  useEffect(() => {
    if (wasFocused.current && !focused && ringedRow >= 0) setReveal({ row: ringedRow, smooth: true });
    wasFocused.current = focused;
  }, [focused, ringedRow]);

  // + New giving the ring back from elsewhere (a selection in another pane)
  // glides to the dataset on screen. Not while focused: a click in the list
  // already has its row in view.
  const wasUploading = useRef(uploading);
  useEffect(() => {
    if (wasUploading.current && !uploading && !focused && ringedRow >= 0) setReveal({ row: ringedRow, smooth: true });
    wasUploading.current = uploading;
  }, [uploading, focused, ringedRow]);

  // The strip's + New: to the top while hovered, back to the ringed row after.
  const wasNewHover = useRef(newHover);
  useEffect(() => {
    if (newHover === wasNewHover.current) return;
    wasNewHover.current = newHover;
    if (newHover) setReveal({ row: 0, smooth: true });
    else if (ringedRow >= 0) setReveal({ row: ringedRow, smooth: true });
  }, [newHover, ringedRow]);

  const picture = Math.max(0, width - 2 * TILE_INSET);
  const rowHeightOf = useCallback(
    (i: number) => {
      const row = rows[i]!;
      if ("group" in row) return LIST_ROWS.rowHeight + GROUP_GAP + (i === 0 ? 0 : GROUP_AIR) + (row.spaced ? SAMPLES_AIR : 0);
      if ("intro" in row) return introHeights[row.intro] ?? 3 * LIST_ROWS.rowHeight;
      if ("listFailed" in row) return LIST_ROWS.rowHeight;
      return thumbnails ? TILE_INSET + picture + TILE_CAPTION : LIST_ROWS.rowHeight;
    },
    [rows, picture, thumbnails, introHeights],
  );

  return (
    <VirtualList
      rowCount={rows.length}
      geometry={LIST_ROWS}
      scrollerRef={scrollerRef}
      reveal={reveal}
      rowHeightOf={rowHeightOf}
      renderRow={(i) => {
        const row = rows[i]!;
        if ("group" in row) return <div className="list-group">{row.group}</div>;
        if ("intro" in row) return <Intro text={row.intro} onHeight={setIntroHeight} />;
        if ("listFailed" in row)
          return (
            <div className="list-row list-failed">
              <span className="list-text">
                <AlertDot />
                Could not load the dataset list
              </span>
              <Action small onClick={() => initData(stopBuild)}>
                Retry
              </Action>
            </div>
          );
        if ("fresh" in row) {
          if (thumbnails)
            return (
              <DatasetTile thumb={null} blob title={NEW_TITLE} meta="" current={uploading} hover={newHover} onClick={openNew} size={picture} />
            );
          return (
            <button
              type="button"
              className={"list-row is-dataset" + (uploading ? " is-current" : "") + (newHover ? " is-hover" : "")}
              aria-current={uploading || undefined}
              onClick={openNew}
            >
              <span className="list-text">{NEW_TITLE}</span>
            </button>
          );
        }
        const item =
          "user" in row
            ? {
                thumb: null,
                graph: row.user.graph,
                title: row.user.name,
                meta:
                  building === row.user.id
                    ? "building"
                    : exportable(row.user.graph!)
                      ? `${row.user.graph!.n} / ${row.user.graph!.m}`
                      : "stopped",
                alert: datasetAlert(row.user),
                tip: undefined,
                current: row.user.id === current,
                onClick: () => pickRow(row.user.id),
              }
            : {
                thumb: row.entry.name,
                graph: null,
                title: row.entry.title,
                meta:
                  row.entry.name !== requested ? (
                    `${row.entry.nodes} / ${row.entry.edges}`
                  ) : downloading ? (
                    <Rail share={received} />
                  ) : loadFailed ? (
                    "failed"
                  ) : (
                    `${row.entry.nodes} / ${row.entry.edges}`
                  ),
                alert: row.entry.name === requested && !downloading && loadFailed,
                tip: DATA_TOOLTIPS.get(row.entry.name),
                current: row.entry.name === current,
                onClick: () => {
                  setUpload(null);
                  loadDataset(row.entry.name, stopBuild);
                },
              };
        if (thumbnails) return <DatasetTile {...item} size={picture} />;
        return (
          <button
            type="button"
            className={"list-row is-dataset" + (item.current ? " is-current" : "")}
            aria-current={item.current || undefined}
            data-tip={item.tip}
            data-tip-wide={item.tip ? "" : undefined}
            data-tip-side={item.tip ? "right" : undefined}
            onClick={item.onClick}
          >
            <span className="list-text">{item.title}</span>
            <span className="list-meta">
              {item.alert && <AlertDot />}
              {item.meta}
            </span>
          </button>
        );
      }}
    />
  );
}

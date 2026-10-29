import { useSyncExternalStore } from "react";
import type { Store } from "../state/createStore";
import type { PaneType } from "../state/panes";
import type { SlotId } from "../state/paneRow";
import { CENSUS_MEASURES, LABEL_SORTS, LAYOUTS, ORDERINGS, SERIATIONS } from "../controlOptions";
import { labelSortOf, labelsPaneStore } from "../state/labelsPane";
import type { LabelSort } from "../state/labelsPane";
import { nodelinkOf, nodelinkPaneStore } from "../state/nodelinkPane";
import type { NodeLinkSettings } from "../state/nodelinkPane";
import { matrixOf, matrixPaneStore } from "../state/matrixPane";
import type { MatrixSettings } from "../state/matrixPane";
import { shellsOf, shellsPaneStore } from "../state/shellsPane";
import type { ShellsSettings } from "../state/shellsPane";
import { hopsOf, hopsPaneStore } from "../state/hopsPane";
import type { HopsSettings } from "../state/hopsPane";
import { STAGE_NAMES, datasetStore, waitStage } from "../state/dataset";
import type { Stage } from "../state/dataset";
import { useStore } from "../state/createStore";

// The subtitle beside a pane's title: what the pane's strip has chosen,
// in the strip's own words, so every header says what it shows even when
// another pane holds the strip. A readout only. A setting at its default that
// changes little (Shells' singletons apart, the matrix's
// diamond, Spacing 0) adds nothing.

const labelOf = <T extends { id: string; label: string }>(options: readonly T[], id: string) =>
  options.find((o) => o.id === id)!.label;

// The sort's name alone, so it fits Labels at its Minimum.
export const labelsSubtitle = (sort: LabelSort) => labelOf(LABEL_SORTS, sort);

// The layout, and while Interactive is on the layout it started from.
export const nodelinkSubtitle = ({ layout, live }: Pick<NodeLinkSettings, "layout" | "live">) =>
  live ? `Interactive from ${labelOf(LAYOUTS, layout)}` : labelOf(LAYOUTS, layout);

export const matrixSubtitle = ({ seriation, form }: MatrixSettings) =>
  labelOf(SERIATIONS, seriation) + (form === "square" ? ", square" : "");

export const shellsSubtitle = ({ ordering, group }: Pick<ShellsSettings, "ordering" | "group">) =>
  labelOf(ORDERINGS, ordering) + (group ? ", grouped" : "");

// The shape order, as its measure's similarity, and Ranking while it is on,
// even at Spacing 0, where the lines don't slide but the sweep still follows
// the order.
export const hopsSubtitle = ({ measure, rank }: Pick<HopsSettings, "measure" | "rank">) =>
  labelOf(CENSUS_MEASURES, measure) + " similarity" + (rank ? ", ranked" : "");

export function paneSubtitle(type: PaneType, slot: SlotId): string | null {
  switch (type) {
    case "labels":
      return labelsSubtitle(labelSortOf(slot));
    case "nodelink":
      return nodelinkSubtitle(nodelinkOf(slot));
    case "matrix":
      return matrixSubtitle(matrixOf(slot));
    case "shells":
      return shellsSubtitle(shellsOf(slot));
    case "hops":
      return hopsSubtitle(hopsOf(slot));
    case "data":
      return null;
  }
}

const STORES: Record<PaneType, Store<object> | null> = {
  data: null,
  labels: labelsPaneStore,
  nodelink: nodelinkPaneStore,
  matrix: matrixPaneStore,
  shells: shellsPaneStore,
  hops: hopsPaneStore,
};

const never = () => () => {};

// The snapshot is a string, so the header renders again only when the text
// changes, not on every rotation or Interactive tick.
// The stages a pane's pattern waits on, as its settings stand.
function stagesOf(type: PaneType, slot: SlotId): Stage[] {
  switch (type) {
    case "labels": {
      const sort = labelSortOf(slot);
      return sort === "onion" ? ["shells"] : [];
    }
    case "nodelink": {
      const { layout, live } = nodelinkOf(slot);
      return live || layout === "fd" ? ["harmonics", "fd2d"] : layout === "fd3d" ? ["fd3d"] : [];
    }
    case "matrix":
      return [matrixOf(slot).seriation.startsWith("pc") ? "components" : "harmonics"];
    case "shells":
      return ["shells"];
    case "hops":
      return ["hops"];
    case "data":
      return [];
  }
}

// What the strip has chosen, or, while the stage the pane draws from runs,
// that stage's name.
export function usePaneSubtitle(slot: SlotId, type: PaneType): string | null {
  const store = STORES[type];
  const chosen = useSyncExternalStore(store ? store.subscribe : never, () => paneSubtitle(type, slot));
  const stages = useSyncExternalStore(store ? store.subscribe : never, () => stagesOf(type, slot).join(","));
  const waiting = useStore(datasetStore, (s) => {
    const stage = s.graph && stages ? waitStage(s, stages.split(",") as Stage[]) : null;
    return stage && s.stages[stage].status === "running" ? STAGE_NAMES[stage] : null;
  });
  return waiting ?? chosen;
}

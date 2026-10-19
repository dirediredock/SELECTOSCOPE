import { useSyncExternalStore } from "react";
import type { Store } from "../state/createStore";
import type { PaneType } from "../state/panes";
import type { SlotId } from "../state/layout";
import { CENSUS_MEASURES, LABEL_SORTS, LAYOUTS, ORDERINGS, SERIATIONS } from "../controlOptions";
import { labelSortOf, labelsSettings } from "../state/labels";
import type { LabelSort } from "../state/labels";
import { nodelinkOf, nodelinkSettings } from "../state/nodelink";
import type { NodeLinkSettings } from "../state/nodelink";
import { matrixOf, matrixSettings } from "../state/matrix";
import type { MatrixSettings } from "../state/matrix";
import { ksnakesOf, ksnakesSettings } from "../state/ksnakes";
import type { KSnakesSettings } from "../state/ksnakes";
import { hopcensusOf, hopcensusSettings } from "../state/hopcensus";
import type { HopCensusSettings } from "../state/hopcensus";
import { STAGE_NAMES, data, waitStage } from "../data/dataStore";
import type { Stage } from "../data/dataStore";
import { useStore } from "../state/createStore";

// The subtitle beside a pane's title: what the pane's strip has chosen,
// in the strip's own words, so every header says what it shows even when
// another pane holds the strip. A readout only. A setting at its default that
// changes little (Cores' singletons apart, the matrix's
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

export const ksnakesSubtitle = ({ ordering, group }: Pick<KSnakesSettings, "ordering" | "group">) =>
  labelOf(ORDERINGS, ordering) + (group ? ", grouped" : "");

// The wave order, and Ranking while it is on, even at Spacing 0, where
// the lines don't slide but the sweep still follows the order.
export const hopcensusSubtitle = ({ measure, rank }: Pick<HopCensusSettings, "measure" | "rank">) =>
  "Wave " + labelOf(CENSUS_MEASURES, measure).toLowerCase() + (rank ? ", ranked" : "");

export function paneSubtitle(type: PaneType, slot: SlotId): string | null {
  switch (type) {
    case "labels":
      return labelsSubtitle(labelSortOf(slot));
    case "nodelink":
      return nodelinkSubtitle(nodelinkOf(slot));
    case "matrix":
      return matrixSubtitle(matrixOf(slot));
    case "ksnakes":
      return ksnakesSubtitle(ksnakesOf(slot));
    case "hopcensus":
      return hopcensusSubtitle(hopcensusOf(slot));
    case "dataset":
      return null;
  }
}

const STORES: Record<PaneType, Store<object> | null> = {
  dataset: null,
  labels: labelsSettings,
  nodelink: nodelinkSettings,
  matrix: matrixSettings,
  ksnakes: ksnakesSettings,
  hopcensus: hopcensusSettings,
};

const never = () => () => {};

// The snapshot is a string, so the header renders again only when the text
// changes, not on every rotation or Interactive tick.
// The stages a pane's pattern waits on, as its settings stand.
function stagesOf(type: PaneType, slot: SlotId): Stage[] {
  switch (type) {
    case "labels": {
      const sort = labelSortOf(slot);
      return sort === "onion" ? ["basics"] : sort === "eigenvector" ? ["centrality"] : [];
    }
    case "nodelink": {
      const { layout, live } = nodelinkOf(slot);
      return live || layout === "fd" ? ["harmonics", "fd2d"] : layout === "fd3d" ? ["fd3d"] : [];
    }
    case "matrix":
      return [matrixOf(slot).seriation.startsWith("pc") ? "components" : "harmonics"];
    case "ksnakes":
      return ["basics"];
    case "hopcensus":
      return ["hops"];
    case "dataset":
      return [];
  }
}

// What the strip has chosen, or, while the stage the pane draws from runs,
// that stage's name.
export function usePaneSubtitle(slot: SlotId, type: PaneType): string | null {
  const store = STORES[type];
  const chosen = useSyncExternalStore(store ? store.subscribe : never, () => paneSubtitle(type, slot));
  const stages = useSyncExternalStore(store ? store.subscribe : never, () => stagesOf(type, slot).join(","));
  const waiting = useStore(data, (s) => {
    const stage = s.graph && stages ? waitStage(s, stages.split(",") as Stage[]) : null;
    return stage && s.stages[stage].status === "running" ? STAGE_NAMES[stage] : null;
  });
  return waiting ?? chosen;
}

import type { ReactNode } from "react";
import { Action, Rail } from "./controls";
import { STAGE_NAMES, datasetStore, stageShare, waitStage } from "../data/datasetStore";
import type { Stage } from "../data/datasetStore";
import { useStore } from "../state/createStore";

// A pane's content in place of its pattern: a note on what is missing, or,
// while the engine computes what the pane draws, that stage's rail. It
// sits outside the drawn pattern, so Contrast never fades it. `children`,
// under the note, are the way to fill the gap (an uploaded row's file pill),
// taking clicks though the message layer doesn't.
export function PaneMessage({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="pane-message" role="status">
      <p>{text}</p>
      {children && <div className="pane-message-act">{children}</div>}
    </div>
  );
}

// A message that is also the way to fill the gap: an Action in its place,
// taking clicks though the message layer doesn't.
export function PaneAction({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <div className="pane-message" role="status">
      <span style={{ pointerEvents: "auto" }}>
        <Action onClick={onClick}>{text}</Action>
      </span>
    </div>
  );
}

// How far along, as the Data row's rail, in the pane's centre.
function PaneRail({ share }: { share: number | null }) {
  return (
    <div className="pane-message" role="status">
      <Rail share={share} />
    </div>
  );
}

// The first of `stages` not yet done, as its rail, or a note if it failed;
// nothing once all are done or before there is a graph.
export function WaitingOn({ stages }: { stages: readonly Stage[] }) {
  const stage = useStore(datasetStore, (s) => (s.graph ? waitStage(s, stages) : null));
  const share = useStore(datasetStore, (s) => stageShare(s, stage));
  const failed = useStore(datasetStore, (s) => stage !== null && s.stages[stage].status === "failed");
  if (!stage) return null;
  return failed ? <PaneMessage text={`${STAGE_NAMES[stage]} failed.`} /> : <PaneRail share={share} />;
}

// A picked curated dataset downloading, as its Data row's rail, in every
// other pane while there is no graph yet. The list's own fetch shows none.
export function DownloadRail() {
  const downloading = useStore(datasetStore, (s) => s.loading && s.requested !== null);
  const share = useStore(datasetStore, (s) => s.progress);
  return downloading ? <PaneRail share={share} /> : null;
}

import type { ReactNode } from "react";
import { Action, Progress } from "./controls";
import { STAGE_NAMES, data, stageShare, waitStage } from "../data/dataStore";
import type { Stage } from "../data/dataStore";
import { useStore } from "../state/createStore";

// A pane's content in place of its pattern: a note on what is missing, or,
// while the engine computes what the pane draws, that stage's progress. It
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

export function StageProgress({ label, share }: { label: string; share: number | null }) {
  return (
    <div className="pane-message" role="status">
      <Progress label={label} share={share} />
    </div>
  );
}

// The first of `stages` not yet done, as StageProgress, or a note if it
// failed; nothing once all are done or before there is a graph.
export function WaitingOn({ stages }: { stages: readonly Stage[] }) {
  const stage = useStore(data, (s) => (s.graph ? waitStage(s, stages) : null));
  const share = useStore(data, (s) => stageShare(s, stage));
  const failed = useStore(data, (s) => stage !== null && s.stages[stage].status === "failed");
  if (!stage) return null;
  return failed ? <PaneMessage text={`${STAGE_NAMES[stage]} failed.`} /> : <StageProgress label={STAGE_NAMES[stage]} share={share} />;
}

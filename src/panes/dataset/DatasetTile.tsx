import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { readInk } from "../../canvas/ink";
import { sizeCanvas } from "../../canvas/sizeCanvas";
import { useStore } from "../../state/createStore";
import { ui } from "../../state/uiStore";
import { data } from "../../data/dataStore";
import type { Graph } from "../../data/graph";
import { AlertDot } from "../../components/controls";
import { drawThumb, fetchThumb, thumbOf } from "./thumb";
import type { Thumb } from "./thumb";
import { blobPath } from "./blob";

// The Data pane's row as a tile: the dataset's 2D layout, edges only, over
// the row's own caption (title | node / edge counts). Behaves as a row does: a click
// loads, the loaded tile is ringed, the hover ring shows. Only tiles in view
// are mounted, so only they fetch and draw. A curated dataset's thumbnail is
// a file (`thumb`, its name); an uploaded one's is made from its graph
// (`graph`), and its square stays empty until FD 2D lands, then fills.
// `blob`: + New's tile, a dashed outline where a thumbnail will go.
export function DatasetTile(props: {
  thumb: string | null;
  graph?: Graph | null;
  blob?: boolean;
  title: string;
  meta: ReactNode;
  current: boolean;
  // Shown as hovered from elsewhere: the strip's + New.
  hover?: boolean;
  // The refusal hue's dot before the counts.
  alert?: boolean;
  onClick?: () => void;
  size: number;
}) {
  const { thumb: name, graph = null, current, size } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useStore(ui, (s) => s.theme);
  // A graph's layouts land in place: its tile reads again on each revision.
  const revision = useStore(data, (s) => (graph ? s.revision : 0));

  useEffect(() => {
    let live = true;
    const draw = (thumb: Thumb) => {
      const canvas = canvasRef.current;
      if (!live || !canvas) return;
      const { ctx, w } = sizeCanvas(canvas);
      drawThumb(ctx, thumb, w, readInk(canvas).thumbEdge);
    };
    if (graph) {
      // Rebuilt, a row's new graph starts empty again.
      const thumb = thumbOf(graph);
      if (thumb) draw(thumb);
      else if (canvasRef.current) sizeCanvas(canvasRef.current);
    } else if (name !== null) {
      // A missing thumbnail leaves the square empty; the title still picks.
      fetchThumb(name).then(draw, () => {});
    }
    return () => {
      live = false;
    };
  }, [name, graph, revision, size, theme]);

  return (
    <button
      type="button"
      className={"list-row is-dataset is-tile" + (current ? " is-current" : "") + (props.hover ? " is-hover" : "")}
      aria-current={current || undefined}
      onClick={props.onClick}
    >
      {props.blob ? (
        <Blob size={size} />
      ) : (
        <canvas ref={canvasRef} className="tile-picture" style={{ width: size, height: size }} aria-hidden />
      )}
      <span className="tile-caption">
        <span className="list-text">{props.title}</span>
        <span className="list-meta">
          {props.alert && <AlertDot />}
          {props.meta}
        </span>
      </span>
    </button>
  );
}

// One blob per page load (blob.ts), the same on every redraw.
const BLOB = blobPath(Math.random);

function Blob({ size }: { size: number }) {
  return (
    <svg className="tile-picture tile-blob" viewBox="0 0 100 100" style={{ width: size, height: size }} aria-hidden>
      <path d={BLOB} />
    </svg>
  );
}

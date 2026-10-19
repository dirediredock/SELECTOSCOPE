import { useEffect, useRef, useState } from "react";
import type { Graph } from "../data/graph";

// How long a pane's pattern takes to fade in (styles.css, .is-landing).
const FADE_MS = 300;

// " is-landing" for a moment after the pane first has something to draw for
// this graph (`ready`), so its pattern fades in as it lands rather than
// popping. Once per graph: a new dataset, or a row built again, fades again.
// Why only the first time: a pattern that changes after (a new order, a
// streamed line) glides or grows on its own.
export function useFadeIn(graph: Graph | null, ready: boolean): string {
  const shown = useRef<Graph | null>(null);
  const [landing, setLanding] = useState(false);
  useEffect(() => {
    if (!graph || !ready || shown.current === graph) return;
    shown.current = graph;
    setLanding(true);
    const t = setTimeout(() => setLanding(false), FADE_MS);
    return () => {
      clearTimeout(t);
      setLanding(false);
    };
  }, [graph, ready]);
  return landing ? " is-landing" : "";
}

import { useStore } from "../state/createStore";
import { addFile, datasetOf, fileRefused, removeFile, userData } from "../state/userData";
import type { FileKind } from "../state/userData";
import { TEXT } from "../controlText";
import { FilePill } from "./controls";
import { ROLE_NAMES, fileLines, reportTip } from "./report";

// One file's pill: its picker while missing; once added, the edge list's
// Replace (it carries the others, so it is never removed) or another file's
// Remove; in the refusal hue while refused. Its tip carries the file's report
// once a build has read it. `rebuild`: a row's pills, in its Change tray or
// under a pane's message, build the row again at once.
export function UserFilePill(props: { id: string; kind: FileKind; rebuild: boolean; disabled?: boolean; sizeAs?: string }) {
  const { id, kind, rebuild } = props;
  const file = useStore(userData, (s) => datasetOf(s, id)?.files[kind] ?? null);
  const refused = useStore(userData, (s) => {
    const d = datasetOf(s, id);
    return !!d && fileRefused(d, kind);
  });
  const title = file ? (kind === "edgelist" ? TEXT.dataset.replaceTip : TEXT.dataset.removeFileTip) : undefined;
  // As JSON, so the selector returns a plain value.
  const report = useStore(userData, (s) => {
    const d = datasetOf(s, id);
    const f = d?.files[kind];
    if (!d || !f) return null;
    // The graph only while it was read from these files.
    const graph = d.builtVersion === d.version ? d.graph : null;
    const refusal = kind === "edgelist" && fileRefused(d, kind) ? d.refusal : null;
    const counts = kind === "edgelist" && graph ? `${graph.n} / ${graph.m}` : null;
    const blocks = reportTip({ role: ROLE_NAMES[kind], file: f.fileName, counts }, fileLines(kind, graph, refusal), title);
    return blocks && JSON.stringify(blocks);
  });
  return (
    <FilePill
      name={ROLE_NAMES[kind]}
      added={file !== null}
      accent={kind === "edgelist" ? "key" : "extra"}
      replace={kind === "edgelist"}
      refused={refused}
      onPick={(f) => addFile(id, kind, f, rebuild)}
      onRemove={kind === "edgelist" ? undefined : () => removeFile(id, kind, rebuild)}
      title={title}
      report={report}
      disabled={props.disabled}
      sizeAs={props.sizeAs}
    />
  );
}

// The CSV row on screen, if the dataset on screen is one: the panes offer
// its missing files under their messages.
export function useCsvRow(current: string | null): string | null {
  return useStore(userData, (s) => (datasetOf(s, current)?.origin === "csv" ? current : null));
}

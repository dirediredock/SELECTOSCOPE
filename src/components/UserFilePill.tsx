import { datasetStore } from "../data/datasetStore";
import { useStore } from "../state/createStore";
import { addFile, copyCurated, datasetOf, fileRefused, removeFile, userDatasetsStore } from "../state/userDatasets";
import type { FileKind, OptionalKind } from "../state/userDatasets";
import { FilePill } from "./controls";
import { ROLE_NAMES, fileLines, reportTip } from "./report";

// One file's pill: its picker while missing; once added, the edge list's
// Replace (it carries the others, so it is never removed) or another file's
// Remove; in the refusal hue while refused. Its tip is the file's report
// once a build has read it, and none before. `rebuild`: a row's pills, in its Change tray or
// under a pane's message, build the row again at once.
export function UserFilePill(props: { id: string; kind: FileKind; rebuild: boolean; disabled?: boolean; sizeAs?: string }) {
  const { id, kind, rebuild } = props;
  const file = useStore(userDatasetsStore, (s) => datasetOf(s, id)?.files[kind] ?? null);
  const refused = useStore(userDatasetsStore, (s) => {
    const d = datasetOf(s, id);
    return !!d && fileRefused(d, kind);
  });
  // As JSON, so the selector returns a plain value.
  const report = useStore(userDatasetsStore, (s) => {
    const d = datasetOf(s, id);
    const f = d?.files[kind];
    if (!d || !f) return null;
    // The graph only while it was read from these files.
    const graph = d.builtVersion === d.version ? d.graph : null;
    const refusal = kind === "edgelist" && fileRefused(d, kind) ? d.refusal : null;
    const counts = kind === "edgelist" && graph ? `${graph.n} / ${graph.m}` : null;
    const blocks = reportTip({ role: ROLE_NAMES[kind], file: f.fileName, counts }, fileLines(kind, graph, refusal));
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
      report={report}
      disabled={props.disabled}
      sizeAs={props.sizeAs}
    />
  );
}

// Under a pane's message, the file the dataset on screen lacks. The user's
// own row takes it and builds again; a curated dataset is copied into a row
// of the user's own with the file (copyCurated).
export function MissingFilePill({ kind }: { kind: OptionalKind }) {
  const current = useStore(datasetStore, (s) => s.current);
  const own = useStore(userDatasetsStore, (s) => !!datasetOf(s, current));
  if (own) return <UserFilePill id={current!} kind={kind} rebuild />;
  return <FilePill name={ROLE_NAMES[kind]} added={false} accent="extra" onPick={(f) => copyCurated(kind, f)} />;
}

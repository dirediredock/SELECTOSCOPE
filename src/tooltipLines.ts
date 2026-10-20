// The tooltip files' format (docs/tooltips_ui.txt, docs/tooltips_data.txt),
// apart from controlText.ts so Node scripts and their tests can read it.

export interface TooltipLine {
  heading: string;
  label: string;
  text: string;
}

// CAPS headings, each followed by "LABEL: text" lines, one tooltip a line.
// `file` names the file in errors.
export function parseTooltipLines(text: string, file: string): TooltipLine[] {
  const out: TooltipLine[] = [];
  let heading = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(": ");
    if (colon < 0) {
      if (line !== line.toUpperCase()) throw new Error(`${file}: "${line}" is neither a CAPS heading nor LABEL: text`);
      heading = line;
      continue;
    }
    out.push({ heading, label: line.slice(0, colon), text: line.slice(colon + 2).trim() });
  }
  return out;
}

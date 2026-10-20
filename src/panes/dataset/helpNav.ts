import { createStore } from "../../state/createStore";

// Help's sections, in docs/help_pane.txt's order, for its strip's Sections.
export const HELP_SECTIONS = [
  { id: "start", label: "Quick start" },
  { id: "select", label: "Selection controls" },
  { id: "navigate", label: "General navigation" },
  { id: "panes", label: "Panes" },
  { id: "sweep", label: "Auto Sweep" },
  { id: "data", label: "Using your own data" },
] as const;

export type HelpSection = (typeof HELP_SECTIONS)[number]["id"];

// What Sections shows (the section in view) and the last pick, which the sheet
// glides to. A pick is a new object each time, so picking the same section
// again glides back to its top.
export const helpNav = createStore<{ section: HelpSection; goto: { id: HelpSection } | null }>({
  section: "start",
  goto: null,
});

export function goToSection(id: HelpSection) {
  helpNav.set({ section: id, goto: { id } });
}

// The section in view: the last one whose top has reached the view's top
// (within a few px, so a section a Sections pick glides to stays the one it shows). At
// the very end it is the last, where a short section can never reach the top.
// `tops` are the sections' content y, in order, where each sits at the top of
// the view.
const REACHED = 4;

export function sectionAt(tops: readonly number[], scrollTop: number, clientHeight: number, scrollHeight: number): number {
  if (!tops.length) return 0;
  if (scrollTop <= 1) return 0;
  if (scrollTop + clientHeight >= scrollHeight - 1) return tops.length - 1;
  let at = 0;
  tops.forEach((t, i) => {
    if (t <= scrollTop + REACHED) at = i;
  });
  return at;
}

// Where a pick glides to: the section's top at the view's top, within the
// scroll's range.
export function topTarget(top: number, clientHeight: number, scrollHeight: number): number {
  return Math.max(0, Math.min(scrollHeight - clientHeight, top));
}

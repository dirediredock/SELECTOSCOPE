import { createStore } from "./createStore";
import { paneRowStore } from "./paneRow";
import type { SlotId } from "./paneRow";
import { selectionStore } from "./selection";

// What the interface has open, focused or held right now: the pane that owns
// the strip, an open menu, the upload trays, Help, a held Space. The settings
// a user picks are controls.ts's.

// UPLOAD YOUR DATA's two ways in.
export type Upload = "csv" | "json";

export interface InterfaceState {
  // The pane whose controls fill the bottom strip: the last one the pointer
  // entered or pressed, or the pane containing keyboard focus. It holds
  // outside panes and on the way from the pane to its controls, so the strip
  // stays put on the way to it (hoverFocus.ts).
  focused: SlotId | null;
  // A pane the pointer is crossing on the way to the strip, which doesn't
  // take focus: its banner turns faintly gray, so the pass reads as seen.
  passed: SlotId | null;
  // The pane whose header menu is open.
  menuOpen: SlotId | null;
  // While + New is picked, the way UPLOAD YOUR DATA has chosen, whose trays
  // the Data strip serves; null, it serves the dataset on screen.
  upload: Upload | null;
  // The way + New opens on: CSV at first, then the last one picked.
  lastUpload: Upload;
  // The strip's + New is hovered or focused: the list shows the + New row
  // as hovered.
  newHover: boolean;
  // The Data slot shows Help rather than the dataset list.
  help: boolean;
  // Held Space turns a drag into navigation (the hand).
  spaceHeld: boolean;
}

// NodeLink owns the strip until the pointer enters a pane.
const openingSlot = paneRowStore.get().slots.find((s) => s.type === "nodelink")?.slot ?? null;

export const interfaceStore = createStore<InterfaceState>({
  focused: openingSlot,
  passed: null,
  menuOpen: null,
  upload: null,
  lastUpload: "csv",
  newHover: false,
  // Off on every load: the list is where a session starts.
  help: false,
  spaceHeld: false,
});

// Hover, a press or keyboard focus in a pane gives it the strip.
export function focus(slot: SlotId) {
  if (interfaceStore.get().focused !== slot) interfaceStore.set({ focused: slot });
}

export function toggleMenu(slot: SlotId) {
  interfaceStore.set((s) => ({ menuOpen: s.menuOpen === slot ? null : slot }));
}

export function closeMenu() {
  interfaceStore.set({ menuOpen: null });
}

// Space, as in Photoshop: held, a drag navigates.
export function pressSpace() {
  interfaceStore.set({ spaceHeld: true });
}

// Also when Space is let go in another window, so no hand is stuck on.
export function releaseSpace() {
  if (interfaceStore.get().spaceHeld) interfaceStore.set({ spaceHeld: false });
}

export function setUpload(upload: Upload | null) {
  if (interfaceStore.get().upload !== upload) interfaceStore.set(upload ? { upload, lastUpload: upload } : { upload });
}

// The Data pane's + New: the strip turns to uploading, on the way last used.
export function openNew() {
  setUpload(interfaceStore.get().lastUpload);
}

// A selection in any pane works on the dataset on screen, so + New gives the
// ring and the strip back to it. The draft keeps what was picked.
selectionStore.subscribe((s, prev) => {
  if (s.nodes !== prev.nodes || s.edges !== prev.edges) setUpload(null);
});

export function setNewHover(newHover: boolean) {
  if (interfaceStore.get().newHover !== newHover) interfaceStore.set({ newHover });
}

// The menu row and both ? buttons set this one flag, so they always agree.
// Either way the header menu closes.
export function setHelp(help: boolean) {
  interfaceStore.set({ help, menuOpen: null });
}

export function toggleHelp() {
  setHelp(!interfaceStore.get().help);
}

import { createStore } from "./createStore";
import { FORMS, SERIATIONS } from "../controlOptions";
import { data } from "../data/dataStore";
import { fitView } from "./views";
import { layout, retyped } from "./layout";
import type { SlotId } from "./layout";

// The Matrix's settings, chosen in the bottom strip while it is focused.
// Each matrix slot has its own. All reset on a dataset switch, which is a
// fresh start.

export type Seriation = (typeof SERIATIONS)[number]["id"];
export const DEFAULT_SERIATION: Seriation = "harm1";

export type Form = (typeof FORMS)[number]["id"];
export const DEFAULT_FORM: Form = "diamond";

export interface MatrixSettings {
  seriation: Seriation;
  form: Form;
}

const OPENING: MatrixSettings = { seriation: DEFAULT_SERIATION, form: DEFAULT_FORM };

type BySlot = Partial<Record<SlotId, MatrixSettings>>;

export const matrixSettings = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const matrixIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? OPENING;
export const matrixOf = (slot: SlotId) => matrixIn(matrixSettings.get(), slot);

function update(slot: SlotId, patch: Partial<MatrixSettings>) {
  matrixSettings.set((s) => ({ bySlot: { ...s.bySlot, [slot]: { ...matrixIn(s, slot), ...patch } } }));
}

export function setSeriation(slot: SlotId, seriation: Seriation) {
  update(slot, { seriation });
}

// A new form has its own extent, so the view refits. A new ordering keeps the
// zoom and pan: the extent is the same, and orderings compare at one scale.
export function setForm(slot: SlotId, form: Form) {
  if (form === matrixOf(slot).form) return;
  update(slot, { form });
  fitView(slot);
}

data.subscribe((s, prev) => {
  if (s.graph !== prev.graph) matrixSettings.set({ bySlot: {} });
});

// A slot that becomes a matrix starts from the defaults.
layout.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  if (!fresh.some((slot) => matrixSettings.get().bySlot[slot])) return;
  const bySlot = { ...matrixSettings.get().bySlot };
  fresh.forEach((slot) => delete bySlot[slot]);
  matrixSettings.set({ bySlot });
});

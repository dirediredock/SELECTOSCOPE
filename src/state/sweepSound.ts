import { createStore } from "./createStore";

// The sweep's sound (audio/sweepSonify.ts), an experiment: off until the
// Sound toggle in Help's Auto Sweep section turns it on. One value for every
// pane, lasting the session, as the sweep's other settings do.
export const sweepSoundStore = createStore<{ on: boolean }>({ on: false });

export function toggleSweepSound() {
  sweepSoundStore.set((s) => ({ on: !s.on }));
}

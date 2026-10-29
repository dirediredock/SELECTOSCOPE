import { createStore } from "./createStore";

// Auto Sweep's settings; the running band is sweepRun.ts's.

// The band's area, as a percent of the axis's extent.
export const SWEEP_AREA = { min: 1, max: 50, opening: 20 } as const;

// How fast the band travels, as a percent of one pass in PERIOD_MS (sweepRun.ts).
export const SWEEP_SPEED = { min: 25, max: 400, opening: 125 } as const;

// Sideways (the off side of Vertical), area,
// speed and wrap are one value each, shown in every pane's strip (wrap in the
// footer strip's band), so any pane sweeps as the last one did. They last the
// session. What the band lights is the top strip's Select mode.
export interface SweepSettings {
  sideways: boolean;
  area: number;
  speed: number;
  wrap: boolean;
}

export const sweepSettingsStore = createStore<SweepSettings>({
  sideways: false,
  area: SWEEP_AREA.opening,
  speed: SWEEP_SPEED.opening,
  wrap: false,
});

export function setSweepSideways(sideways: boolean) {
  sweepSettingsStore.set({ sideways });
}

export function setSweepArea(area: number) {
  sweepSettingsStore.set({ area });
}

export function setSweepSpeed(speed: number) {
  sweepSettingsStore.set({ speed });
}

export function toggleSweepWrap() {
  sweepSettingsStore.set((s) => ({ wrap: !s.wrap }));
}

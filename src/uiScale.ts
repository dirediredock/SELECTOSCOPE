// Every size in the app is a design px at scale 1, drawn at UI_SCALE: the
// html font-size in styles.css is 12 px × UI_SCALE, and canvases draw in
// design px through canvas/sizeCanvas.ts.
// Why: the interface reads best at this density.
export const UI_SCALE = 0.9;
export const scaled = (px: number) => px * UI_SCALE;

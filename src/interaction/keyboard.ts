import { pressSpace, releaseSpace } from "../state/uiStore";
import { pressStep, releaseStep, sweep } from "../state/sweep";

const CONTROL =
  'button, input, textarea, select, a[href], [contenteditable]:not([contenteditable="false"]), ' +
  '[role="button"], [role="radio"], [role="slider"], [role="switch"], ' +
  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="listbox"], [role="separator"]';
const TEXT_FIELD = 'textarea, select, input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"], [type="submit"])';

// Preserve native and ARIA control key bindings, including events from children
// inside buttons. Space and sweep stepping belong to graph exploration.
function isControl(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  return !!target && (target.isContentEditable || !!target.closest?.(CONTROL));
}

// The arrows go to a control only while it holds keyboard focus, or while text
// is being edited. Why: a click leaves focus on what it pressed (Run, a
// choice), and the band must still step on the next arrow.
function keepsArrows(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  if (target.isContentEditable) return true;
  const control = target.closest?.(CONTROL);
  return !!control && (control.matches(":focus-visible") || control.matches(TEXT_FIELD));
}

export function attachKeyboardShortcuts(): () => void {
  const capture = { capture: true };
  const modified = (e: KeyboardEvent) => e.metaKey || e.ctrlKey || e.altKey;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== "Space" || e.defaultPrevented || isControl(e) || modified(e)) return;
    e.preventDefault();
    if (!e.repeat) pressSpace();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== "Space") return;
    if (!isControl(e)) e.preventDefault();
    // Always release, even if focus moved to a control during the gesture.
    releaseSpace();
  };
  // Every arrow steps the band, in either orientation: ↓ and → forward, ↑ and ← back.
  const arrow = (e: KeyboardEvent) =>
    e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
  const onArrowDown = (e: KeyboardEvent) => {
    const dir = arrow(e);
    if (dir === 0 || e.defaultPrevented || keepsArrows(e) || modified(e)) return;
    if (e.repeat ? sweep.get().slot === null : !pressStep(dir)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const onArrowUp = (e: KeyboardEvent) => {
    const dir = arrow(e);
    if (dir !== 0) releaseStep(dir);
  };
  const onBlur = () => {
    releaseSpace();
    releaseStep();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("keydown", onArrowDown, capture);
  window.addEventListener("keyup", onArrowUp, capture);
  window.addEventListener("blur", onBlur);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("keydown", onArrowDown, capture);
    window.removeEventListener("keyup", onArrowUp, capture);
    window.removeEventListener("blur", onBlur);
    onBlur();
  };
}

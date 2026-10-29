import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachKeyboardShortcuts } from "./keyboard";
import { pressSpace, releaseSpace } from "../state/interface";
import { pressStep, releaseStep, sweepRunStore } from "../state/sweepRun";

vi.mock("../state/interface", () => ({ pressSpace: vi.fn(), releaseSpace: vi.fn() }));
vi.mock("../state/sweepRun", () => ({
  pressStep: vi.fn(), releaseStep: vi.fn(), sweepRunStore: { get: vi.fn() },
}));

let detach: () => void;
let events: EventTarget;
// A control's target: focused from the keyboard (or a text field), or clicked.
type Control = boolean | "keyboard" | "pointer";
function key(type: "keydown" | "keyup", code: string, control: Control = false, extra = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, key: code === "Space" ? " " : code, repeat: false, ...extra });
  // A descendant's closest() resolves to its containing control; a graph
  // surface has no control ancestor. No DOM implementation is needed here.
  const matches = () => control === true || control === "keyboard";
  Object.defineProperty(event, "target", { value: { closest: () => (control ? { matches } : null) } });
  events.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
  events = new EventTarget();
  vi.stubGlobal("window", events);
  vi.mocked(pressStep).mockReturnValue(true);
  vi.mocked(sweepRunStore.get).mockReturnValue({ slot: "active" } as ReturnType<typeof sweepRunStore.get>);
  detach = attachKeyboardShortcuts();
});
afterEach(() => { detach(); vi.unstubAllGlobals(); });

describe("exploration shortcuts", () => {
  it("preserves Space on a control, including key release", () => {
    expect(key("keydown", "Space", true).defaultPrevented).toBe(false);
    expect(key("keyup", "Space", true).defaultPrevented).toBe(false);
    expect(pressSpace).not.toHaveBeenCalled();
  });

  it("holds the hand on a graph surface and releases it even if focus moves", () => {
    expect(key("keydown", "Space").defaultPrevented).toBe(true);
    expect(pressSpace).toHaveBeenCalledOnce();
    key("keydown", "Space", false, { repeat: true });
    expect(pressSpace).toHaveBeenCalledOnce();
    key("keyup", "Space", true);
    expect(releaseSpace).toHaveBeenCalledOnce();
  });

  it("leaves arrow keys to controls during an active sweep", () => {
    expect(key("keydown", "ArrowDown", true).defaultPrevented).toBe(false);
    expect(key("keydown", "ArrowUp", true).defaultPrevented).toBe(false);
    expect(key("keydown", "ArrowLeft", true).defaultPrevented).toBe(false);
    expect(key("keydown", "ArrowRight", true).defaultPrevented).toBe(false);
    expect(pressStep).not.toHaveBeenCalled();
  });

  it("steps the sweep when a click left focus on a control", () => {
    expect(key("keydown", "ArrowDown", "pointer").defaultPrevented).toBe(true);
    expect(pressStep).toHaveBeenCalledWith(1);
  });

  it("lets go of a button pressed with the pointer, not from the keyboard", () => {
    const button = { blur: vi.fn() };
    const click = (detail: number) => {
      const event = new Event("click");
      Object.assign(event, { detail });
      Object.defineProperty(event, "target", { value: { closest: () => button } });
      events.dispatchEvent(event);
    };
    click(0);
    expect(button.blur).not.toHaveBeenCalled();
    click(1);
    expect(button.blur).toHaveBeenCalledOnce();
    detach();
    click(1);
    expect(button.blur).toHaveBeenCalledOnce();
  });

  it("steps and releases a sweep on an exploration surface", () => {
    expect(key("keydown", "ArrowDown").defaultPrevented).toBe(true);
    expect(pressStep).toHaveBeenCalledWith(1);
    key("keyup", "ArrowDown", true);
    expect(releaseStep).toHaveBeenCalledWith(1);
    expect(key("keydown", "ArrowUp").defaultPrevented).toBe(true);
    expect(pressStep).toHaveBeenCalledWith(-1);
  });

  it("steps forward with → and back with ←, in either orientation", () => {
    expect(key("keydown", "ArrowRight").defaultPrevented).toBe(true);
    expect(pressStep).toHaveBeenLastCalledWith(1);
    key("keyup", "ArrowRight", true);
    expect(releaseStep).toHaveBeenLastCalledWith(1);
    expect(key("keydown", "ArrowLeft").defaultPrevented).toBe(true);
    expect(pressStep).toHaveBeenLastCalledWith(-1);
    key("keyup", "ArrowLeft", true);
    expect(releaseStep).toHaveBeenLastCalledWith(-1);
  });

  it("leaves arrows alone when there is no sweep", () => {
    vi.mocked(pressStep).mockReturnValue(false);
    expect(key("keydown", "ArrowDown").defaultPrevented).toBe(false);
  });

  it("preserves modified shortcuts", () => {
    expect(key("keydown", "Space", false, { metaKey: true }).defaultPrevented).toBe(false);
    expect(key("keydown", "ArrowDown", false, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(pressSpace).not.toHaveBeenCalled();
    expect(pressStep).not.toHaveBeenCalled();
  });

  it("releases held gestures on window blur and removes listeners on cleanup", () => {
    key("keydown", "Space");
    events.dispatchEvent(new Event("blur"));
    expect(releaseSpace).toHaveBeenCalledOnce();
    expect(releaseStep).toHaveBeenCalledWith();
    detach();
    vi.clearAllMocks();
    key("keydown", "Space");
    key("keydown", "ArrowDown");
    expect(pressSpace).not.toHaveBeenCalled();
    expect(pressStep).not.toHaveBeenCalled();
  });
});

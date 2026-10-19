import { useRef } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

export interface ChoiceOption<T extends string> {
  id: T;
  label: ReactNode;
  hint?: string; // its sentence, which its tray's tip adds while it is chosen
  disabled?: boolean;
}

// Which one: one option out of a few, in equal columns, with a raised thumb
// that slides to the chosen one. Disabled options stay visible, and the thumb
// and the arrow keys never land on them. A disabled choice dims in place, its
// thumb still on the value, as a slider keeps its readout. A click on the
// chosen option still picks it again (NodeLink's Interactive reruns that way).
// A null value picks none: no thumb, until a click picks one.
export function Choice<T extends string>(props: {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onPick: (id: T) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { options } = props;
  const chosen = options.findIndex((o) => o.id === props.value && !o.disabled);

  // Roving focus, as in a radio group: the arrows pick the next enabled option.
  const onKeyDown = (e: KeyboardEvent) => {
    if (props.disabled) return;
    const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]));
    if (!enabled.length) return;
    const at = enabled.indexOf(chosen);
    let next: number;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = enabled[(at + 1) % enabled.length]!;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = enabled[(at - 1 + enabled.length) % enabled.length]!;
    else if (e.key === "Home") next = enabled[0]!;
    else if (e.key === "End") next = enabled[enabled.length - 1]!;
    else return;
    e.preventDefault();
    props.onPick(options[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div
      className={`track choice${props.disabled ? " is-disabled" : ""}`}
      role="radiogroup"
      aria-label={props.label}
      style={{ "--n": options.length, "--i": Math.max(chosen, 0) } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {chosen >= 0 && <span className="choice-thumb" aria-hidden="true" />}
      {options.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === chosen}
          tabIndex={i === chosen || (chosen < 0 && i === 0) ? 0 : -1}
          className="choice-option control-text"
          disabled={props.disabled || o.disabled}
          onClick={() => props.onPick(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { useSyncExternalStore } from "react";

// A tiny subscribable store that lives outside React. Canvases subscribe and
// draw imperatively; React components read through useStore. State is replaced,
// never mutated, so every snapshot stays valid (cheap undo later).
export interface Store<S> {
  get(): S;
  set(patch: Partial<S> | ((s: S) => Partial<S>)): void;
  subscribe(fn: (s: S, prev: S) => void): () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const subs = new Set<(s: S, prev: S) => void>();
  return {
    get: () => state,
    set(patch) {
      const p = typeof patch === "function" ? patch(state) : patch;
      const keys = Object.keys(p) as (keyof S)[];
      if (keys.every((k) => Object.is(p[k], state[k]))) return;
      const prev = state;
      state = { ...state, ...p };
      subs.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore<S extends object, T>(store: Store<S>, pick: (s: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => pick(store.get()));
}

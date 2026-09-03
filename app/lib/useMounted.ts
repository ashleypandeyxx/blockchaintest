"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the first client render, true afterwards.
 * Lets a subtree read localStorage in lazy `useState` initialisers without
 * a hydration mismatch — and without setState-in-effect cascades.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

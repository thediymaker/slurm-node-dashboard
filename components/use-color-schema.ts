"use client";

import { useCallback, useSyncExternalStore } from "react";

// The card color scheme, kept in localStorage and shared live between the
// header's picker and whatever page is showing node colors
const KEY = "colorSchema";
const EVENT = "colorschemachange";

function read(): string {
  try {
    return localStorage.getItem(KEY) || "default";
  } catch {
    return "default";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  // Other tabs
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useColorSchema(): [string, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, read, () => "default");
  const set = useCallback((next: string) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private windows can refuse storage
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [value, set];
}

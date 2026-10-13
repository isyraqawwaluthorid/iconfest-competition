"use client";

import { useSyncExternalStore } from "react";

/**
 * Pilihan tampilan peta: terang (bawaan) atau gelap (supaya warna ruas, wilayah, dan batasnya lebih menonjol).
 * Satu pilihan untuk semua peta. Pilihan hanya berlaku selama situs terbuka dan ikut saat berpindah halaman;
 * setiap kali situs dibuka atau dimuat ulang, peta kembali terang.
 */
export type MapTheme = "light" | "dark";

const CHANGED = "semarsight:map-theme-changed";

let current: MapTheme = "light";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

export function setMapTheme(theme: MapTheme): void {
  current = theme;
  window.dispatchEvent(new Event(CHANGED));
}

/** Pilihan peta saat ini. */
export function useMapTheme(): MapTheme {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "light",
  );
}

/** Kelas untuk elemen yang membungkus peta datar cadangan; aturan warnanya ada di globals.css (`.map-dark`). */
export function mapThemeClass(theme: MapTheme): string {
  return theme === "dark" ? "map-dark" : "";
}

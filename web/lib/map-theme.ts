"use client";

import { useSyncExternalStore } from "react";

/**
 * Pilihan tampilan peta: terang (warna asli peta dasar) atau gelap (peta dasar digelapkan lewat CSS, supaya
 * warna ruas, wilayah, dan batasnya lebih menonjol). Satu pilihan untuk semua peta, diingat di browser.
 */
export type MapTheme = "light" | "dark";

const KEY = "semarsight:map-theme";
const CHANGED = "semarsight:map-theme-changed";

// Dipakai bila penyimpanan browser tidak bisa diakses (mode privat): pilihan tetap berlaku selama halaman terbuka.
let remembered: MapTheme | null = null;

function read(): MapTheme {
  if (remembered) return remembered;
  try {
    return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange); // tab lain mengganti pilihan
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setMapTheme(theme: MapTheme): void {
  remembered = theme;
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // Tanpa penyimpanan, pilihan hanya diingat selama halaman terbuka.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Pilihan peta saat ini. HTML dari server selalu terang; pilihan tersimpan berlaku begitu halaman terpasang. */
export function useMapTheme(): MapTheme {
  return useSyncExternalStore(subscribe, read, () => "light");
}

/** Kelas untuk elemen yang membungkus peta; aturan warnanya ada di globals.css (`.map-dark`). */
export function mapThemeClass(theme: MapTheme): string {
  return theme === "dark" ? "map-dark" : "";
}

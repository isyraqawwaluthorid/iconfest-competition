"use client";

import { setMapTheme, useMapTheme } from "@/lib/map-theme";

/** Tombol "Peta gelap": mengganti tampilan semua peta antara terang dan gelap, dan mengingat pilihannya. */
export function MapThemeToggle() {
  const dark = useMapTheme() === "dark";
  return (
    <button
      type="button"
      aria-pressed={dark}
      onClick={() => setMapTheme(dark ? "light" : "dark")}
      title={dark ? "Kembali ke peta terang" : "Gelapkan peta supaya warna dan batas lebih menonjol"}
      className={`flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors ${
        dark ? "bg-text font-semibold text-surface" : "font-medium text-muted hover:bg-surface-muted hover:text-text"
      }`}
    >
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
      </svg>
      Peta gelap
    </button>
  );
}

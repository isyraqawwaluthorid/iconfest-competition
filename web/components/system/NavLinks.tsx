"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/lalu-lintas", label: "Lalu lintas" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/simulasi", label: "Simulasi" },
  { href: "/tentang", label: "Tentang" },
];
// Kamera adalah bukti pendukung, bukan tampilan utama, jadi dikelompokkan terpisah.
const SOURCES = [
  { href: "/kamera", label: "Kamera" },
  { href: "/mosaik", label: "Mosaik" },
];

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  const link = (item: { href: string; label: string }) => {
    const current = isCurrent(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={current ? "page" : undefined}
        className={`rounded-control px-3 py-1.5 text-sm transition-colors ${
          current ? "bg-primary font-semibold text-on-primary" : "font-medium text-muted hover:bg-surface-muted hover:text-text"
        }`}
      >
        {item.label}
      </Link>
    );
  };
  return (
    <nav aria-label="Navigasi utama" className="flex flex-wrap items-center gap-1">
      {NAV.map(link)}
      <span className="label-caps mx-2 text-muted">Sumber data</span>
      {SOURCES.map(link)}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/lalu-lintas", label: "Lalu lintas" },
  { href: "/ruang-publik", label: "Ruang publik" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/simulasi", label: "Simulasi" },
  { href: "/tentang", label: "Tentang" },
];
// Kamera adalah bukti pendukung, bukan tampilan utama, jadi dikelompokkan terpisah.
const SOURCES = [
  { href: "/kamera", label: "Kamera" },
  { href: "/mosaik", label: "Mosaik" },
];

// Halaman rincian yang dibuka dari Beranda dan tidak punya menu sendiri; saat dibuka, menu Beranda tetap menyala.
const UNDER_HOME = ["/air"];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || UNDER_HOME.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
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
        className={`shrink-0 rounded-control px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
          current ? "bg-primary font-semibold text-on-primary" : "font-medium text-muted hover:bg-surface-muted hover:text-text"
        }`}
      >
        {item.label}
      </Link>
    );
  };
  return (
    // Di layar sempit menu menjadi satu baris yang bisa digeser, supaya tidak memakan tiga baris di atas peta.
    <nav aria-label="Navigasi utama" className="flex max-w-full items-center gap-1 overflow-x-auto lg:flex-wrap">
      {NAV.map(link)}
      <span className="label-caps mx-2 shrink-0 whitespace-nowrap text-muted">Sumber data</span>
      {SOURCES.map(link)}
    </nav>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SystemBanner } from "@/components/system/SystemBanner";
import { getWorkerHeartbeat } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SemarSight", template: "%s · SemarSight" },
  description:
    "CCTV publik Kota Semarang sebagai sensor kota: kondisi air, kepadatan lalu lintas, dan keramaian ruang publik.",
};

const NAV = [{ href: "/", label: "Beranda" }];
// Kamera adalah bukti pendukung, bukan tampilan utama, jadi dikelompokkan terpisah.
const SOURCES = [
  { href: "/kamera", label: "Kamera" },
  { href: "/mosaik", label: "Mosaik" },
];

async function SystemBannerLoader() {
  // Banner tidak boleh menjatuhkan halaman: jika status sistem gagal dibaca, anggap belum ada heartbeat.
  const heartbeat = await getWorkerHeartbeat().catch(() => null);
  return <SystemBanner initial={heartbeat} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-semibold">
              SemarSight
            </Link>
            <nav aria-label="Navigasi utama" className="flex flex-wrap items-center gap-4 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="font-medium hover:text-primary">
                  {item.label}
                </Link>
              ))}
              <span className="text-xs text-muted">Sumber data:</span>
              {SOURCES.map((item) => (
                <Link key={item.href} href={item.href} className="text-muted hover:text-primary">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <Suspense fallback={null}>
          <SystemBannerLoader />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">
          Sumber CCTV: PANTAUSEMAR, Pemerintah Kota Semarang. Angka di situs ini adalah perkiraan dari gambar, bukan
          pengukuran resmi.
        </footer>
      </body>
    </html>
  );
}

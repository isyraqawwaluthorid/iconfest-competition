import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "@/components/system/NavLinks";
import { SystemBanner } from "@/components/system/SystemBanner";
import { SystemChip } from "@/components/system/SystemChip";
import { getWorkerHeartbeat } from "@/lib/queries";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "SemarSight", template: "%s · SemarSight" },
  description:
    "CCTV publik Kota Semarang sebagai sensor kota: kondisi air, kepadatan lalu lintas, dan keramaian ruang publik.",
};

async function SystemStatus() {
  // Status sistem tidak boleh menjatuhkan halaman: jika gagal dibaca, anggap belum ada heartbeat.
  const heartbeat = await getWorkerHeartbeat().catch(() => null);
  return <SystemChip initial={heartbeat} />;
}

async function SystemBannerLoader() {
  const heartbeat = await getWorkerHeartbeat().catch(() => null);
  return <SystemBanner initial={heartbeat} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-[1100] border-b border-border bg-surface">
          <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 lg:px-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/" className="flex items-center gap-2.5">
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-control bg-primary text-on-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                </span>
                <span className="flex flex-col leading-none">
                  <span className="font-display text-lg font-extrabold tracking-tight text-primary">SemarSight</span>
                  <span className="label-caps mt-1 text-[10px] text-muted">Sensor kota Semarang</span>
                </span>
              </Link>
              <Suspense fallback={null}>
                <SystemStatus />
              </Suspense>
            </div>
            <Suspense fallback={null}>
              <NavLinks />
            </Suspense>
          </div>
        </header>
        <Suspense fallback={null}>
          <SystemBannerLoader />
        </Suspense>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-border bg-surface">
          <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2.5 text-xs text-muted lg:px-6">
            <p>
              <span className="font-display font-bold text-primary">SemarSight</span> · CCTV: PANTAUSEMAR, Pemerintah
              Kota Semarang · Peta: OpenStreetMap · Cuaca: Open-Meteo
            </p>
            <p>Angka di situs ini adalah perkiraan dari gambar, bukan pengukuran resmi. Tanpa pengenalan wajah atau pelat nomor.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

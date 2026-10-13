import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-token border border-border bg-surface px-3 py-2">
        <nav aria-label="Navigasi admin" className="flex items-center gap-4 text-sm">
          <span className="font-semibold">Admin</span>
          <Link href="/admin/kamera" className="font-medium hover:text-primary">
            Kamera
          </Link>
          <Link href="/mosaik" className="font-medium hover:text-primary">
            Mosaik
          </Link>
        </nav>
        {/* Tombol ini membaca alamat halaman, jadi dirender di browser dan dibungkus Suspense. */}
        <Suspense fallback={null}>
          <LogoutButton />
        </Suspense>
      </div>
      {children}
    </div>
  );
}

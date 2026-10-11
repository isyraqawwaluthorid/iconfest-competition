"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function RouteError({ retry }: { error: Error; retry: () => void }) {
  return (
    <div className="page">
      <ErrorState
        message="Halaman tidak bisa mengambil data dari server. Periksa koneksi internet, lalu coba lagi."
        onRetry={retry}
      />
    </div>
  );
}

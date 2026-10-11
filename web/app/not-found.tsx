import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="page space-y-4">
      <EmptyState
        title="Halaman tidak ditemukan"
        reason="Alamatnya mungkin salah, atau kamera ini sudah tidak dipantau."
      />
      <Link href="/kamera" className="text-sm font-medium text-primary underline">
        Buka peta kamera
      </Link>
    </div>
  );
}

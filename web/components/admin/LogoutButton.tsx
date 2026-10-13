"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    router.replace("/admin/login");
    router.refresh();
  }
  // Di halaman masuk belum ada sesi yang bisa diakhiri.
  if (pathname === "/admin/login") return null;
  return (
    <Button variant="ghost" onClick={logout}>
      Keluar
    </Button>
  );
}

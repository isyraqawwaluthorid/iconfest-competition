"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? "Password salah." : "Login gagal. Coba lagi.");
        return;
      }
      router.replace("/admin/kamera");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server. Periksa koneksi, lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded-token border border-border bg-surface p-4">
      <h1 className="text-lg font-semibold">Masuk admin</h1>
      <label className="block text-sm">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-1 block w-full rounded-token border border-border bg-bg px-3 py-2"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-status-awas">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || password.length === 0}>
        {busy ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}

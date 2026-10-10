"use client";

import { Button } from "./Button";

/** Keadaan error: pesan yang bisa dipahami + tombol coba lagi. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-token border border-status-awas bg-surface p-6 text-center">
      <p className="font-medium">Data gagal dimuat</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry ? (
        <div className="mt-4">
          <Button onClick={onRetry}>Coba lagi</Button>
        </div>
      ) : null}
    </div>
  );
}

/** Keadaan kosong: jelaskan apa yang belum ada dan kenapa. */
export function EmptyState({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-token border border-dashed border-border p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{reason}</p>
    </div>
  );
}

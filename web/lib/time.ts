const WIB = "Asia/Jakarta";

const timeFormat = new Intl.DateTimeFormat("id-ID", { timeZone: WIB, hour: "2-digit", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: WIB,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "18.52 WIB" */
export function formatTimeWib(iso: string): string {
  return `${timeFormat.format(new Date(iso))} WIB`;
}

/** "10 Okt, 18.52 WIB" */
export function formatDateTimeWib(iso: string): string {
  return `${dateTimeFormat.format(new Date(iso))} WIB`;
}

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

/** "baru saja", "7 menit lalu", "3 jam lalu", "2 hari lalu" */
export function timeAgo(iso: string, now: number): string {
  const minutes = minutesSince(iso, now);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

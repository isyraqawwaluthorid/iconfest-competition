/** Ikon garis sederhana (24×24) yang mengikuti warna teks. Hanya hiasan; makna selalu ada di teks. */
const PATHS = {
  droplet: ["M12 2.5s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z"],
  rain: ["M7 15a4 4 0 0 1 .6-7.96A5.5 5.5 0 0 1 18 8.5a3.5 3.5 0 0 1-.5 6.5H7z", "M9 18v2.5M13 18v2.5M17 18v2.5"],
  car: ["M5 16l1.5-5a2 2 0 0 1 1.9-1.4h7.2a2 2 0 0 1 1.9 1.4L19 16", "M4 16h16v3H4z", "M7.5 19v1.5M16.5 19v1.5"],
  map: ["M9 4L3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4z", "M9 4v13.5M15 6.5V20"],
  camera: ["M4 8h3l1.5-2h7L17 8h3v11H4z", "M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  alert: ["M12 3.5l9 16h-18l9-16z", "M12 10v4.5M12 17.2v.3"],
  close: ["M6 6l12 12M18 6L6 18"],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

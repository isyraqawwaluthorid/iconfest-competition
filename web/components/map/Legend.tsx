import { legendFor, TONE_BG, type MapLayer } from "@/lib/status";

export function Legend({ layer }: { layer: MapLayer }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Keterangan warna penanda">
      {legendFor(layer).map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${TONE_BG[item.tone]}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

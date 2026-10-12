import { eventsToCsv } from "@/lib/events";
import { getEvents } from "@/lib/queries";

/** Unduhan CSV riwayat kejadian. Data publik (hanya baca), sama dengan yang tampil di halaman Riwayat. */
export async function GET() {
  try {
    const csv = eventsToCsv(await getEvents(1000));
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="semarsight-riwayat-kejadian.csv"',
      },
    });
  } catch {
    return Response.json({ error: "Riwayat kejadian tidak dapat dimuat." }, { status: 502 });
  }
}

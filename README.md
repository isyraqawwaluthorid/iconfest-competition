# SemarSight (nama kerja)

Platform web yang mengubah CCTV publik Kota Semarang menjadi "sensor kota": AI membaca kondisi air (sungai, pompa, genangan), kepadatan lalu lintas, dan keramaian ruang publik, lalu menghubungkannya dengan cuaca dan riwayat untuk menghasilkan peringatan dan insight yang bisa ditindaklanjuti.

Proyek lomba **ICONFEST 2026 – Software Development**, tema Smart City.

> Status: tahap awal pengembangan. README ini akan dilengkapi seiring fitur selesai.

## Struktur repo

```
ai/schemas/   JSON schema untuk output AI
data/         daftar kamera publik Semarang (seed)
docs/         brief, arsitektur, spesifikasi, roadmap
supabase/     skema database dan seed kamera
web/          aplikasi Next.js (belum dibuat)
worker/       worker Python (belum dibuat)
```

## Stack

- **Web:** Next.js (App Router), TypeScript, Tailwind CSS, react-leaflet, Recharts
- **Database, storage, realtime:** Supabase
- **Worker:** Python 3.11+, ffmpeg, OpenCV, Ultralytics YOLO
- **AI:** OpenAI API (vision + teks, structured outputs)
- **Cuaca:** Open-Meteo

## Dokumentasi

Mulai dari [docs/01-project-brief.md](docs/01-project-brief.md) dan [docs/02-architecture.md](docs/02-architecture.md). Rencana harian ada di [docs/08-roadmap.md](docs/08-roadmap.md).

## Konfigurasi

Salin `.env.example` menjadi `.env` (worker) dan `web/.env.local` (web), lalu isi nilainya. File berisi nilai asli tidak boleh di-commit.

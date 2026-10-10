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
worker/       worker Python: akuisisi frame, cek kesehatan, kualitas gambar
```

Daftar tugas dan progres ada di [docs/10-tasklist.md](docs/10-tasklist.md).

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

## Menjalankan worker

Prasyarat: Python 3.11+, ffmpeg di `PATH`, dan proyek Supabase yang sudah menjalankan `supabase/schema.sql` lalu `supabase/seed_cameras.sql`.

```bash
cd worker
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install --no-deps ultralytics==8.4.175   # terpisah agar tidak menimpa OpenCV headless

python -m semarsight_worker.main --once --limit 3 --dry-run --verbose   # uji tanpa menulis apa pun
python -m semarsight_worker.main --once                                 # satu siklus penuh
python -m semarsight_worker.main                                        # jalan terus, siklus tiap 5 menit
pytest
```

Setiap siklus worker mengambil satu frame per kamera aktif, menentukan status `live` / `frozen` / `dead`, menilai kualitas gambar, mengarsipkan frame ke `FRAMES_DIR`, mengunggah snapshot terbaru ke Storage, lalu memperbarui `camera_status`, `health_checks`, dan heartbeat di `system_status`.

Untuk kamera bermodul `traffic` atau `crowd`, YOLO11n lokal menghitung kendaraan dan orang per kelas. Hitungan dibandingkan dengan baseline kamera itu sendiri menjadi **indeks kepadatan relatif** (`lancar` / `normal` / `ramai` / `padat`) dan disimpan di `traffic_readings`. Sistem tidak melacak kendaraan, tidak mengenali wajah, dan tidak membaca pelat nomor.

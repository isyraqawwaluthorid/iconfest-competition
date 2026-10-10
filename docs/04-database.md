# 04 — Database (Supabase)

File: `supabase/schema.sql` (struktur) dan `supabase/seed_cameras.sql` (146 kamera).
Keduanya sudah diuji pada PostgreSQL 16 dan **aman dijalankan ulang** (idempoten).

## Cara memasang

1. Buat proyek Supabase baru (region terdekat, mis. Singapura).
2. SQL Editor → jalankan `supabase/schema.sql`.
3. SQL Editor → jalankan `supabase/seed_cameras.sql`.
4. Database → Replication: pastikan tabel `camera_status`, `alerts`, `insights`, `system_status` aktif di publikasi `supabase_realtime` (schema.sql sudah mencoba menambahkannya).
5. Storage: bucket `snapshots` (publik) dibuat oleh schema.sql.
6. Salin URL proyek, anon key, dan service role key ke `.env` (lihat `.env.example`).

## Peta tabel

| Tabel | Isi | Ditulis oleh | Dibaca oleh |
|---|---|---|---|
| `cameras` | Master kamera + kalibrasi (ROI, garis acuan, sistem sungai) | seed, sinkronisasi, admin | semua |
| `camera_status` | **Satu baris per kamera**, kondisi terkini (kesehatan, status air, kepadatan, risiko) | worker | web (Realtime) |
| `health_checks` | Log kesehatan per siklus | worker | statistik ketersediaan |
| `traffic_readings` | Hitungan YOLO per siklus + indeks kepadatan | worker | grafik tren, baseline |
| `water_readings` | Hasil AI vision per panggilan (mentah, sebelum penghalusan) | worker | timeline, evaluasi |
| `baselines` | Median dan p90 per kamera per jam-dalam-minggu | job malam | worker |
| `weather_grid`, `weather_readings` | Titik grid dan data Open-Meteo | worker | worker, web |
| `river_links` | Relasi hulu → hilir + jeda | admin, worker (jeda dipelajari) | worker, halaman Air |
| `events` | Kejadian genangan/luapan (mulai, puncak, selesai, durasi, dampak lalu lintas) | worker | riwayat, replay, laporan |
| `alerts` | Peringatan aktif dan riwayat | worker | web (Realtime) |
| `insights` | Output LLM (ringkasan, laporan harian, lintas modul) + fakta yang dikirim | worker | beranda |
| `labels` | Label manual untuk evaluasi akurasi | admin (server) | halaman evaluasi |
| `system_status` | Heartbeat worker | worker | banner status web |
| `assistant_usage` | Pembatasan laju asisten AI | server | server |

View:
- `v_camera_overview`: gabungan `cameras` + `camera_status` untuk kamera aktif. Sumber utama peta.
- `v_camera_uptime_24h`: persentase ketersediaan per kamera 24 jam terakhir.

## Konvensi

- **Waktu:** `timestamptz` UTC. `hour_of_week` dihitung dalam WIB: `(isodow - 1) * 24 + hour` (Senin 00.00 WIB = 0).
- **Koordinat gambar** (ROI, garis acuan) dinormalisasi 0..1 terhadap lebar dan tinggi gambar, agar tetap berlaku jika resolusi stream berubah.
  - `roi`: `{"points": [[0.12, 0.40], [0.88, 0.42], [0.90, 0.95], [0.10, 0.93]]}`
  - `reference_lines`: `[{"level": "waspada", "points": [[0.1, 0.55], [0.9, 0.57]]}, {"level": "siaga", ...}]`
- **Enum status** memakai istilah Indonesia karena tampil langsung di UI dan laporan.
- **`source`** (`live` / `synthetic` / `replay`) ada di tabel deret waktu. Query untuk halaman publik selalu memfilter `source = 'live'`.
- **`modules`** menentukan penganalisis yang dijalankan worker: `traffic`, `crowd`, `water`. Diturunkan dari kategori saat seed, bisa diubah lewat admin.
- **`water_kind`** di seed adalah tebakan dari nama dan kategori (akhiran `-IN`/`-OUT` → `pompa_in`/`pompa_out`). 22 kamera air belum punya `water_kind`. Isi saat kalibrasi.
- **`is_featured`**: tandai 15–20 kamera air unggulan yang dikalibrasi untuk penyisihan, plus beberapa kamera lalu lintas yang sudutnya bagus.

## Keamanan

- RLS aktif di semua tabel. Publik (`anon`) hanya boleh `select` (kecuali `labels` dan `assistant_usage`, tanpa akses publik).
- Semua penulisan memakai **service role** dari worker atau dari API route server Next.js. Service role key tidak boleh sampai ke browser.

## Volume dan retensi

- `traffic_readings` dan `health_checks`: ±20–45 ribu baris per hari. Cukup untuk paket gratis selama periode lomba. Jika perlu, buat job yang meringkas data > 14 hari menjadi agregat per jam lalu menghapus baris mentah.
- Snapshot penuh **tidak** disimpan di Storage, kecuali `latest/`, `reference/`, `events/`, dan `labels/`.

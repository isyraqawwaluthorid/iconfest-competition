# SemarSight (nama kerja)

Platform web yang mengubah CCTV publik Kota Semarang menjadi "sensor kota": AI membaca kondisi air (sungai, pompa, genangan), kepadatan lalu lintas, dan keramaian ruang publik, lalu menghubungkannya dengan cuaca dan riwayat untuk menghasilkan peringatan dan insight yang bisa ditindaklanjuti.

Proyek lomba **ICONFEST 2026 – Software Development**, tema Smart City.

> Status (12 Okt 2026): worker merekam 146 kamera tiap 5 menit; 20 lokasi air dinilai AI; peringatan, tren, dan skor risiko berjalan; beranda berupa peta tematik per kecamatan dengan kartu insight (Kondisi → Penyebab → Dampak → Tindakan) yang ditulis LLM dari angka sistem dan diperiksa terhadap data sebelum tampil. Hubungan hulu–hilir dan grafik riwayat masih dikerjakan.

## Struktur repo

```
ai/schemas/   JSON schema untuk output AI
data/         daftar kamera publik Semarang (seed)
docs/         brief, arsitektur, spesifikasi, roadmap
supabase/     skema database dan seed kamera
scripts/      skrip bantu Windows: menyalakan worker dan web, mencegah mesin tidur
web/          aplikasi Next.js: peta tematik per kecamatan, bukti visual, admin kalibrasi
worker/       worker Python: akuisisi frame, YOLO, penilaian AI, tren, risiko, peringatan
```

Daftar tugas dan progres ada di [docs/10-tasklist.md](docs/10-tasklist.md).

## Stack

- **Web:** Next.js (App Router), TypeScript, Tailwind CSS, react-leaflet, Recharts
- **Database, storage, realtime:** Supabase
- **Worker:** Python 3.11+, ffmpeg, OpenCV, Ultralytics YOLO
- **AI:** OpenAI API (vision + teks, structured outputs)
- **Cuaca:** Open-Meteo

## Dokumentasi

Mulai dari [docs/01-project-brief.md](docs/01-project-brief.md) dan [docs/02-architecture.md](docs/02-architecture.md). Keputusan penting beserta alasannya dirangkum di [docs/13-catatan-keputusan.md](docs/13-catatan-keputusan.md); cara menyiapkan mesin, menjalankan, dan memindahkan worker ada di [docs/14-operasional.md](docs/14-operasional.md). Rencana harian ada di [docs/08-roadmap.md](docs/08-roadmap.md). Fitur tambahan yang dipertimbangkan, beserta hasil uji ketersediaan datanya, ada di [docs/11-feature-backlog.md](docs/11-feature-backlog.md) dan [docs/12-emisi-kualitas-udara.md](docs/12-emisi-kualitas-udara.md).

## Konfigurasi

Salin `.env.example` menjadi `.env` (worker) dan `web/.env.local` (web), lalu isi nilainya. File berisi nilai asli tidak boleh di-commit.

## Menjalankan web

Prasyarat: Node.js 20+ dan `web/.env.local` berisi `NEXT_PUBLIC_SUPABASE_URL` serta `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Hanya dua nilai publik itu yang boleh berawalan `NEXT_PUBLIC_`.

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm run lint && npm run build
```

Halaman yang sudah ada:

| Rute | Isi |
|---|---|
| `/` | **Denyut Kota.** Peta penuh per kecamatan dengan tiga tema (risiko air, kepadatan lalu lintas, hujan 3 jam ke depan). Panel kiri: kondisi kota dan empat angka utama. Panel kanan: peringatan aktif dan peringkat lokasi, atau rincian kecamatan yang dipilih. Kecamatan tanpa sumber data ditandai "tidak terpantau". |
| `/kamera/[id]` | **Bukti visual** satu lokasi: gambar terakhir dengan garis acuan, hasil penilaian AI, pembanding kondisi normal dan sekarang, gambar yang dinilai AI sebelumnya, rincian skor risiko, grafik kepadatan 24 jam, dan kamera terdekat. |
| `/kamera` | Peta semua kamera sumber data, dengan lapisan Kesehatan Kamera, Lalu Lintas, Air, dan Ruang Publik. |
| `/mosaik` | Grid snapshot terbaru semua kamera. |
| `/admin/kamera`, `/admin/kalibrasi/[id]` | Menandai kamera unggulan dan mengkalibrasi kamera air: area pengamatan, garis acuan, dan foto referensi siang/malam. |

Data di layar berubah tanpa refresh lewat Supabase Realtime. Lencana di header menunjukkan apakah worker masih aktif, dan banner muncul jika worker tidak terlihat lebih dari 15 menit.

Halaman admin butuh `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, dan `ADMIN_SESSION_SECRET` di `web/.env.local`. Keempatnya hanya dibaca di server dan tidak pernah dikirim ke browser.

Semua warna, radius, dan font berasal dari token di `web/app/globals.css`; rancangannya dijelaskan di [docs/06-web-spec.md](docs/06-web-spec.md).

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

Untuk kamera air yang sudah dikalibrasi, AI vision menilai posisi air terhadap garis acuan dan foto referensi kondisi normal. AI hanya dipanggil saat gambar berubah nyata, saat hujan, atau tiap 30 menit. Status resmi ditetapkan oleh aturan penghalusan (naik butuh dua penilaian yang sepakat, turun butuh tiga), bukan langsung oleh jawaban AI. Dari status itu worker menghitung tren, skor risiko terbuka (status 40%, tren 20%, hulu 20%, hujan 20%), dan peringatan dari template. Sistem menilai **status**, bukan tinggi air dalam cm.

Di Windows, worker dan web bisa dijalankan dengan skrip di `scripts/windows/`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\mulai-worker.ps1   # jendela sendiri, menyala ulang otomatis
powershell -ExecutionPolicy Bypass -File scripts\windows\mulai-web.ps1      # build lalu jalan di localhost:3000
cd worker; .\.venv\Scripts\python.exe scripts\status.py                    # ringkasan keadaan sistem
```

Hanya satu worker yang boleh berjalan pada satu waktu. Lihat [docs/14-operasional.md](docs/14-operasional.md).

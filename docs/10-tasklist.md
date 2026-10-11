# 10 — Tasklist Pengembangan

Turunan rinci dari `08-roadmap.md`. Roadmap menjawab "hari ini mengerjakan apa"; dokumen ini menjawab "tugas mana yang sudah selesai dan apa bukti selesainya".

- **[K]** = tugas kode. **[M]** = tugas manual (akun, kunci, kalibrasi, label, dokumen lomba).
- Centang hanya setelah bukti selesai terpenuhi. Perbarui di akhir setiap sesi kerja.
- Urutan fase mengikuti prioritas di brief: perekaman data → air dan lalu lintas → peringatan dan insight → halaman pendukung → fitur tambahan.

Keadaan awal (10 Okt): repo berisi dokumen, skema, dan seed. `web/` dan `worker/` belum ada.

## Fase 0 — Prasyarat (blokir semua fase lain)

- [x] **T0.1 [M]** Pasang ffmpeg (`winget install Gyan.FFmpeg`), buka terminal baru. *Bukti:* `ffmpeg -version` jalan.
- [x] **T0.2 [M]** Buat proyek Supabase; jalankan `supabase/schema.sql` lalu `supabase/seed_cameras.sql` di SQL Editor. *Bukti:* tabel `cameras` berisi 146 baris.
- [x] **T0.3 [M]** Pastikan bucket Storage `snapshots` (publik, baca saja) ada; `schema.sql` membuatnya otomatis. Saat membuat proyek, biarkan **Automatically expose new tables** aktif (skema tidak memuat `GRANT` sendiri) dan aktifkan **Enable automatic RLS**.
- [x] **T0.4 [M]** Salin `.env.example` → `.env`, isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_*`, `SUPABASE_STORAGE_BUCKET`.
- [x] **T0.5 [M]** Buat API key OpenAI khusus proyek (masa berlaku 30 hari, lewat final 26 Okt). Pastikan auto recharge mati agar pengeluaran tidak melewati kredit.
- [ ] **T0.6 [M]** Kirim email permohonan izin ke Diskominfo Kota Semarang.
- [ ] **T0.7 [M]** Tanyakan jam batas pengumpulan 16 Okt ke panitia.

## Fase 1 — Worker dasar + mulai merekam (Sabtu 10 Okt)

Tujuan: data historis mulai terkumpul malam ini. Belum ada YOLO dan AI.

- [x] **T1.1 [K]** Scaffold `worker/`: paket `semarsight_worker`, `requirements.txt`, `config.py` (baca env, nilai default sesuai `05-worker-spec.md`), logging ke stdout.
- [x] **T1.2 [K]** `models.py`: Pydantic `CameraRow` dan tipe hasil siklus.
- [x] **T1.3 [K]** `db.py`: client Supabase (service role), `active_cameras()`, `log_health()`, `update_status()`, unggah Storage.
- [x] **T1.4 [K]** `acquisition.py`: `grab_frame()` lewat ffmpeg + timeout; status `live | frozen | dead`; dHash untuk deteksi beku (3 siklus berturut-turut).
- [x] **T1.5 [K]** `quality.py`: kecerahan, ketajaman, saturasi → `good | fair | poor`, `is_night`.
- [x] **T1.6 [K]** Simpan frame lokal `frames/{camera_id}/{YYYYMMDD}/{HHMMSS}.jpg`; unggah `latest/{camera_id}.jpg` (lebar maks. 960 px).
- [x] **T1.7 [K]** `housekeeping.py`: heartbeat ke `system_status`, retensi frame lokal.
- [x] **T1.8 [K]** `main.py`: siklus paralel (`MAX_CONCURRENCY`), `try/except` per kamera, flag `--once`, `--only-camera`, `--dry-run`, ringkasan per siklus di log.
- [x] **T1.9 [K]** Unit test: `quality.assess`, dHash/frozen. *Bukti:* `pytest` hijau.
- [x] **T1.10 [K]** Uji `--once` terhadap 3 kamera nyata, lalu semua kamera aktif. *Bukti:* `camera_status` terisi, snapshot ada di Storage, baris `health_checks` bertambah.
- [ ] **T1.11 [M]** Biarkan worker berjalan di laptop semalaman (matikan mode tidur). *Bukti:* frame lokal bertambah tiap 5 menit.
- [x] **T1.12 [K]** Kalibrasi `quality` dari arsip siang dan malam: `is_night` sekarang dari posisi matahari, kualitas dari ketajaman, proporsi gelap, dan mode IR.
- [x] **T1.15 [K]** Gangguan jaringan worker tidak dicatat sebagai kamera mati (ambang 40% kamera tanpa jawaban server); catatan palsu dari periode hotspot 11 Okt dibersihkan.
- [x] **T1.14 [K]** Perbaiki deteksi beku: aturan dHash menandai 43 kamera hidup sebagai beku pada malam pertama; diganti sidik gambar persis sama (0 positif palsu pada 1.848 pasangan frame arsip).
- [ ] **T1.13 [K]** Retensi frame: kecualikan file yang direferensikan `labels` atau `events` (belum perlu sebelum 24 Okt, saat frame pertama berumur 14 hari).

Hasil uji siklus penuh pertama (10 Okt, 18.52 WIB): 146 kamera dalam 58 detik, 131 `live`, 15 `dead` (13 membalas 404, 2 membalas 5xx). Arsip frame resolusi penuh ±26 MB per siklus, atau ±7,5 GB per hari.

## Fase 2 — Lalu lintas + web dasar + deploy pertama (Minggu 11 Okt)

- [x] **T2.1 [K]** `analyzers/traffic.py`: YOLO11n singleton, hitung per kelas, filter ROI jalan (titik tengah-bawah kotak).
- [x] **T2.2 [K]** `fusion/baseline.py`: baseline sementara (median 24 jam bergulir), `density_index`, level `lancar/normal/ramai/padat`, `is_anomaly`. Unit test.
- [x] **T2.3 [K]** Sambungkan ke siklus: tulis `traffic_readings`, perbarui `camera_status`.
- [ ] **T2.12 [K]** Evaluasi hitungan YOLO pada siang hari (malam: sepeda motor kecil banyak terlewat); pertimbangkan model lebih besar atau ambang berbeda jika perlu.
- [x] **T2.4 [K]** Scaffold `web/` (Next.js App Router, TypeScript strict, Tailwind), design tokens placeholder di `globals.css`.
- [x] **T2.5 [K]** `lib/`: `supabase/public.ts` (`supabase/server.ts` menyusul bersama admin), `status.ts`, `time.ts` (WIB), `queries.ts`, `types.ts`.
- [x] **T2.6 [K]** `components/ui/`: Button, Card, Badge, Stat, Skeleton, EmptyState, ErrorState. (`Tabs` dibuat saat pertama dibutuhkan.)
- [x] **T2.7 [K]** `/peta`: peta Leaflet (dynamic import, `ssr: false`), marker dari `v_camera_overview`, filter modul, legenda.
- [x] **T2.8 [K]** `/kamera/[id]`: snapshot terbaru, status, grafik kepadatan vs baseline, keadaan offline ("Offline sejak HH:MM").
- [x] **T2.9 [K]** Realtime `camera_status` + `SystemBanner` (worker tidak terlihat > 15 menit) + `FreshnessTag`.
- [x] **T2.13 [K]** Halaman `/mosaik`: grid snapshot terbaru semua kamera, saringan modul, hanya aktif, cari nama.
- [ ] **T2.10 [M+K]** Deploy pertama ke Vercel; isi env di dashboard Vercel. *Bukti:* link publik menampilkan peta dengan data nyata; tidak ada secret di bundle client.
- [x] **T2.11 [M]** Pilih 15–20 kamera air unggulan dan beberapa kamera lalu lintas unggulan (siang hari); tandai `is_featured`.

## Fase 3 — Modul air (Senin 12 Okt)

- [x] **T3.1 [K]** Admin: `/admin/login`, middleware cookie sesi, `/api/admin/login`.
- [x] **T3.2 [K]** `/admin/kamera`: tabel kamera + edit inline (`/api/admin/cameras/[id]`, validasi Zod).
- [x] **T3.3 [K]** `/admin/kalibrasi/[id]`: canvas ROI poligon, garis acuan N/W/S/A, simpan referensi siang/malam, catatan (`/api/admin/calibration/[id]`). Koordinat ternormalisasi 0..1.
- [x] **T3.4 [M]** Kalibrasi kamera unggulan (±5 menit per kamera).
- [x] **T3.5 [K]** `analyzers/water.py`: `change_score()` (SSIM di ROI), `should_call_ai()` (change / rain / heartbeat), batas `AI_DAILY_CALL_CAP`.
- [x] **T3.6 [M+K]** Pilih model OpenAI dari dokumentasi terbaru, isi `OPENAI_VISION_MODEL` dan `OPENAI_TEXT_MODEL`. Dipilih `gpt-6-luna` untuk keduanya (input gambar + structured outputs, $0,10 / $0,50 per 1 juta token). Uji 10 Okt: gambar 512×290 dihitung ±190 token, jadi satu panggilan modul air ±$0,0002 dan 2.000 panggilan per hari ±$0,4. Akurasi diuji di T3.10; cadangan untuk kasus sulit: naikkan `reasoning.effort`, lalu `gpt-6.1-sol`.
- [x] **T3.7 [K]** `classify_with_ai()`: gambar ROI + garis acuan + referensi, structured outputs sesuai `ai/schemas/water_vision.schema.json`, validasi Pydantic, gagal → `tidak_dapat_dinilai`.
- [x] **T3.8 [K]** `fusion/smoothing.py`: konfirmasi naik (2 pembacaan), turun (3 pembacaan), keyakinan rendah → `needs_verification`. Unit test.
- [ ] **T3.9 [K]** `sources/openmeteo.py`: ingest per `weather_grid` tiap 30 menit; peringatan `heavy_rain`.
- [ ] **T3.10 [K]** Uji klasifikasi siang dan malam; sesuaikan prompt dan ambang. Siang selesai 11 Okt (16 kamera, semua `normal`, prompt dan gambar anotasi disesuaikan); **malam belum diuji**.
- [ ] **T3.11 [M]** Simpan foto referensi malam untuk 16 kamera unggulan (setelah gelap, satu klik per kamera). *Bukti:* `water_readings` terisi dengan status dan alasan yang masuk akal.

## Fase 4 — Fusi + insight (Selasa 13 Okt)

- [ ] **T4.1 [K]** `fusion/trend.py` dan `fusion/risk.py` (komponen dan bobot disimpan di `risk_components`). Unit test.
- [ ] **T4.2 [K]** `alerts.py`: `upsert_alert` / `resolve_alert`, satu aktif per (jenis, kamera), teks dari template.
- [ ] **T4.3 [K]** `/admin/sungai` + `/api/admin/river-links`; `fusion/upstream.py` (peringatan hulu → hilir, belajar jeda).
- [ ] **T4.4 [M]** Isi `river_links` untuk sistem sungai kamera unggulan.
- [ ] **T4.5 [K]** `fusion/events.py`: buka, perbarui puncak, tutup kejadian.
- [ ] **T4.6 [K]** `fusion/cross_module.py`: genangan → lalu lintas (kamera ganda + radius 1 km), simpan `events.traffic_impact`.
- [ ] **T4.7 [K]** `insights.py`: insight situasi 15 menit (lewati LLM jika tidak ada perubahan), validasi `insight.schema.json`.
- [ ] **T4.8 [K]** `/air`: daftar kamera urut risiko, diagram hulu → hilir, hujan per grid, kejadian aktif.
- [ ] **T4.9 [K]** `/` "Denyut Kota": kartu angka, insight terbaru, peringatan aktif, peta mini.

## Fase 5 — Kelengkapan + keandalan (Rabu 14 Okt)

- [ ] **T5.1 [K]** `/lalu-lintas`: peta kepadatan, daftar anomali, grafik hari ini vs baseline.
- [ ] **T5.2 [K]** `/riwayat` + `/api/export/events` (CSV).
- [ ] **T5.3 [K]** `/tentang`: cara kerja, atribusi PANTAUSEMAR, batasan, privasi.
- [ ] **T5.4 [K]** `/replay` dan `/replay/[eventId]`: slider waktu, snapshot, status, kecepatan 1×–60×.
- [ ] **T5.5 [M+K]** Pindahkan worker ke VPS (systemd, `Restart=always`). *Bukti:* berjalan stabil semalaman.
- [ ] **T5.6 [K]** Audit empat keadaan (memuat, kosong, error, usang) di semua komponen data; uji mematikan worker.
- [ ] **T5.7 [K]** `scripts/export_eval_sample.py` + `/admin/label` + `/api/admin/labels`.
- [ ] **T5.8 [K]** Job malam baseline (`scripts/backfill_baselines.py`) dan sinkronisasi kamera harian (`sources/pantausemar.py`).

## Fase 6 — Evaluasi, dokumen, video (Kamis 15 Okt)

- [ ] **T6.1 [M]** Label ±200 sampel (siang dan malam).
- [ ] **T6.2 [K]** `/admin/evaluasi`: akurasi keseluruhan, siang/malam, per kamera, confusion matrix.
- [ ] **T6.3 [K]** `/admin/sistem`: heartbeat, panggilan AI hari ini, error terbaru.
- [ ] **T6.4 [K]** Perbaiki bug kritis saja; bekukan fitur.
- [ ] **T6.5 [K]** README lengkap: arsitektur, cara menjalankan, env, keterbatasan, atribusi data.
- [ ] **T6.6 [M]** Laporan penyisihan sesuai template panitia (kerangka di `09-demo-evaluation-report.md`).
- [ ] **T6.7 [M]** Rekam video demo.
- [ ] **T6.8 [M]** Surat pernyataan orisinalitas bermaterai, discan.

## Fase 7 — Pengumpulan (Jumat 16 Okt)

- [ ] **T7.1 [M]** Cek link deploy dari perangkat lain dan jaringan seluler; cek repo publik bisa dibuka.
- [ ] **T7.2 [M]** Kumpulkan laporan, link repo, link deploy, video, scan surat orisinalitas.

## Arah visual: insight dulu (keputusan 11 Okt)

Lihat `06-web-spec.md`. Kamera menjadi lapisan bukti; Beranda dan Peta dibangun ulang per wilayah.

- [ ] **TV.1 [K]** Data batas 16 kecamatan (GeoJSON) di `data/`, dengan sumber dan lisensinya.
- [ ] **TV.2 [K]** Pemetaan kamera → kecamatan dan agregat per kecamatan (risiko air, indeks kepadatan, jumlah titik pantau).
- [ ] **TV.3 [K]** Peta tematik: choropleth risiko air, lapisan kepadatan (heatmap radius kecil atau lingkaran proporsional), hujan per wilayah; titik kamera sebagai lapisan tambahan.
- [ ] **TV.4 [K]** Panel wilayah: tren 24 jam, temuan, jumlah titik pantau, tautan "lihat buktinya".
- [ ] **TV.5 [K]** Beranda insight: kalimat kondisi kota, peta kecamatan, kartu insight Kondisi → Penyebab → Dampak → Tindakan (menggantikan cakupan T4.9).
- [ ] **TV.6 [K]** Heatmap jam × hari di `/lalu-lintas` (bagian dari T5.1).
- [ ] **TV.7 [K]** Menu utama berisi halaman insight; `/kamera` dan `/mosaik` pindah ke kelompok "Sumber data".

## Fitur tambahan terpilih

Dari `11-feature-backlog.md` dan `12-emisi-kualitas-udara.md`. Dikerjakan setelah target inti hari itu tercapai.

- [ ] **TX.1 [K]** Halaman jaringan CCTV: ketersediaan per kamera dan per dinas, kamera mati lebih dari 24 jam (Selasa).
- [ ] **TX.2 [K]** Peringatan dini BMKG (nowcast) sebagai banner dan prakiraan BMKG per kecamatan (Selasa).
- [ ] **TX.3 [K]** Kartu "Kondisi luar ruang": kualitas udara, suhu terasa, UV, hujan dari Open-Meteo (Selasa).
- [ ] **TX.4 [K]** Halaman "Cara Kerja AI" (Rabu, setelah modul air jadi).
- [ ] **TX.5 [K]** Lapisan rob dari Open-Meteo Marine (Rabu, jika waktu cukup).
- [ ] **TX.6 [K]** Uji kelayakan hitungan arus dari klip video (2–3 klip siang dan malam, hitung manual) sebelum memutuskan modul emisi.

## Ditunda sampai setelah penyisihan (17–25 Okt)

- [ ] Integrasi desain final (ganti token dan isi `components/ui/`).
- [ ] Asisten AI (`/api/assistant`, function calling, rate limit).
- [ ] `/ruang-publik`, `/insight`, laporan harian otomatis.
- [ ] Modul sampah penuh dan analisis pompa IN/OUT.
- [ ] Baseline penuh (≥ 7 hari data) dan evaluasi ulang.
- [ ] Uji usability 3–5 orang; presentasi dan rencana cadangan offline.

## Jalur kritis

Yang paling tidak boleh terlambat, karena tidak bisa dikejar dengan menulis kode lebih cepat:

1. **T1.11 worker merekam malam ini.** Baseline, kalibrasi, replay, dan evaluasi semuanya bergantung pada data yang terkumpul.
2. **T2.11 + T3.4 kalibrasi kamera unggulan.** Hanya bisa dilakukan siang hari dan harus selesai sebelum modul air bisa diuji.
3. **T6.1 pelabelan.** Angka akurasi di laporan bergantung padanya.

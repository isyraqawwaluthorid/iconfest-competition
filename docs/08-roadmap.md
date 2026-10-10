# 08 — Roadmap

**Tenggat penyisihan: Jumat, 16 Oktober 2026** (jam batas belum diketahui; tanyakan panitia dan targetkan pengumpulan Kamis malam).
**Final luring: Senin, 26 Oktober 2026.**

Prinsip: **data mulai terkumpul hari pertama**, deploy sejak awal, fitur ditambah di atas sistem yang sudah berjalan. Tiap hari diakhiri dengan versi yang bisa dibuka di link deploy.

## Fase 1 — Penyisihan (10–16 Okt)

### Sabtu 10 Okt (malam) — Fondasi + mulai merekam
- [ ] Repo GitHub (monorepo `web/`, `worker/`, `supabase/`, `docs/`, `data/`), README awal, `.gitignore`, `.env.example`.
- [ ] Proyek Supabase: jalankan `schema.sql` lalu `seed_cameras.sql`.
- [ ] Worker minimal: akuisisi + kesehatan + kualitas + simpan frame lokal + unggah `latest/` + `camera_status` + heartbeat.
- [ ] **Jalankan worker di laptop malam ini** untuk semua kamera aktif (data mentah untuk baseline, kalibrasi, dan evaluasi).
- [ ] Kirim email permohonan izin ke Diskominfo Kota Semarang.

**Selesai jika:** `camera_status` terisi untuk 146 kamera, snapshot terbaru ada di Storage, frame lokal bertambah tiap 5 menit.

### Minggu 11 Okt — Lalu lintas + web dasar + deploy
- [ ] Penganalisis YOLO (traffic + crowd) → `traffic_readings`, baseline sementara (median 24 jam), indeks kepadatan.
- [ ] Scaffold Next.js, design tokens placeholder, komponen `ui/`.
- [ ] Halaman `/peta` (marker dari `v_camera_overview`, filter modul) dan `/kamera/[id]` (snapshot, status, grafik kepadatan).
- [ ] Realtime `camera_status`; banner status sistem.
- [ ] **Deploy pertama ke Vercel.**
- [ ] Pilih 15–20 kamera air unggulan (siang hari, sudut jelas, ada benda tetap sebagai acuan) dan beberapa kamera lalu lintas unggulan.

### Senin 12 Okt — Modul air
- [ ] Halaman admin: login, `/admin/kamera`, **`/admin/kalibrasi/[id]`** (ROI, garis acuan, referensi siang/malam).
- [ ] Kalibrasi kamera unggulan (±5 menit/kamera).
- [ ] Deteksi perubahan (SSIM) + klasifikasi AI vision (schema) + penghalusan + `water_readings`.
- [ ] Ingest Open-Meteo per grid.
- [ ] Uji klasifikasi pada sampel **siang dan malam** sejak awal; sesuaikan prompt dan ambang.

### Selasa 13 Okt — Fusi + insight
- [ ] Tren, skor risiko (komponen terbuka), `river_links` (admin `/admin/sungai`), peringatan hulu → hilir.
- [ ] Peringatan (template) + `/air` dengan diagram hulu → hilir.
- [ ] Kejadian (events) dan **insight lintas modul genangan → lalu lintas** (12 kamera ganda + radius 1 km).
- [ ] Insight situasi 15 menit (LLM) → beranda `/` "Denyut Kota".

### Rabu 14 Okt — Kelengkapan + keandalan
- [ ] `/lalu-lintas`, `/riwayat` (+ unduh CSV), `/tentang` (cara kerja, atribusi, batasan, privasi).
- [ ] **Mode replay** untuk kejadian yang sudah terekam (jika belum ada hujan, siapkan replay dari kejadian terkuat yang ada).
- [ ] Pindahkan worker ke **VPS** (systemd), pastikan berjalan stabil semalaman.
- [ ] Penanganan semua keadaan kosong/error/offline; uji mematikan worker.
- [ ] Ekspor sampel evaluasi; mulai melabeli (`/admin/label`).

### Kamis 15 Okt — Evaluasi, dokumen, video
- [ ] Label ±200 sampel, halaman `/admin/evaluasi`, catat akurasi siang/malam dan confusion matrix.
- [ ] Perbaiki bug kritis saja. Bekukan fitur.
- [ ] README lengkap (arsitektur, cara menjalankan, env, keterbatasan, atribusi data).
- [ ] Laporan penyisihan sesuai template panitia (lihat `09-demo-evaluation-report.md`).
- [ ] Rekam video demo.
- [ ] Surat pernyataan orisinalitas ditandatangani ketua tim di atas materai, lalu discan.

### Jumat 16 Okt — Cadangan + pengumpulan
- [ ] Cek ulang link deploy dari perangkat lain/jaringan seluler; cek repo publik dan bisa dibuka.
- [ ] Kumpulkan: laporan, link repo, link deploy, video, scan surat orisinalitas.

### Ukuran "progres ≥75%" yang realistis
Pipeline end-to-end berjalan nyata (akuisisi → analisis → database → web), modul air dan lalu lintas aktif, insight dan peringatan muncul, deploy publik stabil. Yang boleh belum selesai: asisten AI, modul sampah penuh, analisis pompa IN/OUT, desain final.

## Fase 2 — Menuju final (17–25 Okt)

Prioritas sesuai bobot final (Teknis 45%, UI/UX 30%, Penyampaian 25%):
1. **Integrasi desain final** dari desainer (ganti token dan komponen `ui/`).
2. **Stabilitas:** pantau worker, ketersediaan kamera, biaya AI; perbaiki kasus tepi.
3. **Asisten AI** (function calling, rate limit).
4. **Modul sampah** penuh dan **analisis pompa IN/OUT** (perbandingan kondisi sisi masuk dan keluar).
5. **Baseline penuh** (≥7 hari data) dan evaluasi ulang dengan sampel lebih besar.
6. Laporan harian otomatis yang bisa dibagikan.
7. Uji usability dengan 3–5 orang awam; perbaiki bagian yang membingungkan.
8. Presentasi 20 menit + skenario demo 15 menit + rencana cadangan offline (video, replay, data lokal).

## Risiko utama dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Tidak ada hujan sampai tenggat → tidak ada kejadian nyata | Rekam sejak hari pertama; mode replay; demo kalibrasi dan klasifikasi pada kondisi normal; jelaskan rencana validasi |
| Akurasi malam rendah | Uji dini; tampilkan "tidak dapat dinilai" alih-alih tebakan; laporkan akurasi siang/malam terpisah |
| PANTAUSEMAR berubah/mati | Sinkronisasi dengan log jelas; data historis tetap; sumber dipisah per modul; cadangan Jogja |
| Kredit OpenAI habis | Deteksi perubahan lokal, `AI_DAILY_CALL_CAP`, hanya kamera unggulan, spending limit |
| Worker mati saat juri membuka | systemd `Restart=always`, banner status, data terakhir tetap tampil |
| Waktu habis | Ikuti urutan prioritas (perekaman data → modul air dan lalu lintas → peringatan dan insight → halaman pendukung → fitur tambahan); fitur yang belum stabil disembunyikan di balik flag |

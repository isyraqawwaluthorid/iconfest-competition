# 10 — Tasklist Pengembangan

Dokumen acuan untuk memantau progres: apa yang sudah selesai, apa yang tertinggal, dan apa yang dikerjakan berikutnya. Turunan rinci dari `08-roadmap.md`; urutan kerja mengikuti `15-pengantar-lanjutan.md`.

**Terakhir diperbarui: Senin, 12 Oktober 2026, 14.30 WIB.** Diperbarui setiap kali satu bagian pekerjaan selesai.

Cara membaca:
- `[x]` selesai dan ada buktinya. `[ ]` belum selesai.
- **Sebagian** = sudah berjalan tetapi belum memenuhi bukti selesai; yang kurang disebut di barisnya.
- **[K]** = tugas kode. **[M]** = tugas manual pemilik proyek (akun, kunci, kalibrasi, label, dokumen lomba).
- Centang hanya diberikan setelah bukti selesai terpenuhi.

## 1. Ringkasan progres

| Bagian | Selesai | Sebagian | Belum | Jadwal semula |
|---|---|---|---|---|
| Fase 0 — Prasyarat | 5 dari 7 | – | 2 (manual) | sebelum 10 Okt |
| Fase 1 — Worker dasar dan perekaman | 15 dari 16 | – | 1 (belum perlu) | Sab 10 Okt |
| Fase 2 — Lalu lintas, web dasar, deploy | 12 dari 14 | – | 2 | Min 11 Okt |
| Fase 3 — Modul air | 11 dari 14 | 2 | 1 (manual) | Sen 12 Okt |
| Fase 4 — Fusi dan insight | 4 dari 9 | – | 5 | Sel 13 Okt |
| Fase 5 — Kelengkapan dan keandalan | 0 dari 8 | 1 | 7 | Rab 14 Okt |
| Fase 6 — Evaluasi, dokumen, video | 0 dari 8 | 1 | 7 | Kam 15 Okt |
| Fase 7 — Pengumpulan | 0 dari 4 | – | 4 | Jum 16 Okt |
| Arah visual (TV) | 5 dari 7 | 1 | 1 | – |
| **Jumlah inti** | **52 dari 87 (60%)** | **5** | **30** | |
| Fitur tambahan (TX) | 0 dari 6 | – | 6 | setelah inti |

Hitungan per tugas di atas tidak sama dengan "progres 75%" versi lomba. Ukuran yang dipakai `08-roadmap.md` adalah: pipeline berjalan nyata dari kamera sampai web, modul air dan lalu lintas aktif, insight dan peringatan muncul, dan deploy publik stabil. Dari empat hal itu, **tiga sudah terpenuhi; yang belum adalah deploy publik.**

Keadaan sistem saat dokumen ini diperbarui: worker berjalan di PC (13 siklus tanpa jeda sejak pindah pukul 12.51 WIB), 146 kamera direkam tiap 5 menit, 20 lokasi air dinilai AI, 20.849 pembacaan lalu lintas dan 782 penilaian air tersimpan, insight AI pertama tertulis pukul 13.31 WIB.

## 2. Posisi terhadap definisi "selesai" penyisihan

| Syarat (dari `CLAUDE.md`) | Posisi | Yang kurang |
|---|---|---|
| Worker berjalan terus, merekam semua kamera aktif tiap 5 menit | Sebagian | Berjalan di PC yang menetap, bukan VPS; belum terbukti semalaman di PC |
| Modul air: kalibrasi 15–20 kamera, klasifikasi AI, status terkonfirmasi, tren, peringatan hulu–hilir | Sebagian | Peringatan hulu–hilir (T4.3, T4.4) |
| Modul lalu lintas: hitungan YOLO, baseline, indeks kepadatan, anomali | Sebagian | Pembanding per jam sudah berjalan (T2.14), tetapi masih sementara sampai ada tiga hari data sejenis; anomali menyala sendiri setelah itu |
| Hujan Open-Meteo dan minimal satu insight lintas modul | Sebagian | Hujan sudah; insight lintas modul genangan → lalu lintas belum (T4.6) |
| Website ter-deploy: beranda, peta, panel kamera, Air, Lalu Lintas, peringatan, riwayat | Sebagian | Deploy (T2.10); halaman Air, Lalu Lintas, Riwayat (T4.8, T5.1, T5.2) |
| Ringkasan atau insight AI otomatis | **Selesai** | – |
| Penanganan kamera mati, worker offline, data kosong | Sebagian | Audit menyeluruh belum dilakukan (T5.6) |
| README lengkap, video demo, laporan | Belum | README baru sebagian (T6.5); video dan laporan belum (T6.6, T6.7) |

## 3. Yang tertinggal dari jadwal

Tugas yang hari jadwalnya sudah lewat atau jatuh hari ini, dan belum selesai:

| Tugas | Jadwal | Keadaan | Dampak bila terus tertunda |
|---|---|---|---|
| **T2.10** Deploy ke Vercel | Min 11 Okt | Belum; ditunda pemilik proyek 12 Okt | Juri membuka tautan, bukan `localhost`. Paling berisiko bila dikerjakan mendekati tenggat |
| **T3.10** Uji klasifikasi malam | Sen 12 Okt | Sebagian | Akurasi malam belum pernah diperiksa terhadap penilaian manusia |
| **T3.11** Foto referensi | Sen 12 Okt | Sebagian | Tanpa referensi yang sesuai waktu, keyakinan AI turun |
| **T2.12** Evaluasi hitungan YOLO siang | Min 11 Okt | Belum | Angka kendaraan belum pernah dibandingkan dengan hitungan manual |
| **T0.6** Email izin ke Diskominfo | sebelum 10 Okt | Belum [M] | Dasar pemanfaatan data untuk laporan |
| **T0.7** Jam tenggat dan template laporan | sebelum 10 Okt | Belum [M] | Laporan tidak bisa disusun tanpa template |

## 4. Rencana sampai tenggat

Usulan urutan, mengikuti `15-pengantar-lanjutan.md` dan temuan 12 Okt. Target pengumpulan: **Kamis malam**, supaya Jumat menjadi cadangan.

**Tabel ini urutan kerja, bukan kalender.** Keputusan pemilik proyek 12 Okt: apa pun yang sudah bisa dikerjakan langsung dikerjakan tanpa menunggu harinya, supaya sisa waktu sebelum pengumpulan bisa dipakai untuk evaluasi. Kolom hari adalah batas paling lambat.

| Paling lambat | Dikerjakan | Butuh pemilik proyek |
|---|---|---|
| Sen 12 Okt (sisa hari) | ~~T2.14 pembanding lalu lintas per jam~~ (selesai); usulan pasangan hulu–hilir untuk T4.4 | Simpan referensi malam yang kurang (T3.11) setelah gelap |
| Sel 13 Okt | T2.10 deploy; T4.3 hulu–hilir; T5.4 cara mendemokan kejadian; TV.4 tren 24 jam | Akun Vercel; persetujuan pasangan hulu–hilir (T4.4); referensi siang 4 kamera jalan (T3.11) |
| Rab 14 Okt | T4.5 kejadian; T4.6 insight lintas modul; T5.6 audit keadaan kosong dan error; T5.3 halaman Tentang; T6.5 README | Template laporan dari panitia (T0.7) |
| Kam 15 Okt | Perbaikan bug saja (T6.4); T6.6 laporan; T6.7 video; T7.3 repo publik; T7.4 ganti kunci | Laporan, video, surat bermaterai (T6.8), pengumpulan |
| Jum 16 Okt | Cadangan; T7.1 cek tautan dari perangkat lain; T7.2 pengumpulan bila belum | Pengumpulan |

**Kandidat digeser ke 17–25 Okt** (menunggu keputusan pemilik proyek; `15-pengantar-lanjutan.md` menyarankan digeser, sedangkan definisi "selesai" di `CLAUDE.md` masih memuat tiga halaman pertama): T4.8 `/air`, T5.1 `/lalu-lintas`, T5.2 `/riwayat`, T5.7 alat label, T6.1 dan T6.2 evaluasi akurasi, T5.5 VPS, T5.8 sinkronisasi kamera harian, dan semua TX.

## 5. Menunggu pemilik proyek

| Tugas | Paling lambat | Keterangan |
|---|---|---|
| **T3.11** Referensi malam: Banger-IN, Semarang Indah_IN, DPU-Mberok2-OUT | Sen 12 Okt malam | Satu klik per kamera di halaman kalibrasi, setelah gelap |
| **T3.11** Referensi siang: JRAKAH, SP. AKPOL, Jembatan Mberok, DPU_Pahlawan | Sel 13 Okt siang | Sama, pada siang hari |
| **T3.13** Memeriksa tiga kalibrasi yang diubah atau diragukan 12 Okt | Sel 13 Okt | KP.Kali-OUT, Kartini-OUT, IPdome-Polder Tawang; rinciannya di tabel kalibrasi per kamera |
| **T2.10** Akun Vercel dan langkah deploy | Sel 13 Okt | Dipandu langkah demi langkah |
| **T4.4** Menyetujui usulan pasangan hulu–hilir | Sel 13 Okt | Usulan disusun dari nama dan lokasi kamera |
| **T0.7** Jam tenggat dan template laporan dari panitia | Sel 13 Okt | CP Software Development ada di `MULAI-DI-SINI.md` |
| **T0.6** Email izin ke Diskominfo | Rab 14 Okt | |
| **T6.6, T6.7, T6.8** Laporan, video demo, surat bermaterai | Kam 15 Okt | Kerangka di `09-demo-evaluation-report.md`; siapkan materai |
| **T7.3, T7.4** Repo publik; ganti kunci Supabase dan sandi admin | Kam 15 Okt | Setelah mengganti kunci, `.env` di PC dan variabel di Vercel ikut diperbarui |
| **T6.1** Melabeli sampel evaluasi | setelah 16 Okt (usulan) | Menentukan angka akurasi di laporan final |

---

# Rincian per fase

## Fase 0 — Prasyarat

- [x] **T0.1 [M]** Pasang ffmpeg (`winget install Gyan.FFmpeg`), buka terminal baru. *Bukti:* `ffmpeg -version` jalan. Terpasang juga di PC (12 Okt).
- [x] **T0.2 [M]** Buat proyek Supabase; jalankan `supabase/schema.sql` lalu `supabase/seed_cameras.sql` di SQL Editor. *Bukti:* tabel `cameras` berisi 146 baris.
- [x] **T0.3 [M]** Pastikan bucket Storage `snapshots` (publik, baca saja) ada; `schema.sql` membuatnya otomatis. Saat membuat proyek, biarkan **Automatically expose new tables** aktif (skema tidak memuat `GRANT` sendiri) dan aktifkan **Enable automatic RLS**.
- [x] **T0.4 [M]** Salin `.env.example` → `.env`, isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_*`, `SUPABASE_STORAGE_BUCKET`.
- [x] **T0.5 [M]** Buat API key OpenAI khusus proyek (masa berlaku 30 hari, lewat final 26 Okt). Pastikan auto recharge mati agar pengeluaran tidak melewati kredit.
- [ ] **T0.6 [M]** Kirim email permohonan izin ke Diskominfo Kota Semarang.
- [ ] **T0.7 [M]** Tanyakan jam batas pengumpulan 16 Okt dan template laporan ke panitia.

## Fase 1 — Worker dasar dan perekaman (Sabtu 10 Okt)

Tujuan: data historis mulai terkumpul sejak malam pertama.

- [x] **T1.1 [K]** Scaffold `worker/`: paket `semarsight_worker`, `requirements.txt`, `config.py` (baca env, nilai default sesuai `05-worker-spec.md`), logging ke stdout.
- [x] **T1.2 [K]** `models.py`: Pydantic `CameraRow` dan tipe hasil siklus.
- [x] **T1.3 [K]** `db.py`: client Supabase (service role), `active_cameras()`, `log_health()`, `update_status()`, unggah Storage.
- [x] **T1.4 [K]** `acquisition.py`: `grab_frame()` lewat ffmpeg + timeout; status `live | frozen | dead`; deteksi beku (3 siklus berturut-turut).
- [x] **T1.5 [K]** `quality.py`: kecerahan, ketajaman, saturasi → `good | fair | poor`, `is_night`.
- [x] **T1.6 [K]** Simpan frame lokal `frames/{camera_id}/{YYYYMMDD}/{HHMMSS}.jpg`; unggah `latest/{camera_id}.jpg` (lebar maks. 960 px).
- [x] **T1.7 [K]** `housekeeping.py`: heartbeat ke `system_status`, retensi frame lokal.
- [x] **T1.8 [K]** `main.py`: siklus paralel (`MAX_CONCURRENCY`), `try/except` per kamera, flag `--once`, `--only-camera`, `--dry-run`, ringkasan per siklus di log.
- [x] **T1.9 [K]** Unit test: `quality.assess`, deteksi beku. *Bukti:* `pytest` hijau (131 uji per 12 Okt).
- [x] **T1.10 [K]** Uji `--once` terhadap 3 kamera nyata, lalu semua kamera aktif. *Bukti:* `camera_status` terisi, snapshot ada di Storage, baris `health_checks` bertambah.
- [x] **T1.11 [M]** Biarkan worker berjalan semalaman. Selesai: merekam sejak 10 Okt malam di laptop, dengan beberapa jeda (tercatat di `13-catatan-keputusan.md` bagian 9), lalu pindah ke PC 12 Okt. *Bukti:* 44.890 pemeriksaan kamera tersimpan, 34.018 di antaranya dalam 24 jam terakhir.
- [x] **T1.12 [K]** Kalibrasi `quality` dari arsip siang dan malam: `is_night` dari posisi matahari, kualitas dari ketajaman, proporsi gelap, dan mode IR.
- [x] **T1.14 [K]** Perbaiki deteksi beku: aturan dHash menandai 43 kamera hidup sebagai beku pada malam pertama; diganti sidik gambar persis sama (0 positif palsu pada 1.848 pasangan frame arsip).
- [x] **T1.15 [K]** Gangguan jaringan worker tidak dicatat sebagai kamera mati (ambang 40% kamera tanpa jawaban server); catatan palsu dari periode hotspot 11 Okt dibersihkan.
- [x] **T1.16 [K]** Keandalan worker (11–12 Okt): log ke berkas bergulir, mesin dijaga tidak tidur, satu siklus segera setelah mesin terbangun, klien Supabase memakai HTTP/1.1 (10–17% unggahan snapshot gagal dengan HTTP/2 di PC), skrip Windows untuk menyalakan dan memuat ulang, dan `scripts/status.py` untuk memeriksa keadaan.
- [ ] **T1.13 [K]** Retensi frame: kecualikan file yang direferensikan `labels` atau `events`. Belum perlu sebelum 24 Okt, saat frame pertama berumur 14 hari.

Hasil uji siklus penuh pertama (10 Okt, 18.52 WIB): 146 kamera dalam 58 detik, 131 `live`, 15 `dead`. Arsip frame resolusi penuh ±26 MB per siklus, atau ±7,5 GB per hari.

## Fase 2 — Lalu lintas, web dasar, deploy pertama (Minggu 11 Okt)

- [x] **T2.1 [K]** `analyzers/traffic.py`: YOLO11n singleton, hitung per kelas, filter ROI jalan (titik tengah-bawah kotak).
- [x] **T2.2 [K]** `fusion/baseline.py`: baseline sementara (median 24 jam bergulir), `density_index`, level `lancar/normal/ramai/padat`, `is_anomaly`. Unit test.
- [x] **T2.3 [K]** Sambungkan ke siklus: tulis `traffic_readings`, perbarui `camera_status`.
- [x] **T2.4 [K]** Scaffold `web/` (Next.js App Router, TypeScript strict, Tailwind), design tokens di `globals.css`.
- [x] **T2.5 [K]** `lib/`: `supabase/public.ts`, `supabase/server.ts`, `status.ts`, `time.ts` (WIB), `queries.ts`, `types.ts`.
- [x] **T2.6 [K]** `components/ui/`: Button, Card, Badge, Stat, Skeleton, EmptyState, ErrorState.
- [x] **T2.7 [K]** Peta kamera Leaflet (dynamic import, `ssr: false`), marker dari `v_camera_overview`, filter modul, legenda. Kini di `/kamera`.
- [x] **T2.8 [K]** `/kamera/[id]`: snapshot terbaru, status, grafik kepadatan vs baseline, keadaan offline ("Offline sejak HH:MM").
- [x] **T2.9 [K]** Realtime `camera_status` + `SystemBanner` (worker tidak terlihat > 15 menit) + `FreshnessTag`.
- [x] **T2.11 [M]** Pilih 15–20 kamera air unggulan dan beberapa kamera lalu lintas unggulan; tandai `is_featured`. *Bukti:* 20 kamera unggulan.
- [x] **T2.13 [K]** Halaman `/mosaik`: grid snapshot terbaru semua kamera, saringan modul, hanya aktif, cari nama.
- [ ] **T2.10 [M+K]** Deploy pertama ke Vercel; isi env di dashboard Vercel. *Bukti:* link publik menampilkan peta dengan data nyata; tidak ada secret di bundle client. **Tertinggal** (jadwal 11 Okt).
- [ ] **T2.12 [K]** Evaluasi hitungan YOLO pada siang hari (malam: sepeda motor kecil banyak terlewat); pertimbangkan model lebih besar atau ambang berbeda jika perlu. **Tertinggal.**
- [x] **T2.14 [K]** Pembanding lalu lintas per jam. Selesai 12 Okt: tiap titik dibandingkan dengan dirinya pada jam yang sama (±1 jam) di hari-hari sebelumnya, mengutamakan jenis hari yang sama; beranda, panel kecamatan, dan halaman kamera menyebut bila pembanding masih sementara. *Bukti:* pada data 12 Okt pukul 11.00–14.00, titik yang terbaca "padat" turun dari 68–70% menjadi ±16%. **Yang menyusul sendiri:** pembanding tidak lagi sementara, dan deteksi anomali menyala, setelah tiga hari data sejenis (hari kerja: sekitar Kamis 15 Okt).

## Fase 3 — Modul air (Senin 12 Okt)

- [x] **T3.1 [K]** Admin: `/admin/login`, cookie sesi, `/api/admin/login`.
- [x] **T3.2 [K]** `/admin/kamera`: tabel kamera + edit inline (`/api/admin/cameras/[id]`, validasi Zod).
- [x] **T3.3 [K]** `/admin/kalibrasi/[id]`: canvas ROI poligon, garis acuan N/W/S/A, simpan referensi siang/malam, catatan (`/api/admin/calibration/[id]`). Koordinat ternormalisasi 0..1.
- [x] **T3.4 [M]** Kalibrasi kamera unggulan. *Bukti:* 22 kamera terkalibrasi (8 pompa masuk, 8 pompa keluar, 2 kolam, 4 jalan).
- [x] **T3.5 [K]** `analyzers/water.py`: `change_score()` (SSIM di ROI), `should_call_ai()` (change / rain / heartbeat), batas `AI_DAILY_CALL_CAP`.
- [x] **T3.6 [M+K]** Pilih model OpenAI dari dokumentasi terbaru. Dipilih `gpt-6-luna` untuk vision dan teks ($0,10 / $0,50 per 1 juta token). Satu panggilan modul air ±$0,0002–0,0003.
- [x] **T3.7 [K]** `classify_with_ai()`: gambar ROI + garis acuan + referensi, structured outputs sesuai `ai/schemas/water_vision.schema.json`, validasi Pydantic, gagal → `tidak_dapat_dinilai`.
- [x] **T3.8 [K]** `fusion/smoothing.py`: konfirmasi naik (2 pembacaan), turun (3 pembacaan), keyakinan rendah → `needs_verification`. Unit test.
- [x] **T3.9 [K]** `sources/openmeteo.py`: ingest per `weather_grid` tiap 30 menit; 9 titik dalam satu permintaan; pemicu hujan modul air aktif.
- [ ] **T3.10 [K]** Uji klasifikasi siang dan malam; sesuaikan prompt dan ambang. **Sebagian.** Siang selesai 11 Okt (prompt dan gambar anotasi disesuaikan; dua salah baca diperbaiki lewat kalibrasi). Malam: worker sudah membuat 453 penilaian malam (448 normal, 4 waspada, 1 tidak dapat dinilai; keyakinan rata-rata 0,74 dibanding 0,80 pada siang hari), tetapi **belum pernah diperiksa terhadap penilaian manusia**.
- [ ] **T3.11 [M]** Simpan foto referensi untuk kamera terkalibrasi. **Sebagian:** 19 dari 22 punya referensi malam dan 18 dari 22 punya referensi siang. Kurang referensi malam: Banger-IN, Semarang Indah_IN, DPU-Mberok2-OUT. Kurang referensi siang: JRAKAH, SP. AKPOL, Jembatan Mberok, DPU_Pahlawan.
- [x] **T3.12 [K]** Pemeriksaan salah baca 12 Okt. Ke-22 penilaian bukan normal sejak 11 Okt ditinjau (yang terjadi 12 Okt dari gambar buktinya, sisanya lewat nilai ulang); tidak ada yang menunjukkan kejadian nyata. Hasil: pembacaan naik butuh keyakinan ≥ 0,65 agar dihitung; referensi siang Kartini-OUT dan KP.Kali-OUT diganti dengan keadaan normal yang paling tinggi (foto lama dicadangkan); garis W/S KP.Kali-OUT yang tertukar dibetulkan; `scripts/replay_readings.py` untuk menilai ulang gambar bukti. *Bukti:* nilai ulang 130 gambar dari 20 lokasi tidak lagi menghasilkan pembacaan naik (sebelumnya 8).
- [x] **T3.14 [K]** Halaman kalibrasi menolak garis acuan yang urutannya tertukar, dan menampilkan sebabnya.
- [ ] **T3.13 [M]** Periksa kalibrasi yang diubah atau diragukan 12 Okt (lihat tabel di bawah): setujui atau ganti referensi baru KP.Kali-OUT dan Kartini-OUT; naikkan sedikit garis N di IPdome-Polder Tawang.

### Kalibrasi dan referensi per kamera (keadaan 12 Okt, 14.30 WIB)

Garis: N = normal, W = waspada, S = siaga, A = awas. Kamera jalan memang tidak memakai garis. "Keyakinan" adalah rata-rata keyakinan AI siang / malam sejak 11 Okt.

| Kamera | Jenis | Garis | Ref. siang | Ref. malam | Keyakinan | Catatan dan tindak lanjut |
|---|---|---|---|---|---|---|
| Banger-SD-IN | pompa masuk | N S A | ada | ada | 0,77 / 0,75 | Dikalibrasi ulang 11 Okt; stabil sejak itu |
| Bulu Drain-IN | pompa masuk | N W S A | ada | ada | 0,81 / 0,75 | Baik |
| Kartini-IN | pompa masuk | N W S A | ada | ada | 0,78 / 0,73 | Satu "waspada" lemah 12 Okt; garis N berimpit dengan muka air. Pantau |
| Manggis-IN | pompa masuk | N W S A | ada | ada | 0,84 / 0,79 | Baik. Sampah terbaca banyak 12 Okt |
| Progo-IN | pompa masuk | N W S A | ada | ada | 0,84 / 0,80 | Baik |
| Trimulyo_Depan | pompa masuk | N W S A | ada | ada | 0,83 / 0,81 | Baik |
| Banger-IN | pompa masuk | N W S A | ada | **belum** | – | Bukan unggulan, jadi belum dinilai AI. Garis sangat rapat; perlu digambar ulang bila ingin dipakai |
| Semarang Indah_IN | pompa masuk | N W S A | ada | **belum** | – | Bukan unggulan, jadi belum dinilai AI |
| Bulu Drain-OUT | pompa keluar | N W S A | ada | ada | 0,74 / 0,71 | Baik; 5 penilaian berkeyakinan rendah |
| DPU-Mberok2-OUT | pompa keluar | N W S A | ada | **belum** | 0,74 / **0,51** | Keyakinan malam terendah; 18 penilaian rendah. **Butuh referensi malam** |
| KP.Kali-OUT | pompa keluar | N W S A | **diganti 12 Okt** | ada | 0,72 / 0,71 | Garis W/S tertukar, dibetulkan. Referensi siang kini kanal penuh pukul 08.09. Sampah terbaca banyak. **Perlu disetujui (T3.13)** |
| KS-OUT-2 | pompa keluar | N W S A | ada | ada | 0,73 / 0,65 | Busa saat pompa menyala sempat terbaca "awas"; kini tertahan aturan keyakinan. Pantau |
| Kartini-OUT | pompa keluar | N W S A | **diganti 12 Okt** | ada | 0,78 / 0,76 | Referensi siang lama kolam kosong; kini kolam terisi pukul 13.13. **Perlu disetujui (T3.13)** |
| Progo-OUT | pompa keluar | N W S A | ada | ada | 0,81 / 0,75 | Baik |
| Semarang Indah_OUT | pompa keluar | N W S A | ada | ada | 0,71 / 0,66 | Busa pompa; 9 penilaian berkeyakinan rendah. Pantau |
| Trimulyo_OUT | pompa keluar | N W S A | ada | ada | 0,75 / 0,75 | Baik |
| IPdome-Polder Tawang | kolam | N W S A | ada | ada | 0,81 / 0,77 | Dua "waspada" 12 Okt karena garis N berimpit dengan muka air. **Naikkan garis N sedikit (T3.13)** |
| Jinunjung_Halaman | kolam | N W S A | ada | ada | 0,81 / 0,75 | Baik |
| DPU_Pahlawan | jalan | – | **belum** | ada | 0,95 / 0,90 | Butuh referensi siang |
| JRAKAH | jalan | – | **belum** | ada | 0,88 / 0,82 | Butuh referensi siang |
| Jembatan Mberok | jalan | – | **belum** | ada | 0,87 / 0,79 | Butuh referensi siang |
| SP. AKPOL | jalan | – | **belum** | ada | 0,91 / 0,63 | Butuh referensi siang. Malam hari gelap: 9 penilaian rendah, satu "waspada" lemah dari aspal mengilap |

## Fase 4 — Fusi dan insight (Selasa 13 Okt)

- [x] **T4.1 [K]** `fusion/trend.py` dan `fusion/risk.py` (komponen dan bobot disimpan di `risk_components`). Unit test. Komponen hulu masih 0 sampai T4.3.
- [x] **T4.2 [K]** `alerts.py`: satu aktif per (jenis, kamera), teks dari template: `water_rising`, `road_flooded`, `heavy_rain`, `trash_blockage`, `camera_offline`, diselaraskan tiap siklus. Jalur tulis baru teruji dengan hujan buatan; belum pernah ada kejadian air naik yang nyata.
- [x] **T4.7 [K]** `insights.py`: insight situasi dari LLM teks. Selesai 12 Okt: fakta dari `camera_status`, cuaca, dan peringatan; tingkat keseluruhan dari aturan; setiap angka di jawaban LLM diperiksa terhadap fakta sebelum disimpan; dipanggil hanya saat keadaan berubah atau tiap 60 menit; 22 unit test; `scripts/probe_insight.py` untuk uji tanpa menulis. Insight harian dan lintas modul belum (ikut T4.6).
- [x] **T4.9 [K]** Beranda "Denyut Kota". Digantikan cakupan TV.5, selesai 12 Okt.
- [ ] **T4.3 [K]** `/admin/sungai` + `/api/admin/river-links`; `fusion/upstream.py` (peringatan hulu → hilir, belajar jeda). *Bukti:* komponen hulu di skor risiko tidak lagi selalu 0.
- [ ] **T4.4 [M]** Isi `river_links` untuk sistem sungai kamera unggulan. Tabel masih kosong. Usulan pasangan disusun lebih dulu untuk disetujui.
- [ ] **T4.5 [K]** `fusion/events.py`: buka, perbarui puncak, tutup kejadian. Tabel `events` masih kosong.
- [ ] **T4.6 [K]** `fusion/cross_module.py`: genangan → lalu lintas (kamera ganda + radius 1 km), simpan `events.traffic_impact`, dan insight lintas modul. Bergantung pada T2.14 dan T4.5.
- [ ] **T4.8 [K]** `/air`: daftar kamera urut risiko, diagram hulu → hilir, hujan per grid, kejadian aktif. Kandidat digeser.

## Fase 5 — Kelengkapan dan keandalan (Rabu 14 Okt)

- [ ] **T5.1 [K]** `/lalu-lintas`: peta kepadatan, daftar anomali, grafik hari ini vs baseline. Kandidat digeser.
- [ ] **T5.2 [K]** `/riwayat` + `/api/export/events` (CSV). Kandidat digeser.
- [ ] **T5.3 [K]** `/tentang`: cara kerja, atribusi PANTAUSEMAR, batasan, privasi.
- [ ] **T5.4 [K]** Cara mendemokan kejadian: `/replay` dari kejadian terekam, atau data simulasi yang **ditandai jelas** (`source = synthetic`), supaya juri bisa melihat status naik, peringatan muncul, dan insight berubah. Belum pernah ada kejadian nyata, dan saat demo kemungkinan besar juga tidak ada.
- [ ] **T5.5 [M+K]** Pindahkan worker ke VPS (systemd, `Restart=always`). *Bukti:* berjalan stabil semalaman. **Sebagian** 12 Okt: worker dipindah dari laptop ke PC yang menetap (mulai 12.51 WIB, mesin diatur tidak tidur); VPS belum, dan bukti semalaman menyusul 13 Okt pagi. Worker belum menyala sendiri setelah PC restart.
- [ ] **T5.6 [K]** Audit empat keadaan (memuat, kosong, error, usang) di semua komponen data; uji mematikan worker.
- [ ] **T5.7 [K]** `scripts/export_eval_sample.py` + `/admin/label` + `/api/admin/labels`. Kandidat digeser.
- [ ] **T5.8 [K]** Sinkronisasi kamera harian (`sources/pantausemar.py`) dan job malam baseline. Bagian baseline dikerjakan lebih dulu sebagai T2.14.

## Fase 6 — Evaluasi, dokumen, video (Kamis 15 Okt)

- [ ] **T6.1 [M]** Label ±200 sampel (siang dan malam). Tabel `labels` masih kosong. Kandidat digeser.
- [ ] **T6.2 [K]** `/admin/evaluasi`: akurasi keseluruhan, siang/malam, per kamera, confusion matrix. Kandidat digeser.
- [ ] **T6.3 [K]** `/admin/sistem`: heartbeat, panggilan AI hari ini, error terbaru. Sementara ini tersedia lewat `scripts/status.py`.
- [ ] **T6.4 [K]** Perbaiki bug kritis saja; bekukan fitur.
- [ ] **T6.5 [K]** README lengkap: arsitektur, cara menjalankan, env, keterbatasan, atribusi data. **Sebagian:** struktur repo, stack, konfigurasi, dan cara menjalankan sudah ada; arsitektur, keterbatasan, dan atribusi data belum.
- [ ] **T6.6 [M]** Laporan penyisihan sesuai template panitia (kerangka di `09-demo-evaluation-report.md`).
- [ ] **T6.7 [M]** Rekam video demo.
- [ ] **T6.8 [M]** Surat pernyataan orisinalitas bermaterai, discan.

## Fase 7 — Pengumpulan (Jumat 16 Okt)

- [ ] **T7.1 [M]** Cek link deploy dari perangkat lain dan jaringan seluler; cek repo publik bisa dibuka.
- [ ] **T7.2 [M]** Kumpulkan laporan, link repo, link deploy, video, scan surat orisinalitas.
- [ ] **T7.3 [M]** Jadikan repo publik sebelum 16 Okt, setelah memastikan tidak ada rahasia di riwayat commit.
- [ ] **T7.4 [M]** Ganti kunci rahasia Supabase dan `ADMIN_PASSWORD`; perbarui `.env` di PC dan variabel di Vercel. Kunci OpenAI berlaku 30 hari sejak dibuat.

## Arah visual: insight dulu (keputusan 11 Okt)

Lihat `06-web-spec.md`. Kamera menjadi lapisan bukti; beranda dan peta disusun per wilayah.

- [x] **TV.1 [K]** Data batas 16 kecamatan (GeoJSON) dari OpenStreetMap (ODbL), di `web/lib/geo/kecamatan-semarang.json`.
- [x] **TV.2 [K]** Pemetaan kamera → kecamatan dan agregat per kecamatan, dihitung di web (`lib/insight.ts`).
- [x] **TV.3 [K]** Peta tematik: risiko air, kepadatan lalu lintas, dan hujan per wilayah; sumber data sebagai titik kecil. Kepadatan memakai median per kecamatan, bukan heatmap.
- [x] **TV.5 [K]** Beranda insight. Selesai 12 Okt: kalimat kondisi kota dari aturan, peta kecamatan, dan tab "Insight" berisi kartu Kondisi → Penyebab → Dampak → Tindakan dari LLM; temuan AI juga tampil di panel kecamatan.
- [x] **TV.7 [K]** Menu utama berisi halaman insight; `/kamera` dan `/mosaik` masuk kelompok "Sumber data".
- [ ] **TV.4 [K]** Panel wilayah. **Sebagian:** kondisi air per lokasi, kepadatan, hujan, temuan AI, dan tautan ke kamera sudah ada; **tren 24 jam belum**.
- [ ] **TV.6 [K]** Matriks jam × hari di `/lalu-lintas` (bagian dari T5.1). Butuh beberapa hari data.

## Fitur tambahan terpilih

Dari `11-feature-backlog.md` dan `12-emisi-kualitas-udara.md`. Dikerjakan hanya setelah inti rapi.

- [ ] **TX.1 [K]** Halaman jaringan CCTV: ketersediaan per kamera dan per dinas, kamera mati lebih dari 24 jam.
- [ ] **TX.2 [K]** Peringatan dini BMKG (nowcast) sebagai banner dan prakiraan BMKG per kecamatan.
- [ ] **TX.3 [K]** Kartu "Kondisi luar ruang": kualitas udara, suhu terasa, UV, hujan dari Open-Meteo.
- [ ] **TX.4 [K]** Halaman "Cara Kerja AI".
- [ ] **TX.5 [K]** Lapisan rob dari Open-Meteo Marine.
- [ ] **TX.6 [K]** Uji kelayakan hitungan arus dari klip video (2–3 klip siang dan malam, hitung manual) sebelum memutuskan modul emisi.

## Ditunda sampai setelah penyisihan (17–25 Okt)

- [ ] Asisten AI (`/api/assistant`, function calling, rate limit).
- [ ] `/ruang-publik`, `/insight`, laporan harian otomatis.
- [ ] Modul sampah penuh dan analisis pompa IN/OUT.
- [ ] Baseline penuh (≥ 7 hari data) dan evaluasi ulang.
- [ ] Uji usability 3–5 orang; presentasi dan rencana cadangan offline.

## Jalur kritis

Yang paling tidak boleh terlambat, karena tidak bisa dikejar dengan menulis kode lebih cepat:

1. **T2.10 deploy.** Butuh akun dan pengaturan di luar kode; masalah yang muncul di Vercel baru terlihat setelah dicoba.
2. **T3.11 foto referensi.** Referensi malam hanya bisa diambil setelah gelap, referensi siang hanya pada siang hari.
3. **T0.7 template laporan** dan **T6.6–T6.8 dokumen lomba.** Bergantung pada panitia, materai, dan waktu pemilik proyek.
4. **Worker tetap hidup.** Baseline, tren, dan evaluasi bergantung pada data yang terus terkumpul; jeda tidak bisa diisi ulang.
5. **T6.1 pelabelan**, bila angka akurasi ingin masuk laporan penyisihan.

## Riwayat pembaruan

| Tanggal | Yang berubah |
|---|---|
| 10 Okt | Fase 0 dan sebagian besar Fase 1: worker merekam 146 kamera |
| 11 Okt | Fase 2 kecuali deploy; modul air end-to-end; tren, risiko, peringatan; arah visual "insight dulu" (TV.1–TV.3, TV.7) |
| 12 Okt | Worker pindah ke PC (T5.5 sebagian), perbaikan unggahan (T1.16); insight dari LLM dan tampilannya (T4.7, TV.5, T4.9); temuan pembanding lalu lintas (T2.14 ditambahkan); tasklist disusun ulang dengan ringkasan, daftar tertinggal, dan rencana |
| 12 Okt sore | Pemeriksaan salah baca modul air (T3.12, T3.14 selesai; T3.13 menunggu pemilik proyek); tabel kalibrasi dan referensi per kamera ditambahkan; rencana dijadikan urutan kerja, bukan kalender; pembanding lalu lintas per jam (T2.14 selesai) |

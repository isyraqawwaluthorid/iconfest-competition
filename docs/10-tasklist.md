# 10 — Tasklist Pengembangan

Dokumen acuan untuk memantau progres: apa yang sudah selesai, apa yang tertinggal, dan apa yang dikerjakan berikutnya. Turunan rinci dari `08-roadmap.md`; urutan kerja mengikuti `15-pengantar-lanjutan.md`.

**Terakhir diperbarui: Selasa, 13 Oktober 2026, 22.40 WIB.** Diperbarui setiap kali satu bagian pekerjaan selesai.

Cara membaca:
- `[x]` selesai dan ada buktinya. `[ ]` belum selesai.
- **Sebagian** = sudah berjalan tetapi belum memenuhi bukti selesai; yang kurang disebut di barisnya.
- **[K]** = tugas kode. **[M]** = tugas manual pemilik proyek (akun, kunci, kalibrasi, label, dokumen lomba).
- Centang hanya diberikan setelah bukti selesai terpenuhi.

## 1. Ringkasan progres

| Bagian | Selesai | Sebagian | Belum | Jadwal semula |
|---|---|---|---|---|
| Fase 0 — Prasyarat | 6 dari 7 | – | 1 (manual) | sebelum 10 Okt |
| Fase 1 — Worker dasar dan perekaman | 15 dari 16 | – | 1 (belum perlu) | Sab 10 Okt |
| Fase 2 — Lalu lintas, web dasar, deploy | 13 dari 14 | – | 1 | Min 11 Okt |
| Fase 3 — Modul air | 12 dari 15 | 2 | 1 (manual) | Sen 12 Okt |
| Fase 4 — Fusi dan insight | 8 dari 9 | 1 | 0 | Sel 13 Okt |
| Fase 5 — Kelengkapan dan keandalan | 4 dari 8 | 2 | 2 | Rab 14 Okt |
| Fase 6 — Evaluasi, dokumen, video | 1 dari 8 | 1 | 6 | Kam 15 Okt |
| Fase 7 — Pengumpulan | 0 dari 4 | – | 4 | Jum 16 Okt |
| Arah visual (TV) | 7 dari 8 | – | 1 | – |
| **Jumlah inti** | **66 dari 89 (74%)** | **6** | **17** | |
| Fitur tambahan (TX) | 4 dari 11 | – | 7 | setelah inti |

Hitungan per tugas di atas tidak sama dengan "progres 75%" versi lomba. Ukuran yang dipakai `08-roadmap.md` adalah: pipeline berjalan nyata dari kamera sampai web, modul air dan lalu lintas aktif, insight dan peringatan muncul, dan deploy publik stabil. Dari empat hal itu, **tiga sudah terpenuhi; yang belum adalah deploy publik.**

Keadaan sistem saat dokumen ini diperbarui: worker berjalan di PC (13 siklus tanpa jeda sejak pindah pukul 12.51 WIB), 146 kamera direkam tiap 5 menit, 20 lokasi air dinilai AI, 20.849 pembacaan lalu lintas dan 782 penilaian air tersimpan, insight AI pertama tertulis pukul 13.31 WIB.

## 2. Posisi terhadap definisi "selesai" penyisihan

| Syarat (dari `CLAUDE.md`) | Posisi | Yang kurang |
|---|---|---|
| Worker berjalan terus, merekam semua kamera aktif tiap 5 menit | Sebagian | Berjalan di PC yang menetap, bukan VPS; belum terbukti semalaman di PC |
| Modul air: kalibrasi 15–20 kamera, klasifikasi AI, status terkonfirmasi, tren, peringatan hulu–hilir | **Selesai** | Peringatan hulu–hilir berjalan untuk empat rumah pompa; belum pernah teruji oleh kejadian nyata |
| Modul lalu lintas: hitungan YOLO, baseline, indeks kepadatan, anomali | Sebagian | Pembanding per jam sudah berjalan (T2.14), tetapi masih sementara sampai ada tiga hari data sejenis; anomali menyala sendiri setelah itu. Sejak 12 Okt ruas dengan kurang dari 8 kendaraan tidak lagi disebut ramai atau padat |
| Hujan Open-Meteo dan minimal satu insight lintas modul | **Selesai** | Lintas modul genangan → lalu lintas berjalan sejak 13 Okt (T4.6). Kalimat dari AI baru memakainya setelah pembanding lalu lintas tidak lagi sementara; belum teruji oleh kejadian nyata |
| Website ter-deploy: beranda, peta, panel kamera, Air, Lalu Lintas, peringatan, riwayat | Sebagian | **Tinggal deploy (T2.10)**, ditunda lagi oleh pemilik proyek 13 Okt. Semua halamannya sudah ada |
| Ringkasan atau insight AI otomatis | **Selesai** | – |
| Penanganan kamera mati, worker offline, data kosong | Sebagian | Audit menyeluruh belum dilakukan (T5.6) |
| README lengkap, video demo, laporan | Sebagian | README selesai (T6.5); video dan laporan belum (T6.6, T6.7) |

## 3. Yang tertinggal dari jadwal

Tugas yang hari jadwalnya sudah lewat atau jatuh hari ini, dan belum selesai:

| Tugas | Jadwal | Keadaan | Dampak bila terus tertunda |
|---|---|---|---|
| **T2.10** Deploy ke Vercel | Min 11 Okt | Belum; **dijadwalkan pemilik proyek Rabu 14 Okt siang** | Juri membuka tautan, bukan `localhost`. Paling berisiko bila dikerjakan mendekati tenggat |
| **T3.10** Uji klasifikasi malam | Sen 12 Okt | Sebagian | Akurasi malam belum pernah diperiksa terhadap penilaian manusia |
| **T3.11** Foto referensi malam | Sen 12 Okt | Tinggal satu: Banger-IN (bukan unggulan). Dua lainnya disimpan 12 Okt pukul 18.27 | Tidak ada dampak selama Banger-IN tidak dinilai AI |
| **T0.6** Email izin ke Diskominfo | sebelum 10 Okt | Belum [M] | Dasar pemanfaatan data untuk laporan |

## 4. Rencana sampai tenggat

Usulan urutan, mengikuti `15-pengantar-lanjutan.md` dan temuan 12 Okt. Target pengumpulan: **Kamis malam**, supaya Jumat menjadi cadangan.

**Tabel ini urutan kerja, bukan kalender.** Keputusan pemilik proyek 12 Okt: apa pun yang sudah bisa dikerjakan langsung dikerjakan tanpa menunggu harinya, supaya sisa waktu sebelum pengumpulan bisa dipakai untuk evaluasi. Kolom hari adalah batas paling lambat.

| Paling lambat | Dikerjakan | Butuh pemilik proyek |
|---|---|---|
| Sen 12 Okt (sisa hari) | ~~T2.14 pembanding lalu lintas per jam~~, ~~T4.4 dan inti T4.3 hulu–hilir~~, ~~TV.4 tren 24 jam~~, ~~T5.1 halaman Lalu Lintas~~, ~~TX.7 heksagon aktivitas~~, ~~TX.8 beban emisi relatif~~, ~~referensi malam dua kamera (T3.11)~~ (selesai) | Melihat halaman Lalu lintas dan memberi masukan |
| Sel 13 Okt | T2.10 deploy; ~~T5.4 cara mendemokan kejadian~~, ~~T4.5 kejadian~~, ~~T5.2 riwayat~~ (selesai 12 Okt) | Akun Vercel |
| Rab 14 Okt | ~~T4.6 insight lintas modul~~ (selesai 13 Okt); T5.6 audit keadaan kosong dan error; ~~T5.3 halaman Tentang~~ (selesai 12 Okt); T6.5 README | Template laporan dari panitia (T0.7) |
| Kam 15 Okt | Perbaikan bug saja (T6.4); T6.6 laporan; T6.7 video; T7.3 repo publik; T7.4 ganti kunci | Laporan, video, surat bermaterai (T6.8), pengumpulan |
| Jum 16 Okt | Cadangan; T7.1 cek tautan dari perangkat lain; T7.2 pengumpulan bila belum | Pengumpulan |

**Masa peralihan model penghitung kendaraan (yolo11n → yolo11s, 13 Okt 16.29 WIB).** Pembanding lalu lintas dikumpulkan ulang dari nol, jadi:

| Kapan | Halaman Lalu lintas |
|---|---|
| Sel 13 sore sampai Rab 14 sekitar 17.30 | Ruas abu-abu, "pembanding sedang dikumpulkan"; daftar kanan menampilkan kendaraan terbanyak terlihat. **Jangan ambil tangkapan layar halaman ini untuk laporan pada hari Rabu** |
| Rab 14 sore, lalu Kam 15 sepanjang hari | Berwarna, berlabel "pembanding sementara" |
| Jum 16 (video demo dan pengumpulan) | Berwarna, masih "sementara"; ringkasan AI belum menyimpulkan lalu lintas |
| Sen 19 dan seterusnya (masa penjurian 16–25 Okt) | Pembanding matang pada hari kerja, bila worker tidak berhenti Rab–Jum |

Heksagon aktivitas ikut mulai dari nol dan terisi semua jam lagi pada Rabu malam. Bila model baru bermasalah, kembalikan `YOLO_MODEL=yolo11n.pt` di `.env` lalu muat ulang worker: hitungan lama masih tersimpan dan langsung dipakai lagi.

**Kandidat digeser ke 17–25 Okt** (menunggu keputusan pemilik proyek; `15-pengantar-lanjutan.md` menyarankan digeser, sedangkan definisi "selesai" di `CLAUDE.md` masih memuat tiga halaman pertama): T5.7 alat label, T6.1 dan T6.2 evaluasi akurasi, T5.5 VPS, T5.8 sinkronisasi kamera harian, dan semua TX.

## 5. Menunggu pemilik proyek

| Tugas | Paling lambat | Keterangan |
|---|---|---|
| **T5.1** Melihat halaman Lalu lintas (tiga lapisan) dan memberi masukan | Sel 13 Okt | `http://localhost:3000/lalu-lintas`: Ruas jalan, Aktivitas per jam, Beban emisi. Dibuat dari video referensi yang Anda berikan 12 Okt |
| **TX.6** Keputusan: emisi kg/jam untuk final? | setelah 16 Okt | Butuh rekaman klip dan hitungan manual pada 5 kamera. Yang ada sekarang estimasi relatif saja |
| **Rutin** Menilai kalibrasi | tiap sesi | Lihat bagian "Perlu dilihat" dari `calibration_check.py`; asisten mengingatkan di awal tiap sesi |
| **T3.13** Melihat sekilas tiga kalibrasi yang diubah asisten 12 Okt | tidak mendesak | KP.Kali-OUT, Kartini-OUT, IPdome-Polder Tawang; sudah diuji, cadangan tersedia |
| **T2.10** Akun Vercel dan langkah deploy | **Rab 14 Okt siang** | Dipandu langkah demi langkah (±20 menit). Butuh login GitHub `randymuflih` (pemilik repo). Pemeriksaan pra-deploy 13 Okt: build lolos, tidak ada rahasia di bundel klien maupun di git. **Ganti `ADMIN_PASSWORD` dengan sandi yang kuat saat mengisi variabel di Vercel** (yang sekarang hanya 8 karakter) |
| **T4.4** (opsional) Memastikan tiga pasangan hulu–hilir yang meragukan | kapan saja | Empat pasangan rumah pompa sudah berjalan; tiga lainnya butuh pengetahuan aliran setempat |
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
- [x] **T0.7 [M]** Jam batas pengumpulan dan template laporan. Selesai 13 Okt: batas pengumpulan Jumat 16 Okt pukul 23.59 WIB dan penjurian 16–25 Okt (dari pemilik proyek); template resmi (`TEMPLATE SOFTWARE DEVELOPMENT.docx`) dan surat pernyataan orisinalitas diunduh dari folder panitia ke `C:\semarsight\laporan-penyisihan\`.

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
- [x] **T2.12 [K]** Evaluasi hitungan YOLO pada siang hari. Selesai 13 Okt dengan sampel kecil: 10 kamera, satu gambar tiap kamera, dibandingkan dengan hitungan mata oleh asisten (bukan manusia). Sistem mencatat 176 kendaraan, pembanding ±214 (82%); **sepeda motor hanya 27 dari ±78**, truk terhitung berlebih (29 berbanding ±15). Indeks kepadatan relatif tetap layak; porsi jenis kendaraan tidak. Model yolo11s menemukan ±2,5 kali lebih banyak sepeda motor pada gambar yang sama. Rincian di `09-demo-evaluation-report.md`; alatnya `worker/scripts/annotate_counts.py`. **Model diganti ke yolo11s pada 13 Okt pukul 16.29 WIB atas keputusan pemilik proyek** (lihat catatan di bawah tabel rencana). Malam hari belum dievaluasi, dan model baru belum dibandingkan dengan hitungan mata.
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
- [ ] **T3.11 [M]** Simpan foto referensi untuk kamera terkalibrasi. **Sebagian:** referensi siang kini lengkap, 22 dari 22 (empat kamera jalan disimpan 12 Okt pukul 14.18–14.19, jalan kering, lalu 16 gambar bukti dinilai ulang dan tetap normal). Referensi malam 21 dari 22: DPU-Mberok2-OUT dan Semarang Indah_IN disimpan 12 Okt pukul 18.27 dari gambar malam pukul 18.25 (muka air setara referensi siang). Setelah itu 8 gambar bukti DPU-Mberok2-OUT dinilai ulang: semuanya tetap normal, dan keyakinan penilaian malam pukul 18.00 naik dari 0,55 menjadi 0,68. **Kurang satu: Banger-IN.** Gambar malamnya tertutup eceng gondok dan tepi yang bergaris acuan gelap, jadi tidak bisa dipastikan menunjukkan keadaan normal; kamera ini bukan unggulan dan tidak dinilai AI, sehingga tidak ada dampaknya.
- [x] **T3.12 [K]** Pemeriksaan salah baca 12 Okt. Ke-22 penilaian bukan normal sejak 11 Okt ditinjau (yang terjadi 12 Okt dari gambar buktinya, sisanya lewat nilai ulang); tidak ada yang menunjukkan kejadian nyata. Hasil: pembacaan naik butuh keyakinan ≥ 0,65 agar dihitung; referensi siang Kartini-OUT dan KP.Kali-OUT diganti dengan keadaan normal yang paling tinggi (foto lama dicadangkan); garis W/S KP.Kali-OUT yang tertukar dibetulkan; `scripts/replay_readings.py` untuk menilai ulang gambar bukti. *Bukti:* nilai ulang 130 gambar dari 20 lokasi tidak lagi menghasilkan pembacaan naik (sebelumnya 8).
- [x] **T3.14 [K]** Halaman kalibrasi menolak garis acuan yang urutannya tertukar, dan menampilkan sebabnya.
- [x] **T3.15 [K]** Penilaian ganda (12 Okt sore): penilaian yang hasilnya naik diulang sekali atas gambar yang sama dan baru dihitung bila sepakat. Pemicunya indikasi "awas" palsu di Banger-SD-IN pukul 17.00 (cahaya sore). *Bukti:* tiga putaran nilai ulang atas enam gambar sore kamera itu tidak lagi menghasilkan penilaian naik yang dihitung; dari 76 gambar semua lokasi tersisa satu (Kartini-OUT), yang hilang setelah garis N-nya digeser. Indikasi di Banger-SD-IN itu juga menjadi uji pertama linimasa dan penanda peta dengan **data langsung** di beranda.
- [ ] **T3.13 [M]** Lihat sekilas kalibrasi yang diubah asisten 12 Okt (tabel di bawah): referensi siang baru KP.Kali-OUT dan Kartini-OUT, dan garis N IPdome-Polder Tawang yang digeser. Tidak mendesak: semuanya sudah diuji dengan nilai ulang dan cadangannya ada di `FRAMES_DIR\_state\referensi-lama`. Yang hanya pemilik proyek bisa nilai: apakah posisi garis S dan A tiap lokasi sesuai keadaan di lapangan.

### Kalibrasi dan referensi per kamera (keadaan 12 Okt, 14.30 WIB)

Garis: N = normal, W = waspada, S = siaga, A = awas. Kamera jalan memang tidak memakai garis. "Keyakinan" adalah rata-rata keyakinan AI siang / malam sejak 11 Okt.

| Kamera | Jenis | Garis | Ref. siang | Ref. malam | Keyakinan | Catatan dan tindak lanjut |
|---|---|---|---|---|---|---|
| Banger-SD-IN | pompa masuk | N W S A (**W ditambah, S digeser pemilik proyek 13 Okt**) | ada | ada | 0,77 / 0,75 | Dikalibrasi ulang 11 Okt. **Sore hari (sekitar 15.30–17.30) kamera melawan cahaya** dan penilaiannya tidak stabil: 12 Okt 17.00 sempat dinilai "awas" padahal airnya setinggi referensi. Ditahan oleh penilaian ganda; pantau tiap sore Kalibrasi 13 Okt diperiksa: urutan benar, jarak antar garis 0,025 / 0,020 / 0,019 (batas bawah 0,012). **Sore 13 Okt (aturan garis baru, garis W baru):** 6 penilaian pukul 14.45–17.20 semuanya normal, keyakinan 0,58–0,76; tidak ada indikasi palsu seperti 12 Okt |
| Bulu Drain-IN | pompa masuk | N W S A | ada | ada | 0,81 / 0,75 | Baik |
| Kartini-IN | pompa masuk | N W S A | ada | ada | 0,78 / 0,73 | Satu "waspada" lemah 12 Okt; garis N berimpit dengan muka air. Pantau |
| Manggis-IN | pompa masuk | N W S A | ada | ada | 0,84 / 0,79 | Baik. Sampah terbaca banyak 12 Okt |
| Progo-IN | pompa masuk | N W S A | ada | ada | 0,84 / 0,80 | Baik |
| Trimulyo_Depan | pompa masuk | N W S A | ada | ada | 0,83 / 0,81 | Baik |
| Banger-IN | pompa masuk | N W S A | ada | **belum** | – | Bukan unggulan, jadi belum dinilai AI. Garis sangat rapat; perlu digambar ulang bila ingin dipakai. Gambar malam 12 Okt tertutup eceng gondok, tidak dijadikan referensi |
| Semarang Indah_IN | pompa masuk | N W S A | ada | ada (12 Okt 18.27) | – | Bukan unggulan, jadi belum dinilai AI |
| Bulu Drain-OUT | pompa keluar | N W S A | ada | ada | 0,74 / 0,71 | Baik; 5 penilaian berkeyakinan rendah |
| DPU-Mberok2-OUT | pompa keluar | N W S A | ada | ada (12 Okt 18.27) | 0,74 / 0,51 | Keyakinan malam terendah sebelum ada referensi malam; nilai ulang pukul 18.00 naik ke 0,68. Pantau angka malamnya besok |
| KP.Kali-OUT | pompa keluar | N W S A | **diganti 12 Okt** | ada | 0,72 / 0,71 | Garis W/S tertukar, dibetulkan. Referensi siang kini kanal penuh pukul 08.09. Sampah terbaca banyak. **Perlu disetujui (T3.13)** |
| KS-OUT-2 | pompa keluar | N W S A | ada | ada | 0,73 / 0,65 | Busa saat pompa menyala sempat terbaca "awas"; kini tertahan aturan keyakinan. Pantau |
| Kartini-OUT | pompa keluar | N W S A | **diganti 12 Okt** | ada | 0,78 / 0,76 | Referensi siang lama kolam kosong; kini kolam terisi pukul 13.13. Garis N digeser ke dasar dinding beton 12 Okt sore, setelah dua "waspada" lagi (15.20, 15.55); delapan gambar yang sama kini normal. **Perlu disetujui (T3.13)** |
| Progo-OUT | pompa keluar | N W S A | ada | ada | 0,81 / 0,75 | Baik |
| Semarang Indah_OUT | pompa keluar | N W S A (**N digeser 13 Okt**) | ada | ada | 0,69 / 0,71 | **Peringatan palsu pertama sistem, 13 Okt 12.47 WIB:** dua penilaian berturut-turut "waspada" (12.12 dan 12.47) saat air kolam terkena sinar siang, padahal batas air di dinding tidak berubah. Sebabnya garis N tergambar di atas air, di bawah kaki dinding, sehingga air selalu tampak "melewati N". Garis N digeser ke kaki dinding (garis lama dicadangkan); nilai ulang 10 gambar: yang 12.47 menjadi normal, yang 12.12 masih "waspada". **Pantau tiap siang 11.00–13.30; perlu dilihat pemilik proyek**. Sore 13 Okt: 8 penilaian normal; tiga berkeyakinan rendah saat busa pompa (15.31–15.41), dan pukul 16.16 jawaban pertama AI "waspada" tetapi penilaian ulang gambar yang sama "normal", jadi tidak dihitung |
| Trimulyo_OUT | pompa keluar | N W S A | ada | ada | 0,75 / 0,75 | Baik |
| IPdome-Polder Tawang | kolam | N W S A | ada | ada | 0,81 / 0,77 | Dua "waspada" 12 Okt karena garis N berimpit dengan muka air. Garis N digeser ke anak tangga pertama 12 Okt; delapan gambar yang sama kini normal semua |
| Jinunjung_Halaman | kolam | N W S A | ada | ada | 0,81 / 0,75 | Baik |
| DPU_Pahlawan | jalan | – | ada (12 Okt) | ada | 0,95 / 0,90 | Baik |
| JRAKAH | jalan | – | ada (12 Okt) | ada | 0,88 / 0,82 | Baik |
| Jembatan Mberok | jalan | – | ada (12 Okt) | ada | 0,87 / 0,79 | Baik |
| SP. AKPOL | jalan | – | ada (12 Okt) | ada | 0,91 / 0,63 | Malam hari gelap: 9 penilaian rendah, satu "waspada" lemah dari aspal mengilap. Pantau |

Pemeriksaan rutin: `scripts/calibration_check.py` dijalankan di awal tiap sesi kerja dan setiap kali ada penilaian yang bukan normal; tabel ini diperbarui dari hasilnya.

## Fase 4 — Fusi dan insight (Selasa 13 Okt)

- [x] **T4.1 [K]** `fusion/trend.py` dan `fusion/risk.py` (komponen dan bobot disimpan di `risk_components`). Unit test. Komponen hulu masih 0 sampai T4.3.
- [x] **T4.2 [K]** `alerts.py`: satu aktif per (jenis, kamera), teks dari template: `water_rising`, `road_flooded`, `heavy_rain`, `trash_blockage`, `camera_offline`, diselaraskan tiap siklus. Jalur tulis baru teruji dengan hujan buatan; belum pernah ada kejadian air naik yang nyata.
- [x] **T4.7 [K]** `insights.py`: insight situasi dari LLM teks. Selesai 12 Okt: fakta dari `camera_status`, cuaca, dan peringatan; tingkat keseluruhan dari aturan; setiap angka di jawaban LLM diperiksa terhadap fakta sebelum disimpan; dipanggil hanya saat keadaan berubah atau tiap 60 menit; 22 unit test; `scripts/probe_insight.py` untuk uji tanpa menulis. Insight harian dan lintas modul belum (ikut T4.6).
- [x] **T4.9 [K]** Beranda "Denyut Kota". Digantikan cakupan TV.5, selesai 12 Okt.
- [ ] **T4.3 [K]** `/admin/sungai` + `/api/admin/river-links`; `fusion/upstream.py` (peringatan hulu → hilir, belajar jeda). **Sebagian** 12 Okt: status hulu masuk ke skor risiko lokasi hilir, peringatan dini `upstream_warning` dibuat saat hulu waspada ke atas dan naik, insight menyebut lokasi hulu dan hilir, halaman kamera menyebut nama lokasi hulunya. Belajar jeda dari kejadian ikut selesai bersama T4.5. **Belum:** halaman admin sungai (pasangan masih diisi lewat skrip).
- [x] **T4.4 [M]** Isi `river_links` untuk sistem sungai kamera unggulan. Selesai 12 Okt untuk empat pasangan yang jelas (baris berkeyakinan "Tinggi" di bawah), jeda awal 15 menit. Tiga pasangan "perlu dipastikan" tidak diisi; bisa ditambahkan kapan saja bila alirannya diketahui. Usulan lengkapnya:

  | Hulu (sisi masuk) | Hilir (sisi keluar) | Jarak | Dasar | Keyakinan |
  |---|---|---|---|---|
  | Bulu Drain-IN | Bulu Drain-OUT | 20 m | Pompa yang sama | Tinggi |
  | Kartini-IN | Kartini-OUT | 140 m | Pompa yang sama | Tinggi |
  | Progo-IN | Progo-OUT | 0 m | Pompa yang sama | Tinggi |
  | Trimulyo_Depan | Trimulyo_OUT | 20 m | Pompa yang sama | Tinggi |
  | IPdome-Polder Tawang | DPU-Mberok2-OUT | 440 m | Berdekatan; perlu dipastikan polder ini memang dibuang lewat pompa Mberok | Perlu dipastikan |
  | DPU-Mberok2-OUT | Jembatan Mberok (jalan) | 10 m | Jalan tepat di samping pompa; untuk insight genangan | Perlu dipastikan |
  | Bulu Drain-OUT | KS-OUT-2 | 710 m | Berdekatan; perlu dipastikan satu aliran | Perlu dipastikan |

  Tidak diusulkan karena tidak ada dasar dari nama atau jarak: Banger-SD-IN, Manggis-IN, KP.Kali-OUT, Semarang Indah_OUT (pasangannya, Semarang Indah_IN, bukan kamera unggulan), Jinunjung_Halaman, dan kamera jalan lainnya. Yang juga perlu diputuskan: di rumah pompa, sisi mana yang memengaruhi risiko sisi lainnya (air masuk yang tinggi membebani pompa; air keluar yang tinggi menghambat pembuangan).
- [x] **T4.5 [K]** `fusion/events.py`: buka, perbarui puncak, tutup kejadian. Selesai 12 Okt: kejadian dibuka saat status resmi naik dari normal, puncak dan gambar buktinya diperbarui, ditutup dengan durasi saat status resmi kembali normal; jeda hulu–hilir dipelajari sebagai median dari kejadian yang tercatat. *Bukti:* 12 unit test, dan jalur buka → puncak → tutup diuji ke database sungguhan dengan baris bertanda `synthetic` yang lalu dihapus. Tabel masih kosong karena belum ada kejadian nyata; `rain_total_mm` dibiarkan kosong karena total hujan belum benar-benar diukur.
- [x] **T4.6 [K]** `fusion/cross_module.py`: genangan → lalu lintas. Selesai 13 Okt: untuk tiap lokasi air yang status resminya naik (atau jalan yang tergenang), dihitung keadaan titik lalu lintas dalam radius 1 km (jumlah titik, berapa yang lebih padat dari kebiasaannya, titik terpadat); lokasi yang juga kamera lalu lintas ikut dihitung. Hasilnya dipakai di tiga tempat: fakta `traffic_nearby` untuk insight AI (dengan aturan menulis "bersamaan dengan", bukan "karena", dan tidak menyimpulkan selagi pembanding masih sementara), kolom `events.traffic_impact` yang menyimpan saat terpadat selama kejadian, dan kalimat di panel kecamatan serta halaman Riwayat (juga di CSV). *Bukti:* 7 unit test lintas modul, 2 unit test kejadian, 1 unit test fakta insight; fakta dari data langsung untuk keadaan buatan "JRAKAH tergenang" berisi 4 titik dalam 1 km; kalimatnya terlihat di simulasi langkah 6. **Belum teruji oleh kejadian nyata, dan pembanding lalu lintas masih sementara, jadi AI belum menuliskannya sebagai temuan.** Skenario simulasi perlu disusun ulang setelah pembanding tidak lagi sementara supaya ringkasan AI di simulasi ikut memuatnya.
- [x] **T4.8 [K]** `/air`. Selesai 13 Okt: peta penuh dengan satu pin per lokasi air yang dikalibrasi (22 lokasi), berwarna status resminya; pin membesar saat didekati, dan lokasi yang naik atau menunggu penilaian kedua diberi label tetap. Kiri: kondisi sekarang, jumlah per status, hujan 3 jam ke depan, empat pasangan hulu → hilir dengan status tiap sisinya, dan linimasa perkembangan bila ada yang bergerak. Kanan: lokasi yang paling perlu diperhatikan; memilih satu lokasi menampilkan status resmi, bukti gambar dengan garis acuan, rincian skor risiko, hubungan hulu–hilir, dan lalu lintas di sekitarnya bila statusnya naik. Punya keadaan "Data tertunda" dan mode peta gelap. Atas keputusan pemilik proyek halaman ini **tidak punya menu sendiri**: dibuka dari Beranda (tab Risiko air dan panel kecamatan), dan menu Beranda tetap menyala saat halaman ini terbuka. *Bukti:* dipotret dengan data langsung (20 normal, 2 belum dinilai) dan rincian Banger-SD-IN. **Belum pernah terlihat dengan lokasi yang statusnya naik**, dan sungai/kanal belum digambar sebagai garis (server OpenStreetMap sibuk saat dicoba).

## Fase 5 — Kelengkapan dan keandalan (Rabu 14 Okt)

- [x] **T5.1 [K]** `/lalu-lintas`. Selesai 12 Okt, dari video referensi pemilik proyek: peta penuh dengan jaringan jalan utama dari OpenStreetMap (`worker/scripts/build_road_segments.py`): jalan yang punya kamera lalu lintas (66 ruas) diwarnai menurut tingkat kepadatan, tebal untuk ±200 m yang terlihat kamera dan tipis sampai ±1 km sebagai perkiraan, sedangkan jalan tanpa kamera diwarnai sebagai perkiraan dari kamera terdekat (dibuat menerus dan tanpa abu-abu atas permintaan pemilik proyek setelah melihat dua versi sebelumnya; semua peta, termasuk Beranda, kini memakai peta dasar berwarna); bingkai awal pusat kota; ringkasan dan batang sebaran di kiri; daftar ruas terpadat di kanan; memilih ruas mendekatkan peta dan menampilkan angka di balik tingkatnya, gambar kamera sebagai bukti, grafik 24 jam terhadap pembanding, dan jenis kendaraan terlihat. Bersamaan dengan itu aturan diperbaiki: ruas dengan kurang dari 8 kendaraan tidak lagi disebut ramai atau padat (sebelumnya 4 kendaraan pada jam yang biasanya 1 terbaca "padat"; jumlah ruas "lebih padat dari biasanya" turun dari 12 menjadi 7). *Bukti:* 11 unit test geometri ruas, 3 unit test aturan, dan halaman dipotret dengan data langsung. Daftar anomali belum dipisah (anomali belum menyala selama pembanding masih sementara).
- [x] **T5.2 [K]** `/riwayat` + `/api/export/events` (CSV). Selesai 12 Okt: tabel kejadian (mulai, lokasi, jenis, puncak, lama, selesai), unduhan CSV, dan keadaan kosong yang menjelaskan bahwa belum ada kejadian dan menautkan ke simulasi. *Bukti:* halaman dan CSV diuji dengan tabel kosong; **tampilan tabel berisi baris belum pernah terlihat**, karena belum ada kejadian nyata. Statistik titik rawan belum.
- [x] **T5.3 [K]** `/tentang`: cara kerja, atribusi PANTAUSEMAR, batasan, privasi. Selesai 12 Okt: cakupan dari data langsung (146 kamera, 20 lokasi air, 9 dari 16 kecamatan), empat langkah cara kerja, bobot skor risiko, tujuh batasan yang ditulis terus terang, privasi dan retensi, serta sumber data dan lisensinya.
- [x] **T5.4 [K]** Cara mendemokan kejadian. Selesai 12 Okt sebagai halaman `/simulasi`: skenario 8 langkah (115 menit) dengan masukan buatan (penilaian AI tiga lokasi dan prakiraan hujan) yang dijalankan melalui aturan dan LLM asli, lalu diputar di layar yang sama dengan beranda dengan label "SIMULASI · Bukan data langsung" dan penjelasan tiap langkah. Tidak menulis apa pun ke database; data langsung tidak tersentuh. Disusun ulang dengan `worker/scripts/build_demo_scenario.py` bila aturan atau prompt berubah. `/replay` dari kejadian nyata menunggu ada kejadian yang terekam.
- [ ] **T5.5 [M+K]** Pindahkan worker ke VPS (systemd, `Restart=always`). *Bukti:* berjalan stabil semalaman. **Sebagian** 12 Okt: worker dipindah dari laptop ke PC yang menetap (mulai 12.51 WIB, mesin diatur tidak tidur); VPS belum, dan bukti semalaman menyusul 13 Okt pagi. Worker belum menyala sendiri setelah PC restart.
- [ ] **T5.6 [K]** Audit empat keadaan (memuat, kosong, error, usang) di semua komponen data; uji mematikan worker. **Sebagian** 12–13 Okt: halaman Lalu Lintas (13 Okt) menulis "Data tertunda" dengan aturan yang sama dengan beranda, lapisan emisi mengatakan bila tidak ada gambar 30 menit terakhir, dan lapisan aktivitas mengatakan bila profilnya belum ada; tampilan ponsel (lebar 390 px) diperiksa di Beranda, Lalu lintas, dan Air: menu dibuat satu baris yang bisa digeser, dan ringkasan kini tampil sebelum peta; halaman Lalu lintas tetap berguna selagi pembanding dikumpulkan (daftar kendaraan terbanyak terlihat); halaman baru (Riwayat, Tentang, Simulasi, tren di panel kecamatan) punya keadaan memuat, kosong, dan gagal; beranda menulis "Data tertunda · belum ada pembaruan sejak …" bila data langsung tidak diperbarui lebih dari 15 menit, alih-alih tetap menyebut kondisi "sekarang". **Belum:** uji dengan worker benar-benar dimatikan (sengaja ditunda agar tidak ada jeda data), dan pemeriksaan halaman kamera serta admin.
- [ ] **T5.7 [K]** `scripts/export_eval_sample.py` + `/admin/label` + `/api/admin/labels`. Kandidat digeser.
- [ ] **T5.8 [K]** Sinkronisasi kamera harian (`sources/pantausemar.py`) dan job malam baseline. Bagian baseline dikerjakan lebih dulu sebagai T2.14.

## Fase 6 — Evaluasi, dokumen, video (Kamis 15 Okt)

- [ ] **T6.1 [M]** Label ±200 sampel (siang dan malam). Tabel `labels` masih kosong. Kandidat digeser.
- [ ] **T6.2 [K]** `/admin/evaluasi`: akurasi keseluruhan, siang/malam, per kamera, confusion matrix. Kandidat digeser.
- [ ] **T6.3 [K]** `/admin/sistem`: heartbeat, panggilan AI hari ini, error terbaru. Sementara ini tersedia lewat `scripts/status.py`.
- [ ] **T6.4 [K]** Perbaiki bug kritis saja; bekukan fitur. **Fitur dibekukan sejak 13 Okt malam**: yang dikerjakan sampai pengumpulan hanya perbaikan, pemeriksaan, deploy, laporan, dan video.
- [x] **T6.5 [K]** README lengkap: arsitektur, cara menjalankan, env, keterbatasan, atribusi data. Selesai 12 Okt: ringkasan dan status, dua tangkapan layar, prinsip rancangan, diagram arsitektur, daftar halaman, cara menjalankan dengan tabel variabel, alat uji, delapan keterbatasan, privasi, dan sumber data. Perlu diperbarui lagi setelah deploy (tautan publik) dan setelah evaluasi akurasi.
- [ ] **T6.6 [M]** Laporan penyisihan sesuai template panitia. **Sebagian** 13 Okt: draf isi lengkap mengikuti bab-bab template ada di `16-draf-laporan-penyisihan.md`, dengan angka sistem per 13 Okt dan sumber untuk angka dari luar. Yang masih harus dikerjakan tim: identitas tim dan NIM, kata pengantar, tautan deploy dan repo, tangkapan layar (ambil Kamis atau Jumat), membaca ulang sumber pustaka, memperbarui angka bertanda `[PERBARUI]`, lalu memindahkannya ke berkas template.
- [ ] **T6.7 [M]** Rekam video demo. Naskah per adegan (layar, klik, narasi, detik) ada di `17-naskah-video-demo.md`; perekaman Jumat 16 Okt oleh pemilik proyek.
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
- [x] **TV.4 [K]** Panel wilayah. Selesai 12 Okt: kondisi air per lokasi dengan keterangan perubahan status 24 jam terakhir, kepadatan dengan grafik irama lalu lintas 24 jam (jam tanpa data digambar terputus), hujan dengan prakiraan per jam 12 jam ke depan, temuan AI, dan tautan ke kamera. Riwayat status air sebagai grafik menunggu pencatatan kejadian (T4.5).
- [x] **TV.8 [K]** Perkembangan lokasi air terlihat di layar (12 Okt, dari masukan pemilik proyek atas simulasi): linimasa "Perkembangan 2 jam terakhir" (titik = penilaian AI, pita = status resmi), penanda peta untuk lokasi yang menunggu penilaian kedua dan yang statusnya naik, dan keterangan di panel kecamatan. Setelah pemilik proyek menanyakan buktinya di langkah 3, ditambah blok bukti penilaian (level, waktu, keyakinan, alasan AI, "1 dari 2"), label tetap di peta, dan fakta `pending_confirmation` agar ringkasan AI tidak bertentangan dengan penilaian itu. Berlaku di beranda (data langsung) dan simulasi. *Bukti:* dipotret di simulasi langkah 3, 5, 6, dan 7; di beranda panel tidak tampil karena tidak ada yang bergerak. **Belum teruji dengan data langsung yang naik**, karena belum ada kejadian nyata.
- [ ] **TV.6 [K]** Matriks jam × hari di `/lalu-lintas` (bagian dari T5.1). Butuh beberapa hari data.

## Fitur tambahan terpilih

Dari `11-feature-backlog.md` dan `12-emisi-kualitas-udara.md`. Dikerjakan hanya setelah inti rapi.

- [ ] **TX.1 [K]** Halaman jaringan CCTV: ketersediaan per kamera dan per dinas, kamera mati lebih dari 24 jam.
- [ ] **TX.2 [K]** Peringatan dini BMKG (nowcast) sebagai banner dan prakiraan BMKG per kecamatan.
- [ ] **TX.3 [K]** Kartu "Kondisi luar ruang": kualitas udara, suhu terasa, UV, hujan dari Open-Meteo.
- [ ] **TX.4 [K]** Halaman "Cara Kerja AI".
- [ ] **TX.5 [K]** Lapisan rob dari Open-Meteo Marine.
- [ ] **TX.6 [K]** Uji kelayakan hitungan arus dari klip video (2–3 klip siang dan malam, hitung manual) sebelum memutuskan emisi dalam kg/jam. Tanpa ini, emisi hanya ditampilkan sebagai estimasi relatif (TX.8).
- [x] **TX.7 [K]** Heksagon aktivitas per jam (lapisan kedua `/lalu-lintas`). Selesai 12 Okt: worker menyimpan profil per kamera per jam (rata-rata kendaraan dan orang terlihat per gambar, WIB) ke `system_status` tiap jam; web mengelompokkannya ke heksagon 400 m dengan penggeser jam, tombol putar, grafik 24 batang, dan rincian per heksagon. Heksagon hanya ada di tempat yang punya kamera; jam yang datanya belum cukup digambar sebagai kosong, bukan sepi. *Bukti:* 4 unit test, profil 80 kamera dari 3 hari data tertulis pukul 18.32 WIB, halaman dipotret. **Polanya baru dari 3 hari data**, dan jam 07, 08, dan 10 masih kosong di sebagian kamera.
- [x] **TX.8 [K]** Beban emisi relatif (lapisan ketiga `/lalu-lintas`). Selesai 12 Okt: kendaraan terlihat 30 menit terakhir ditimbang faktor emisi Permen LH 12/2010 untuk CO₂, NOx, dan CO; ruas diperingkat terhadap ruas lain dan ditampilkan dalam "setara sepeda motor", dengan porsi tiap jenis kendaraan. Tidak ada angka kg/jam, karena sistem tahu kendaraan yang terlihat, bukan yang lewat. *Bukti:* halaman dipotret dengan data langsung. **Porsi per jenis belum diuji dengan hitungan manual**: sepeda motor hanya 29% dari deteksi dan truk 12%, keduanya meragukan.
- [x] **TX.10 [K]** Peringatan "sampah menumpuk + hujan diprakirakan" (insight lintas modul kedua). Selesai 13 Okt. Aturan peringatannya sudah ada sejak awal tetapi membaca satu penilaian AI terakhir, padahal penilaian sampah tidak ajek (Manggis-IN berganti antara "sedikit" dan "banyak" 12 kali dalam 46 penilaian). Yang dikerjakan: (1) definisi tiap tingkat sampah ditulis di prompt AI ("banyak" = menutupi sebagian besar permukaan atau menumpuk di saringan; tanaman air dan busa bukan sampah; bila ragu pilih yang lebih rendah); (2) status sampah resmi: "banyak" bila 4 dari 6 penilaian terakhir sepakat, lepas bila tinggal 1 dari 6; (3) peringatan memakai status resmi itu, bertingkat waspada, ditujukan ke Dinas PU, dan baru ditutup setelah prakiraan hujan turun di bawah 7 mm; (4) keterangan di rincian lokasi halaman Air; (5) satu langkah di Simulasi. *Bukti:* 6 unit test; gambar bukti KP.Kali-OUT dan Manggis-IN dilihat (di KP.Kali-OUT permukaan memang tertutup sampah dan petugas terlihat membersihkannya pukul 16.26; di Manggis-IN sampahnya tersebar); 8 gambar terakhir empat lokasi dinilai ulang dengan definisi baru: Manggis-IN menjadi "sedikit" 8 dari 8, KP.Kali-OUT tetap "banyak" pada 3 gambar yang sama; aturan dijalankan pada penilaian 72 jam: status "banyak" menyala 7 kali di empat lokasi (11 kali dengan ambang 3 dari 4). **Peringatannya sendiri belum pernah menyala dengan data langsung**, karena belum ada prakiraan hujan ≥ 10 mm. Atas permintaan pemilik proyek fiturnya ditonjolkan: tema peta "Sampah perairan" di Beranda, baris jumlah lokasi bersampah banyak di panel kiri, dan blok di halaman Air. Evaluasi kecil 16 gambar (satu per lokasi, dibandingkan dengan penilaian mata oleh asisten): 13 sepakat, 3 berbeda satu tingkat di ujung bawah, tidak ada "banyak" yang keliru; rincian di `09-demo-evaluation-report.md`.
- [x] **TX.11 [K]** Keramaian ruang publik. Selesai 13 Okt (dijadwalkan Rabu, dikerjakan lebih awal): halaman `/ruang-publik` dengan menu sendiri, satu kartu per tempat (pejalan kaki terlihat sekarang, pembanding pada jam yang sama, pola 24 jam, dua gambar kamera sebagai bukti, daftar sudut pandang). Worker kini menghitung pejalan kaki: orang yang terdeteksi sedang menaiki sepeda motor atau sepeda tidak dihitung. *Bukti:* 4 unit test; kotak deteksi diperiksa dengan mata di Sri Gunting 01 dan 02, Gereja Blenduk, Depan Oudetrap, Lawang Sewu, dan Titik Nol; halaman dipotret dengan data langsung (Kota Lama 70 pejalan kaki dari 5 sudut, Balai Kota 1). **Temuan pemeriksaan yang mengubah rancangan:** hanya dua tempat yang kameranya benar-benar menghadap ruang pejalan kaki (Kota Lama 5 kamera, Balai Kota 6 kamera); kamera "Titik Nol" dan "Pintu Masuk Lawang Sewu" ternyata menghadap jalan raya dan tidak dipakai; tiga kamera "Pintu Belakang" tidak dikenali tempatnya. **Tambahan 13 Okt malam:** dua kamera "Camera 01" berkategori pariwisata dikenali dari gambarnya sebagai kawasan wisata di tepi waduk (patung kera; koordinatnya cocok dengan Goa Kreo, Gunungpati) dan ditambahkan sebagai tempat ketiga; **nama tempatnya perlu dipastikan pemilik proyek**. Kamera jalan diperiksa sebagai calon tempat tambahan (Tugumuda, Simpang Lima) dan tidak layak: di antrean rapat sepeda motornya tidak terdeteksi, sehingga 25 dari 25 "pejalan kaki" di Tugumuda 3 adalah pengendara. Karena itu pilihan "Orang" dicabut dari lapisan Aktivitas per jam di halaman Lalu lintas; hitungan orang hanya dipakai dari kamera yang menghadap ruang pejalan kaki. Supaya halaman dengan tiga tempat tidak terasa kosong, ditambahkan peta kecil dengan pin per tempat dan pemecahan tiap tempat menjadi titik-titiknya (dipotret dengan data langsung: Kota Lama 59 pejalan kaki di tiga titik, Balai Kota 8, Goa Kreo 0). **Audit seluruh kamera 13 Okt malam** (141 kamera, tujuh gambar tiap kamera dari arsip hari itu, 36 teratas dilihat dengan mata): tidak ada kawasan pejalan kaki lain. Semua kamera jalan yang hitungan "pejalan kaki"-nya tinggi (Fatmawati, Pucang Gading, Patung Diponegoro, Kalibanteng, Tugumuda, Kariadi, Sam Poo Kong, dan lainnya) ternyata memperlihatkan pengendara motor. Supaya tidak timpang, halaman kini membandingkan per titik (daftar "Titik teramai sekarang", tujuh titik) dan selisih ukuran pin peta diperkecil. **Keputusan pemilik proyek 13 Okt malam: halaman ini cukup seperti sekarang (tiga tempat, modul pendukung); zona pejalan kaki di kamera jalan tidak dikerjakan.** Pemeriksaan malam di Taman Srigunting (9 gambar pukul 19.38–20.22): naik-turunnya hitungan sebagian besar memang orang yang datang dan pergi, tetapi di bawah lampu sorot berwarna 1–2 orang per gambar terlewat dan sekali sebuah tiang lampu terhitung sebagai orang; hitungan malam di sana cenderung kurang. **Kekeliruan yang ditemukan pada audit 13 Okt malam dan sudah diperbaiki:** tingkat keramaian sempat tampil ("Biasa") padahal pembandingnya memuat jam yang sama hari itu sendiri; kini pembanding hanya dari hari-hari sebelum hari ini (`persons_usual` di profil aktivitas), jadi tingkat baru muncul Rabu 14 Okt dan berlabel sementara sampai tiga hari. **Batas:** pengendara yang motornya tidak terdeteksi masih ikut terhitung (di Sri Gunting 01 sekitar 4 dari 17); angka tempat adalah jumlah dari sudut yang saling tumpang tindih; tingkat sepi/ramai baru muncul setelah ada pembanding (Rabu sore) dan berlabel sementara sampai tiga hari data.
- [ ] **TX.9 [K]** Peta 3D (bangunan timbul, sudut pandang miring) untuk halaman Lalu Lintas. **Sebagian** 13 Okt malam: halaman percobaan `/lalu-lintas/3d` berjalan (MapLibre GL 5.24 + peta vektor OpenFreeMap, tanpa kunci API): lapisan "Ruas jalan" lengkap dengan warna, pin kamera, bangunan 3D, mode terang dan gelap, dan tautan "3D" dari halaman Lalu lintas. *Bukti:* dipotret di kedua mode; bangunan Semarang tampil rapat, sebagian besar rendah dan seragam, dengan beberapa gedung tinggi. **Belum:** lapisan Aktivitas per jam dan Beban emisi, rincian ruas (grafik dan gambar kamera), pin gabungan berangka, dan pemeriksaan di ponsel. Versi datar tetap menjadi halaman utama sampai pemilik proyek memutuskan.

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
| 12 Okt sore | Pemeriksaan salah baca modul air (T3.12, T3.14 selesai; T3.13 menunggu pemilik proyek); tabel kalibrasi dan referensi per kamera ditambahkan; rencana dijadikan urutan kerja, bukan kalender; pembanding lalu lintas per jam (T2.14 selesai); referensi siang empat kamera jalan disimpan; `calibration_check.py` untuk pemeriksaan rutin; hubungan hulu–hilir empat rumah pompa (T4.4 selesai, T4.3 sebagian); garis N IPdome digeser; tren 24 jam di panel kecamatan (TV.4 selesai); halaman simulasi kejadian (T5.4 selesai); linimasa perkembangan dan penanda peta di beranda dan simulasi (TV.8 selesai); pencatatan kejadian dan belajar jeda (T4.5 selesai); halaman Riwayat dengan unduhan CSV (T5.2 selesai); halaman Tentang (T5.3 selesai); penilaian ganda untuk hasil yang naik (T3.15 selesai) setelah indikasi palsu di Banger-SD-IN; garis N Kartini-OUT digeser; README lengkap (T6.5 selesai) |
| 12 Okt malam | Halaman Lalu Lintas dari video referensi pemilik proyek (T5.1 selesai): ruas jalan berwarna kepadatan, heksagon aktivitas per jam (TX.7), beban emisi relatif (TX.8); aturan "sedikit kendaraan tidak disebut padat"; referensi malam DPU-Mberok2-OUT dan Semarang Indah_IN (T3.11 tinggal Banger-IN); atas masukan pemilik proyek: semua jalan berwarna (tanpa abu-abu), peta dasar berwarna di semua halaman, tombol "Peta gelap", pin kamera yang membesar saat didekati (kamera setempat digabung berangka), kisi heksagon yang memenuhi kota, dan kecamatan tidak terpantau di Beranda tanpa arsiran (garis batas saja) |
| 13 Okt siang | Pemeriksaan awal sesi: worker 291 siklus tanpa jeda dalam 24 jam. **Peringatan palsu pertama** di Semarang Indah_OUT (status resmi "waspada" 12.47 WIB dari dua salah baca saat sinar siang); garis N kamera itu digeser dan diuji ulang. Alur status resmi → peringatan → kejadian untuk pertama kalinya berjalan dengan data langsung; status turun sendiri 14.22 WIB dan baris kejadian palsunya dihapus dari Riwayat atas keputusan pemilik proyek. **Arti garis di prompt AI diselaraskan dengan cara kalibrasi:** waspada berarti air mencapai garis W, bukan melewati N; 104 gambar bukti dinilai ulang dan penilaian naik yang dihitung turun dari 14 menjadi 0–2. Insight lintas modul genangan → lalu lintas (T4.6 selesai). Halaman Air (T4.8 selesai, tanpa menu sendiri). Garis W Banger-SD-IN ditambahkan pemilik proyek. Evaluasi hitungan kendaraan (T2.12 selesai): sepeda motor hanya sepertiga yang terhitung. **Model penghitung diganti ke yolo11s pukul 16.29 WIB**; pembanding lalu lintas dikumpulkan ulang. Template laporan panitia diunduh (T0.7 selesai) dan draf laporan penyisihan ditulis (T6.6 sebagian). Tampilan ponsel dirapikan. Status sampah resmi dan peringatan sampah + hujan (TX.10 selesai); pemeriksaan kalibrasi kini juga melaporkan penilaian sampah yang tidak ajek. Halaman Ruang publik dan hitungan pejalan kaki tanpa pengendara (TX.11 selesai), dengan audit seluruh kamera dan perbandingan per titik; satu siklus worker hilang pukul 20.07 WIB karena sambungan database putus sesaat, lalu bacaan pembuka siklus diberi coba-ulang; naskah video demo ditulis; audit kelengkapan malam (18 rute, 12 halaman dipotret di desktop dan ponsel): pembanding keramaian dibetulkan, halaman Tentang dan status README disesuaikan dengan fitur terbaru, tombol Keluar tidak lagi tampil di halaman masuk admin; penanda cara hitung berganti pukul 17.22 WIB, jadi pembanding lalu lintas mulai lagi dari jam itu |

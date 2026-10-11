# 02 — Arsitektur

## Prinsip desain

1. **Satu pipeline, banyak penganalisis.** Akuisisi, cek kesehatan, dan cek kualitas dipakai bersama; tiap modul menambahkan penganalisis sendiri. Menambah modul tidak membongkar sistem.
2. **Murah dan lokal dulu, AI mahal hanya saat perlu.** YOLO berjalan lokal; AI vision dipanggil hanya jika ada perubahan visual atau heartbeat.
3. **AI untuk persepsi dan penjelasan, aturan untuk keputusan.** Status resmi dan peringatan ditentukan aturan transparan.
4. **Bandingkan kamera dengan dirinya sendiri.** Kualitas dan sudut kamera berbeda-beda, jadi metrik utama adalah perbandingan dengan baseline kamera itu sendiri.
5. **Tahan gangguan.** Kamera mati, worker mati, AI gagal: semuanya punya status eksplisit dan tampilan yang jelas.

## Komponen

```
┌──────────────────────┐      ┌───────────────────────────────────────────────┐
│ PANTAUSEMAR (HLS)    │─────►│ WORKER (Python, VPS)                          │
│ Open-Meteo (cuaca)   │─────►│  scheduler: siklus 5 menit, cuaca 30 menit,   │
└──────────────────────┘      │  insight 15 menit, laporan harian             │
                              └──────────────────────┬────────────────────────┘
                                                     │ service role
                                                     ▼
                              ┌───────────────────────────────────────────────┐
                              │ SUPABASE                                      │
                              │  Postgres (tabel), Storage (snapshot),        │
                              │  Realtime (camera_status, alerts, insights)   │
                              └──────────────────────┬────────────────────────┘
                                   anon (read-only)  │   service role (server)
                                                     ▼
                              ┌───────────────────────────────────────────────┐
                              │ WEB (Next.js, Vercel)                         │
                              │  halaman publik, admin (kalibrasi, label),    │
                              │  API route: asisten AI, admin actions         │
                              └───────────────────────────────────────────────┘
```

## Pipeline per siklus (setiap 5 menit)

```
[cameras aktif]
   │
   ▼
① Akuisisi + cek kesehatan        (ffmpeg ambil 1 frame; live / frozen / dead)
   ▼
② Cek kualitas gambar             (kecerahan, ketajaman, mode malam)
   ▼
③ Penganalisis sesuai modul kamera:
     • traffic/crowd → YOLO lokal → jumlah per kelas
     • water         → deteksi perubahan di ROI (lokal)
                         └─ jika berubah atau heartbeat 30 menit → AI vision (JSON)
   ▼
④ Penghalusan status (aturan)     (konfirmasi 2 pembacaan, histeresis, keyakinan)
   ▼
⑤ Lapisan deret waktu             (baseline per jam-dalam-minggu, tren, anomali)
   ▼
⑥ Fusi                            (hulu→hilir, hujan, skor risiko, insight lintas modul, kejadian)
   ▼
⑦ Simpan + peringatan             (Supabase; Realtime mendorong ke web)
```

Tugas terjadwal lain:
- **Cuaca** (30 menit): ambil curah hujan saat ini dan prakiraan per titik grid.
- **Insight situasi** (15 menit): LLM merangkum kondisi kota dari angka/status.
- **Laporan harian** (06.00 WIB): titik rawan, durasi surut, kejadian, anomali.
- **Baseline** (setiap malam): hitung ulang median per kamera per jam-dalam-minggu.
- **Sinkronisasi kamera** (harian): cek daftar kamera PANTAUSEMAR, tandai kamera baru/hilang.
- **Kualitas udara** (60 menit, direncanakan): Open-Meteo (model) dan stasiun BMKG jika diizinkan → `air_quality_readings` (lihat `12-emisi-kualitas-udara.md`).
- **Klip arus kendaraan dan estimasi emisi** (direncanakan, setelah uji kelayakan): klip 30 detik → YOLO + pelacakan → hitung lintas garis → `traffic_flows` → Tier 2 per jam → `emission_estimates`.

## Detail tiap tahap

### ① Akuisisi dan kesehatan
- Ambil 1 frame per kamera dengan ffmpeg dari URL `.m3u8` (timeout 15 detik), paralel dengan batas konkurensi (mis. 8).
- Status kesehatan:
  - `live`: frame berhasil diambil dan berbeda dari frame sebelumnya.
  - `frozen`: frame persis sama (sidik gambar identik) dengan frame sebelumnya 3 siklus berturut-turut. Adegan diam tidak dihitung beku, karena derau sensor membuat tiap frame kamera hidup tetap berbeda.
  - `dead`: playlist/frame gagal diambil.
- Simpan frame penuh ke disk lokal worker (dataset untuk evaluasi), unggah ke Storage hanya `latest/{camera_id}.jpg` (ditimpa) dan snapshot kejadian.

### ② Kualitas gambar
- Ketajaman (varians Laplacian), proporsi piksel gelap, mode IR (saturasi rendah). Malam ditentukan dari **posisi matahari**, bukan kecerahan, karena kamera memakai auto-exposure (lihat `05-worker-spec.md`).
- Hasil: `good | fair | poor`. Pembacaan dari gambar `poor` ditandai keyakinan rendah.

### ③a Penganalisis lalu lintas dan keramaian (YOLO)
- YOLO11n (Ultralytics), kelas COCO: person(0), bicycle(1), car(2), motorcycle(3), bus(5), truck(7).
- Opsional: ROI jalan per kamera (mengabaikan area parkir/trotoar).
- Simpan jumlah per kelas, total kendaraan, dan total orang.

### ③b Penganalisis air (AI vision terkalibrasi)
- Butuh kalibrasi sekali per kamera: ROI (poligon area air/jalan), garis acuan (normal/waspada/siaga/awas) pada benda tetap, foto referensi normal siang dan malam.
- **Deteksi perubahan lokal:** SSIM dan selisih piksel di ROI terhadap pembacaan terakhir dan foto referensi.
- **AI vision dipanggil jika:** perubahan signifikan, ATAU sudah 30 menit sejak panggilan terakhir (heartbeat), ATAU hujan > ambang di grid kamera tersebut (frekuensi dinaikkan).
- Input AI: gambar ROI resolusi rendah + foto referensi + keterangan kartu kamera. Output JSON (lihat `07-ai-prompts.md`).

### ④ Penghalusan status
- Status terkonfirmasi berubah naik jika **2 pembacaan berturut-turut** menunjukkan level lebih tinggi.
- Turun hanya jika **3 pembacaan berturut-turut** lebih rendah (histeresis: lebih baik terlambat menyatakan aman).
- Keyakinan < 0,5 atau kualitas `poor` → tidak mengubah status terkonfirmasi; tampilkan "perlu verifikasi".

### ⑤ Deret waktu
- **Baseline:** median dan p90 per kamera per metrik per `hour_of_week` (0–167, WIB), dari data minimal 3 hari. Sebelum cukup data: median 24 jam bergulir, ditandai "baseline sementara".
- **Indeks kepadatan** = nilai saat ini / median baseline. Level: `lancar` (<0,8), `normal` (0,8–1,3), `ramai` (1,3–1,8), `padat` (>1,8). Ambang disimpan di konfigurasi.
- **Anomali:** nilai > p90 baseline **dan** indeks ≥ 1,5, bertahan ≥ 2 siklus berturut-turut.
- **Tren air:** perubahan level terkonfirmasi dalam 30 dan 60 menit terakhir (`naik_cepat`, `naik`, `stabil`, `turun`).

### ⑥ Fusi
- **Hulu → hilir:** tabel `river_links` (diisi manual lewat admin). Jika kamera hulu naik ke ≥ waspada, kamera hilir mendapat peringatan dini dengan estimasi jeda. Jeda awal = nilai default; setelah ada kejadian, jeda dipelajari dari selisih waktu kenaikan hulu dan hilir.
- **Skor risiko per kamera air (0–1), bobot ditampilkan terbuka di UI:**
  - 0,40 × status terkonfirmasi (normal 0; waspada 0,4; siaga 0,7; awas 1)
  - 0,20 × tren (stabil/turun 0; naik 0,5; naik_cepat 1)
  - 0,20 × status hulu tertinggi (skala sama dengan status)
  - 0,20 × hujan (prakiraan 3 jam ke depan: 0 mm → 0; ≥20 mm → 1, linear)
  - Level: `rendah` < 0,3 ≤ `sedang` < 0,55 ≤ `tinggi` < 0,75 ≤ `sangat_tinggi`.
- **Insight lintas modul:** lihat `05-worker-spec.md` bagian Cross-module.
- **Kejadian (events):** genangan/luapan dimulai saat status ≥ waspada, puncak, berakhir saat kembali normal; hitung durasi dan dampak lalu lintas.

### ⑦ Peringatan
Jenis: `water_rising`, `upstream_warning`, `heavy_rain`, `road_flooded`, `traffic_anomaly`, `crowd_anomaly`, `trash_blockage`, `camera_offline`, `worker_offline`. Peringatan otomatis ditutup saat kondisi kembali normal. Hindari duplikat: satu peringatan aktif per (jenis, kamera).

## Keandalan dan mode demo

- **Heartbeat worker:** worker menulis `system_status.worker_last_seen` setiap siklus. Web menampilkan banner jika > 15 menit.
- **Kesegaran data:** setiap komponen menampilkan "diperbarui X menit lalu".
- **Mode Replay:** halaman yang memutar ulang kejadian nyata yang terekam (timeline + snapshot + status) dengan kecepatan dipercepat. Ini menjamin demo tetap meyakinkan walau tidak sedang hujan saat juri membuka.
- **Data sintetis** hanya untuk pengembangan UI, kolom `source = 'synthetic'`, tidak pernah tampil di produksi kecuali halaman pengembang.

## Keamanan

- Browser hanya memakai Supabase anon key dengan RLS **read-only**.
- Semua penulisan oleh worker (service role) atau API route server (service role) yang dilindungi `ADMIN_PASSWORD`.
- Asisten AI dibatasi laju per IP dan memiliki batas panjang input.
- Pasang batas pengeluaran (spending limit) di dashboard OpenAI.

## Perkiraan beban

- 146 kamera × 288 siklus/hari ≈ 42 ribu frame/hari (disimpan lokal, bukan Storage).
- AI vision: hanya kamera air terkalibrasi (15–20 untuk penyisihan). Dengan heartbeat 30 menit ≈ 48 panggilan/kamera/hari + pemicu perubahan; perkirakan ±1.500–2.500 panggilan/hari untuk 20 kamera. Pantau biaya harian di dashboard OpenAI dan turunkan frekuensi jika perlu.
- YOLO11n di CPU: ±75 frame per siklus, cukup dalam beberapa detik sampai puluhan detik.

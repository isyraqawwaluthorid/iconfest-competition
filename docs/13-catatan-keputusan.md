# 13 — Catatan Keputusan dan Pelajaran

Ringkasan keputusan yang diambil selama pengembangan, beserta alasannya dan bukti yang mendasarinya. Dokumen ini ada supaya siapa pun yang melanjutkan pekerjaan (di mesin lain, atau anggota tim lain) tidak perlu mengulang diskusi yang sama. Rincian teknis tetap di dokumen masing-masing; di sini hanya "apa yang diputuskan dan kenapa".

Terakhir diperbarui: 12 Oktober 2026.

## 1. Arah produk

| Keputusan | Alasan |
|---|---|
| **Insight dulu, kamera sebagai bukti.** Yang ditonjolkan ke pengguna adalah kondisi wilayah, bukan tayangan CCTV. | Pengguna datang untuk tahu wilayah mana yang bermasalah dan harus berbuat apa, bukan untuk menonton kamera. Kamera masuk kelompok menu "Sumber data". |
| **Satuan wilayah adalah kecamatan (16).** | Cukup besar untuk dirangkum, cukup kecil untuk ditindaklanjuti, dan batasnya tersedia terbuka (OpenStreetMap). |
| **Beranda berupa peta penuh dengan panel mengambang.** | Permintaan pemilik proyek: lebih interaktif, visualisasi data muncul sebagai panel. Kiri: kondisi kota. Kanan: peringatan dan peringkat, atau rincian kecamatan. |
| **Kecamatan tanpa sumber data ditandai "tidak terpantau"** (arsiran), tidak pernah hijau. | Sebaran kamera sangat tidak merata. Lokasi air baru terpantau di 9 dari 16 kecamatan. Menganggap "tidak ada data" sebagai "aman" akan menyesatkan. |
| **Kepadatan lalu lintas ditampilkan sebagai warna per kecamatan, bukan heatmap.** | Heatmap memberi kesan ada data di antara titik kamera, padahal tidak ada. |
| **Halaman kamera menjadi "ruang bukti visual".** | Setiap penilaian AI harus bisa diperiksa orang: gambar yang dinilai, pembanding kondisi normal, alasan AI, dan rincian skor. |
| **Tampilan dikerjakan sendiri di repo**, dengan acuan gaya dari rancangan "SemarSight Command Center" (Stitch), tetapi lebih renggang. | Jalur desainer luar tidak jadi dipakai. Acuan dinilai enak dilihat tetapi terlalu padat. |
| **Hanya tema terang.** | Peta dasar berwarna terang; tema gelap otomatis bertabrakan dengannya. |

## 2. Batas kejujuran yang tidak boleh dilanggar

- Sistem **tidak mengukur tinggi air dalam cm** dan **tidak menghitung kendaraan secara presisi**. Istilah yang dipakai: "status", "indeks kepadatan relatif", "skor risiko".
- Rancangan acuan memuat angka yang tidak kita punya (tinggi air cm, km/jam, jumlah dan debit pompa, kualitas udara, identitas petugas, "diverifikasi petugas"). **Semuanya tidak ditiru.** Angka di layar harus berasal dari data yang benar-benar dikumpulkan.
- Keyakinan AI dan waktu data selalu ditampilkan.
- Tanpa kamera RT/RW, tanpa pengenalan wajah, tanpa pembacaan pelat nomor.

## 3. Worker: keputusan dan buktinya

### Kesehatan kamera
- **Deteksi gambar beku memakai sidik jari persis** (BLAKE2b dari gambar abu-abu 160×90), beku jika identik 3 siklus. Aturan dHash di rancangan awal salah menandai 43 kamera hidup; aturan baru memberi 0 salah tanda pada 1.848 pasangan frame arsip.
- **Penjaga gangguan jaringan:** jika lebih dari 40% kamera gagal tanpa jawaban dari server, penyebabnya dianggap jaringan worker dan kegagalan itu tidak dicatat sebagai kamera mati. Ini ditambahkan setelah putus hotspot mencatat 230 "kamera mati" palsu.
- **Malam ditentukan dari posisi matahari**, bukan kecerahan gambar. Kamera menyesuaikan pencahayaan sendiri, jadi aturan berbasis kecerahan keliru.

### Lalu lintas
- YOLO11n lokal dengan ukuran inferensi adaptif (640–1280).
- Baseline bergulir 24 jam; deteksi anomali dimatikan selama baseline masih sementara.
- **Sepeda motor kurang terdeteksi** (hanya 18–24% dari deteksi, padahal di lapangan dominan). Karena itu modul emisi ditunda sampai ada uji kelayakan (lihat `12-emisi-kualitas-udara.md`).

### Air
- **AI hanya dipanggil saat perlu:** gambar berubah nyata, hujan, atau pemeriksaan berkala 30 menit. Ambang perubahan dibuat **per kamera** (minimal ambang dasar, dan dua kali variasi normal kamera itu), karena satu ambang untuk semua akan memanggil AI pada 57% siklus.
- **Status resmi lewat penghalusan:** naik butuh 2 penilaian yang sepakat, turun butuh 3. Satu penilaian keliru tidak boleh langsung menjadi peringatan.
- **Penilaian yang bertentangan dengan dirinya sendiri dibuang:** status di atas normal (atau jalan tergenang) tetapi dinilai sama dengan foto referensi normal.
- **Model:** `gpt-6-luna` untuk vision dan teks ($0,10 / $0,50 per 1 juta token). Satu penilaian ±$0,0003; dengan 20 lokasi sekitar 400–500 penilaian per hari.

### Pelajaran kalibrasi (11 Okt)
1. **Area pengamatan cukup di sekitar benda acuan**, bukan seluruh permukaan air. Gambar ke AI selalu selebar 512 px, jadi area lebar membuat dinding acuan terlalu kecil. Banger-SD-IN: garis lama memberi awas, awas, siaga; setelah area dipersempit dan garis dijadikan tiga, 5 dari 5 normal.
2. **Garis Waspada boleh dihilangkan** bila ruangnya sempit: air yang melewati Normal tetapi belum mencapai Siaga sudah dinilai waspada.
3. **Busa pompa bukan kenaikan air** (Semarang Indah_OUT). Sekarang disebut khusus di prompt.
4. **Aspal basah yang mengilap bukan genangan** (JRAKAH malam hari). Definisi genangan ringan diperjelas; kamera jalan tidak butuh garis acuan.
5. **Referensi siang dan malam** dipilih otomatis sesuai waktu. Tanpa referensi malam, keyakinan AI malam hari turun ke 0,48–0,76.

### Risiko dan peringatan
- **Skor risiko 0–1, terbuka:** status air 40%, tren 20%, kondisi hulu 20%, prakiraan hujan 3 jam 20%. Dihitung ulang tiap siklus tanpa menambah panggilan AI. Komponen hulu masih 0 sampai hubungan hulu–hilir diisi.
- **Peringatan dari aturan dan template**, bukan dari LLM: air naik, jalan tergenang, hujan lebat, sampah sebelum hujan, kamera unggulan tidak terbaca. Diselaraskan tiap siklus; yang syaratnya hilang ditutup otomatis.
- **Gambar yang dinilai AI disimpan 3 hari** di Storage sebagai bukti; angkanya disimpan tanpa batas.

### Keandalan
- Worker menulis log ke berkas bergulir (`FRAMES_DIR/_state/worker.log`), meminta Windows tidak menidurkan mesin, dan menjalankan satu siklus segera setelah mesin terbangun.
- Hanya **satu worker** yang boleh berjalan. Dua worker membuat data ganda dan biaya AI dobel.

## 4. Web: keputusan teknis

- Next.js 16: `cacheComponents`, `proxy.ts` (bukan middleware), tipe global `PageProps` / `LayoutProps`. Baca `web/AGENTS.md` dan dokumen di `node_modules/next/dist/docs/` sebelum mengubah pola.
- Semua warna, radius, dan font lewat token di `web/app/globals.css`. Tiap status punya tiga warna (utama, latar lembut, teks).
- Warna poligon dan penanda Leaflet diatur lewat kelas CSS; karena Leaflet hanya membaca kelas saat bentuk dibuat, bentuk dibuat ulang (lewat `key`) ketika statusnya berubah.
- Tiap langganan Realtime memakai nama kanal unik; Supabase menolak langganan kedua pada kanal bernama sama.
- Kunci rahasia (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) hanya di worker dan server Next.js.

## 5. Temuan tentang data

- **146 kamera publik**, sangat tidak merata: 74 di Semarang Utara/Tengah, 38 di Candisari/Gayamsari, sisanya sedikit; Mijen dan Tembalang nol.
- **20 lokasi dipantau AI:** 16 pompa/sungai/kolam dan 4 jalan (JRAKAH, SP. AKPOL, Jembatan Mberok, DPU_Pahlawan).
- **Beban:** ±27 GB data per hari, ±7,5 GB arsip gambar per hari, satu siklus 40–80 detik.
- Jam yang tertulis di gambar kamera bisa salah (dua kamera Trimulyo sempat ter-reset ke tahun 2025 padahal gambarnya langsung). Waktu data selalu diambil dari jam worker.
- Server sumber kadang menjawab 5XX untuk belasan kamera sekaligus dalam satu siklus lalu pulih; itu dicatat apa adanya.

## 6. Hasil diskusi fitur tambahan

Rincian dan hasil uji ketersediaan data ada di `11-feature-backlog.md` dan `12-emisi-kualitas-udara.md`. Yang dipilih untuk dikerjakan setelah inti selesai:

1. Halaman jaringan CCTV (ketersediaan kamera).
2. Prakiraan dan peringatan dini BMKG per kecamatan.
3. Kartu "Kondisi luar ruang" (kualitas udara model Open-Meteo, UV, suhu terasa), dengan label sumber yang jelas.
4. Halaman "Cara Kerja AI".
5. Lapisan rob dari Open-Meteo Marine.
6. Estimasi emisi lalu lintas, **hanya setelah uji kelayakan** dengan klip video.

EcoTraffic (karya rekan) dipakai sebagai referensi untuk modul emisi.

## 7. Yang belum dikerjakan

- Grafik: tren 24 jam per kecamatan, kurva hari ini vs kebiasaan, matriks jam × hari.
- Hubungan hulu–hilir antar lokasi (`river_links`) dan skema alirannya.
- Insight dari LLM (kartu Kondisi → Penyebab → Dampak → Tindakan), kejadian, dan insight lintas modul (genangan → lalu lintas).
- Evaluasi akurasi formal (siang dan malam) dengan label manusia.
- Halaman Air, Lalu Lintas, Riwayat, Tentang, dan mode replay.
- Deploy ke Vercel, video demo, laporan.

Daftar lengkap dan statusnya ada di `10-tasklist.md`.

## 8. Urusan non-teknis yang masih terbuka

- Simpan referensi siang untuk 4 kamera jalan dan referensi malam untuk DPU-Mberok2-OUT.
- Kirim email permohonan izin pemanfaatan data ke Diskominfo Kota Semarang.
- Tanya panitia jam tenggat dan template laporan; siapkan materai.
- Jadikan repo publik sebelum 16 Oktober.
- Ganti kunci rahasia Supabase dan sandi admin sebelum pengumpulan; kunci OpenAI berlaku 30 hari.

## 9. Kejadian operasional yang perlu diingat

| Waktu | Kejadian | Tindak lanjut |
|---|---|---|
| 11 Okt dini hari | Data hilang ±11 jam karena laptop tertidur | Semua profil daya diatur tidak pernah tidur saat tercolok; worker meminta mesin tetap terjaga |
| 11 Okt sore | Dua salah baca AI (Banger-SD-IN, Semarang Indah_OUT) | Kalibrasi dan prompt diperbaiki; lihat pelajaran kalibrasi |
| 11 Okt 18.10 WIB | Satu siklus terlewat tanpa jejak | Log worker kini ditulis ke berkas |
| 12 Okt pagi | Empat jeda (total ±4 jam) saat laptop dibawa bepergian | Worker dipindah ke PC yang menetap (lihat `14-operasional.md`) |

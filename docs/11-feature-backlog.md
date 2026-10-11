# 11 — Backlog Fitur Tambahan + Kecocokan Data

Hasil brainstorm 10 Okt 2026 untuk memaksimalkan potensi data, **dicocokkan dengan data yang benar-benar tersedia**. Sebagian besar sumber sudah diuji langsung pada 10 Okt 2026 malam (±21.30 WIB).

Skema tambahan: `supabase/schema_features.sql` (diuji bersama `schema.sql` di PostgreSQL 16, idempoten). Jalankan hanya bagian untuk fitur yang dikerjakan.

## Status keputusan (11 Okt 2026)

Backlog ini adalah daftar pilihan, bukan komitmen. Yang diputuskan sejauh ini:

| Keputusan | Fitur |
|---|---|
| Selesai | Koreksi #1 (deteksi malam berbasis posisi matahari), D3 (mosaik, halaman `/mosaik`) |
| Dijadwalkan sebelum 16 Okt, setelah inti hari itu jadi | A7 (jaringan CCTV), B2 (peringatan dini BMKG), B1 (prakiraan BMKG, disederhanakan per kecamatan), D1 (cara kerja AI) |
| Ditunda sampai setelah penyisihan | C1 (bot Telegram), B4 (fasilitas OSM), A5 (sinyal cahaya malam; bisa dihitung belakangan dari arsip frame 14 hari) |

Tambahan dari uji 11 Okt, belum ada di daftar di bawah:

- **Rob/pasang surut** bisa memakai Open-Meteo Marine (`sea_level_height_msl`, gratis tanpa key) alih-alih input manual di B8. Uji untuk pantai Semarang: 0,38–0,81 m dalam 48 jam. Resolusi ±8 km dan akurasi pesisir terbatas, jadi dipakai sebagai indikator, bukan angka resmi.
- **Kartu "Kondisi luar ruang"** untuk warga: kualitas udara, suhu terasa, indeks UV, dan hujan dari Open-Meteo (lihat E1 di `12-emisi-kualitas-udara.md`).

## Legenda

**Kecocokan data**
- ✅ **Teruji:** sumber data diakses dan isinya diverifikasi.
- 🟡 **Data ada, metode perlu diuji:** datanya tersedia, tetapi akurasi metodenya belum dibuktikan.
- 🟠 **Bergantung akses/izin:** data ada tetapi pemakaian rutin perlu izin atau sedang tidak stabil.
- ⛔ **Belum memungkinkan** sebelum tenggat.

**Prioritas**
- **P1:** dikerjakan sebelum 16 Okt (murah, menambah isi web secara nyata, risiko rendah).
- **P2:** untuk final 26 Okt.
- **P3:** roadmap; cukup disebut di laporan/presentasi.

**Aturan:** P1 baru dikerjakan setelah inti (akuisisi, modul air, modul lalu lintas, web dasar) berjalan. Jangan mengorbankan stabilitas inti demi fitur tambahan.

---

## Ringkasan

| ID | Fitur | Kecocokan data | Prioritas | Usaha |
|---|---|---|---|---|
| A1 | Hujan aktual dari kamera | 🟡 | P2 | Sedang |
| A2 | Tren air tanpa kalibrasi (indeks area tergenang) | 🟡 | P2 | Sedang |
| A3 | Pemantauan sampah sungai | 🟡 | P2 (field sudah ada di P1) | Rendah |
| A4 | Kinerja rumah pompa IN vs OUT | ✅ data / 🟡 metode | P2 | Sedang |
| A5 | Peta cahaya malam / indikasi padam | ✅ data / 🟡 metode | **P1** (rekam) / P2 (insight) | Rendah |
| A6 | Kendaraan berhenti lama di badan jalan | 🟡 | P3 | Sedang–tinggi |
| A7 | Kesehatan jaringan CCTV kota | ✅ | **P1** | Rendah |
| A8 | Keramaian ruang publik (penguatan modul inti) | ✅ | **P1** (sudah inti) | – |
| B1 | Prakiraan BMKG per kelurahan | ✅ | **P1** | Rendah |
| B2 | Peringatan dini cuaca BMKG (nowcast) | ✅ | **P1** | Rendah |
| B3 | Data genangan resmi SIGAB (DPU) | 🟠 | P2 | Rendah |
| B4 | Fasilitas penting dari OpenStreetMap (dampak) | 🟠 (server publik sibuk saat diuji) | **P1** | Rendah |
| B5 | Konteks penurunan muka tanah | ✅ (literatur) | P3 (konten) | Rendah |
| B6 | Luas banjir dari Sentinel-1 | ✅ (tersedia global) / 🟡 | P3 | Tinggi |
| B7 | Google Flood Hub API | 🟠 (waitlist, cakupan belum dicek) | P3 | Sedang |
| B8 | Peringatan rob BMKG Maritim | 🟡 (PDF berkala) | P3 | Rendah |
| C1 | Peringatan lewat bot Telegram | ✅ (tidak butuh data baru) | **P1** | Rendah–sedang |
| C2 | Validasi dan laporan warga | ✅ | P2 | Sedang |
| C3 | "Cek lokasi saya" | ✅ | P2 | Rendah |
| C4 | Rute hindari genangan | 🟡 | P3 | Tinggi |
| C5 | Timelapse kejadian | ✅ (frame lokal) | P2 | Rendah |
| C6 | Tampilan per OPD | ✅ | P2 | Rendah |
| C7 | Laporan PDF otomatis | ✅ | P3 | Sedang |
| C8 | Data terbuka / API publik | ✅ | P3 | Rendah |
| D1 | Halaman "Cara Kerja AI" transparan | ✅ | **P1** | Rendah |
| D2 | Evaluasi publik (+ pembanding SIGAB) | ✅ / 🟠 | P2 | Rendah |
| D3 | Mosaik "Semarang saat ini" | ✅ | **P1** | Rendah |
| D4 | Mode replay | ✅ (sudah di rencana inti) | P1 | – |

**Paket P1:** A5 (rekam sinyal), A7, B1, B2, B4, C1, D1, D3.

Fitur emisi dan kualitas udara (E1–E8) dibahas terpisah di `12-emisi-kualitas-udara.md`.

---

## Koreksi terhadap spesifikasi sebelumnya (WAJIB diterapkan)

1. **Deteksi malam hari tidak boleh memakai kecerahan rata-rata.** Uji 10 Okt pukul ±21.30 WIB: kamera Semarang memakai auto-exposure, sehingga luminans rata-rata frame malam tetap 86–105 (skala 0–255), di atas ambang `< 70` di `05-worker-spec.md`. Ganti dengan:
   - `is_night` = waktu lokal di luar 06.00–18.00 WIB (atau hitung elevasi matahari untuk lat/lng Semarang), **dan**
   - `is_ir` (mode inframerah) = saturasi rata-rata < 15 (contoh nyata: Banjardowo-IN saturasi 0).
   - Kualitas `poor` tetap memakai ketajaman (varians Laplacian) dan proporsi piksel sangat gelap, bukan rata-rata kecerahan saja.
2. **Pasangan kamera pompa IN/OUT ada 14 pasang lengkap** (bukan 17): Bawah Tol X3W, Banger, Banjardowo, Bulu Drain, KP.Kali, Kali Baru, Kartini, Kdg Kebo, Majapahit, Manggis, Progo, Sedompyong, Semarang Indah, Trimulyo. Kemungkinan 1 pasang lagi dengan nama berbeda: "Gdg Senjata-IN" dan "Gudang Senjata_Out". Hanya 2 pasang yang koordinatnya identik (Banger, Progo); sisanya perlu **verifikasi manual** bahwa keduanya memang sisi masuk/keluar rumah pompa yang sama.
3. **Canvas dapat membaca piksel stream PANTAUSEMAR** (CORS tidak membuat canvas *tainted*). Artinya analisis ringan di browser (mis. mosaik, cuplikan) memungkinkan, tetapi analisis utama tetap di worker.
4. **Pemutaran banyak stream sekaligus di browser lambat:** dari 20 stream yang dibuka bersamaan, 9 tampil dalam ±20 detik dan 17 setelah ±1 menit. Mosaik (D3) harus memakai **snapshot dari Storage**, bukan 20 video live.

---

## A. Sinyal tambahan dari kamera yang sama

### A1 — Hujan aktual dari kamera · 🟡 · P2
- **Insight:** peta hujan "nyata" dari ±135 kamera hidup; membandingkan dengan prakiraan BMKG/Open-Meteo. *"Prakiraan cerah, tetapi 18 kamera di Semarang Timur menunjukkan jalan basah dan hujan."*
- **Metode:** tambahkan field `rain_visible` dan `wet_road` (ya/tidak/tidak_dapat_dinilai) ke klasifikasi AI vision kamera air (tanpa biaya tambahan). Untuk kamera lalu lintas: panggilan vision terpisah dengan gambar kecil, **hanya** jika prakiraan hujan > 0 atau ada peringatan BMKG aktif, maks. 1 per kamera per 15 menit.
- **Data:** frame (✅). Belum ada kejadian hujan untuk uji akurasi.
- **Tabel:** `scene_readings`.
- **Referensi:** paten deteksi cuaca berbasis karakterisasi jalan dari citra (USPTO 8436902), riset SwRI tentang deteksi jarak pandang dengan computer vision.

### A2 — Tren air tanpa kalibrasi · 🟡 · P2
- **Insight:** semua 76 kamera air dipantau, bukan hanya 15–20 yang dikalibrasi. Melengkapi status terkalibrasi dengan tren "proporsi area tergenang naik/turun".
- **Metode:** gagasan indeks SOFI (rasio piksel air terhadap total piksel, dilacak dari waktu ke waktu). Implementasi realistis untuk lomba: field `water_area_pct` (0–100) dari AI vision pada gambar penuh beresolusi rendah, frekuensi rendah (heartbeat 60 menit, lebih sering saat hujan). Tampilkan sebagai **tren**, bukan status.
- **Referensi:** Moy de Vitry dkk. (2019), *HESS* 23:4621–4634: SOFI dari kamera pengawas biasa berkorelasi ±75% (Spearman) dengan tren tinggi air, ±85% setelah disetel dengan 7 frame berlabel per video, tanpa kalibrasi di lokasi.

### A3 — Pemantauan sampah sungai · 🟡 · P2
- **Insight:** indeks sampah per kamera sungai/pompa dan trennya; peringatan `trash_blockage` saat sampah banyak dan hujan diprediksi.
- **Metode:** field `trash` sudah ada di schema AI vision (P1, gratis). P2: halaman khusus, tren harian, peringkat pintu air paling sering tersumbat.
- **Referensi:** van Lieshout dkk. (2020), *Earth and Space Science*, DOI 10.1029/2019EA000960: kamera di 5 lokasi sungai Jakarta, deteksi plastik terapung presisi 68,7%, mendeteksi ±35% lebih banyak dibanding hitung visual.

### A4 — Kinerja rumah pompa IN vs OUT · ✅ data / 🟡 metode · P2
- **Insight:** *"Air di sisi masuk Pompa Banger naik dua level dalam 40 menit, sisi keluar tidak berubah: kemungkinan pompa belum beroperasi optimal."* Pengguna: Dinas PU / operator pompa.
- **Metode:** status/tren sisi IN dibandingkan dengan sisi OUT dari pembacaan air yang sudah ada. Aturan: IN naik ≥ 1 level dan bertahan ≥ 30 menit sementara OUT stabil → peringatan info untuk PU. **Tidak** mengklaim pompa mati; sebutkan "indikasi".
- **Data:** 14 pasang lengkap teridentifikasi dari nama (lihat Koreksi #2). Butuh verifikasi manual dan kalibrasi kedua kamera.
- **Tabel:** `pump_pairs`.

### A5 — Peta cahaya malam / indikasi padam · ✅ data / 🟡 metode · P1 rekam, P2 insight
- **Insight:** *"5 kamera berdekatan di Kecamatan X kehilangan sumber cahaya bersamaan pukul 22.10: indikasi lampu jalan mati atau listrik padam."*
- **Hasil uji 10 Okt:** luminans rata-rata **tidak** bisa dipakai (auto-exposure). Proksi yang menjanjikan: **jumlah piksel sangat terang (luminans > 235) per mil**, yang bervariasi jelas antar kamera (1–57‰ pada 8 kamera yang diuji). 
- **Metode:** P1: rekam `bright_px_permille`, `luminance_mean`, `saturation_mean` di setiap siklus (murah, dari `quality.py`). P2: baseline per kamera per jam; anomali jika turun > 60% dari baseline, terjadi serentak pada ≥ 3 kamera dalam radius 1 km.
- **Tabel:** `scene_readings`.
- **Referensi:** NYU CUSP, deteksi padam listrik dari citra lampu kota (kluster lampu yang mati bersamaan).

### A6 — Kendaraan berhenti lama di badan jalan · 🟡 · P3
- **Insight:** parkir liar atau kendaraan mogok di titik rawan macet.
- **Metode:** kotak deteksi YOLO yang posisinya hampir sama (IoU > 0,7) pada ≥ 3 snapshot berturut-turut di dalam `traffic_roi` jalan. Interval 5 menit terlalu kasar untuk lalu lintas yang bergerak, jadi hanya cocok untuk kendaraan yang benar-benar diam lama.
- **Referensi:** sensor AI lalu lintas Vivacity/Thunder di Alexandria, AS (hitungan per moda, *dwell time*, okupansi zona).

### A7 — Kesehatan jaringan CCTV kota · ✅ · P1
- **Insight:** ketersediaan per kamera dan per OPD pemilik (Dishub, DPU, Diskominfo), kamera mati > 24 jam. Berguna untuk Diskominfo, sekaligus bukti keandalan sistem.
- **Data:** `health_checks`, `v_camera_uptime_24h` (sudah di schema inti). Uji 10 Okt: 135/146 hidup (92%).
- **UI:** halaman/tab "Jaringan CCTV": peta status, peringkat ketersediaan, daftar kamera mati.

### A8 — Keramaian ruang publik · ✅ · sudah inti
- **Hasil uji 10 Okt (Sabtu ±21.30 WIB):** kamera kawasan wisata/Kota Lama dan Titik Nol memperlihatkan kerumunan padat dengan jelas → modul `crowd` (YOLO kelas person) layak.
- Tambahan P2: "waktu terbaik berkunjung" per kawasan dari baseline, dan dampak hujan terhadap keramaian (lintas modul).

---

## B. Data luar

### B1 — Prakiraan BMKG per kelurahan · ✅ · P1
- **Endpoint (teruji 10 Okt):** `GET https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=<kode>`
  - Contoh `adm4=33.74.01.1001` → Miroto, Semarang Tengah, lat −6.98371, lon 110.41869.
  - Isi: `lokasi{adm1..adm4, desa, kecamatan, kotkab, lat, lon, timezone}` dan `data[0].cuaca` (array per hari) berisi slot **3 jam** ±3 hari (17 slot saat diuji). Field per slot: `utc_datetime`, `local_datetime`, `t` (°C), `hu` (%), `tcc` (tutupan awan %), `tp` (curah hujan, mm), `weather`, `weather_desc`, `ws`, `wd`, `vs_text`, `analysis_date`, `image`.
- **Kode wilayah Kota Semarang:** `33.74`; kecamatan `01`–`16` (teruji semua): 01 Semarang Tengah, 02 Semarang Utara, 03 Semarang Timur, 04 Gayamsari, 05 Genuk, 06 Pedurungan, 07 Semarang Selatan, 08 Candisari, 09 Gajahmungkur, 10 Tembalang, 11 Banyumanik, 12 Gunungpati, 13 Semarang Barat, 14 Mijen, 15 Ngaliyan, 16 Tugu. Kelurahan berformat `33.74.KK.10NN` (177 kelurahan).
- **Metode:**
  1. Skrip sekali jalan `scripts/import_kelurahan.py`: untuk tiap kecamatan, coba `10NN` dari 01 ke atas sampai 3 kode berturut-turut gagal; simpan `desa, kecamatan, lat, lon` ke `kelurahan`. Beri jeda ≥ 1 detik antar permintaan.
  2. Petakan setiap kamera ke kelurahan dengan **centroid terdekat** → `cameras.adm4`.
  3. Worker mengambil prakiraan untuk kelurahan yang punya kamera aktif setiap **3 jam** (data BMKG per 3 jam), simpan ke `bmkg_forecasts`.
  4. Tampilkan prakiraan BMKG berdampingan dengan Open-Meteo; komponen hujan pada skor risiko memakai nilai **maksimum** dari keduanya (lebih konservatif), dan sebutkan sumbernya.
- **Wajib:** cantumkan "Sumber: BMKG" di setiap tampilan data BMKG. Cek batas pemakaian di data.bmkg.go.id.
- **Referensi:** repositori resmi `infoBMKG/data-cuaca`.

### B2 — Peringatan dini cuaca BMKG (nowcast) · ✅ · P1
- **Feed (teruji 10 Okt):** `https://www.bmkg.go.id/alerts/nowcast/id` → RSS/XML (`application/xml`). Saat diuji berisi 11 item. Tiap `item` punya `title` (mis. "Hujan Lebat disertai Petir di Kalimantan Tengah"), `description` (wilayah kecamatan terdampak, waktu, dampak), `pubDate`, dan `link` ke detail **CAP XML** (`.../alerts/nowcast/id/<KODE>_alert.xml`).
- **Metode:** setiap 10 menit, ambil feed; untuk item yang menyebut Jawa Tengah, ambil CAP XML-nya, parse `info/area` (poligon/`areaDesc`), `severity`, `urgency`, `effective`, `expires`. `affects_semarang = true` jika poligon memotong batas Kota Semarang **atau** `areaDesc` menyebut kecamatan Semarang. Simpan ke `bmkg_alerts` (Realtime), tampilkan sebagai banner di beranda, dan naikkan frekuensi analisis kamera air di area terdampak.
- **Catatan:** `robots.txt` situs BMKG membatasi crawler umum. Polling satu feed per 10 menit tergolong ringan, tetapi tetap cantumkan atribusi dan pertimbangkan meminta izin. Jika feed berubah format, gagal dengan log jelas tanpa mengganggu worker.

### B3 — Data genangan resmi SIGAB · 🟠 · P2
- **Sumber:** https://sigab.semarangkota.go.id/ (DPU Kota Semarang): titik genangan harian dengan jenis (genangan/banjir/rob), alamat, **tinggi (cm)**, dan **luas (m²)**. Dicatat petugas kelurahan terlatih (28 petugas) dan divalidasi sebelum dipublikasikan.
- **Hasil uji 10 Okt:** halaman publik memuat data lewat tabel server-side (DataTables). Statistik hari itu 0 (tidak ada genangan tercatat).
- **Kegunaan:** (1) **pembanding resmi untuk evaluasi AI** di titik genangan yang berdekatan dengan kamera; (2) layer peta "genangan tercatat resmi".
- **Syarat:** minta izin DPU sebelum mengambil data secara rutin; jangan menguji endpoint dengan parameter sembarangan. Jika izin belum ada, cukup tampilkan tautan ke SIGAB dan sebutkan di laporan sebagai rencana integrasi.
- **Tabel:** `sigab_records`.

### B4 — Fasilitas penting dari OpenStreetMap · 🟠 · P1
- **Insight:** *"Genangan siaga di JRAKAH, 300 m dari 2 sekolah dan 1 klinik."* Sejalan dengan pendekatan BMKG tentang prakiraan berbasis dampak.
- **Hasil uji 10 Okt:** server Overpass publik (`overpass-api.de`, `overpass.kumi.systems`) sedang timeout/error. Jangan bergantung pada Overpass secara live.
- **Metode (andal):** impor **sekali** dari ekstrak OSM subregion Indonesia yang mencakup Pulau Jawa (Geofabrik, format `.osm.pbf`; cek nama file terbaru di halaman Geofabrik Indonesia) memakai `osmium`/`pyosmium`, filter bbox Semarang (−7.15, 110.25, −6.93, 110.52) dan tag `amenity=school|hospital|clinic`, `healthcare=*`, `highway=bus_stop`, `amenity=marketplace`. Simpan ke `facilities`, hitung `camera_facilities` (radius 500 m). Overpass boleh dipakai sebagai cadangan jika sedang normal.
- **UI:** di panel kamera dan teks peringatan: jumlah dan nama fasilitas terdekat.
- **Atribusi:** "© OpenStreetMap contributors" (ODbL).

### B5 — Konteks penurunan muka tanah · ✅ (literatur) · P3
- Konten untuk laporan dan halaman Tentang/urgensi, bukan data real-time.
- **Referensi:** Abidin, Andreas, Gumilar, Brinkman (EGU 2013), *Spatial correlation between land subsidence and flooding in urban areas of Indonesia*: rata-rata 5–10 cm/tahun di Jakarta, Semarang, Bandung, hingga ±20 cm/tahun di lokasi tertentu; banjir pesisir di Semarang umumnya terjadi di area dengan laju penurunan besar.

### B6 — Luas banjir dari Sentinel-1 · ✅ / 🟡 · P3
- Peta luas genangan setelah kejadian besar (radar menembus awan), sebagai validasi dan layer historis. Cocok dengan keahlian penginderaan jauh tim.
- **Referensi:** UN-SPIDER, *Recommended Practice: Flood Mapping and Damage Assessment Using Sentinel-1 SAR Data in Google Earth Engine*.
- Keterbatasan: revisit beberapa hari, resolusi ±10 m, sulit di area perkotaan padat. Untuk lomba cukup 1–2 peta kejadian sebagai demonstrasi.

### B7 — Google Flood Hub API · 🟠 · P3
- Prakiraan banjir sungai (riverine). Gratis tetapi melalui waitlist; cakupan Indonesia dan sungai di Semarang belum dicek. Sebut sebagai rencana integrasi.

### B8 — Peringatan rob BMKG Maritim · 🟡 · P3
- BMKG Maritim menerbitkan peringatan dini banjir pesisir (rob) berkala dalam bentuk PDF/berita. Untuk lomba: input manual periode rob di admin → aktifkan "mode rob" pada kamera pesisir utara.

---

## C. Fitur aksi dan keterlibatan

### C1 — Peringatan lewat bot Telegram · ✅ · P1
- **Alur:** warga/petugas membuka bot → `/start` → pilih kecamatan atau kamera (`/langganan JRAKAH`) dan level minimum → menerima pesan saat peringatan dibuat/naik level (teks + snapshot + tautan ke `/kamera/[id]`). `/berhenti` untuk berhenti.
- **Implementasi:** Telegram Bot API (token di env `TELEGRAM_BOT_TOKEN`, rahasia). Pengiriman dari worker setelah `alerts` dibuat/diperbarui; `notification_log` mencegah pesan ganda; batasi maks. 1 pesan per kamera per 30 menit per pengguna.
- **Demo:** HP berbunyi saat status naik (atau saat replay/uji).
- **Referensi:** PetaBencana.id memakai chatbot di aplikasi pesan untuk laporan dan peringatan banjir.

### C2 — Validasi dan laporan warga · ✅ · P2
- Tombol "Benar tergenang? Ya / Tidak" di panel kamera dan peringatan; opsi laporan baru dengan foto dan lokasi. Moderasi di admin.
- Manfaat: kepercayaan publik dan **label evaluasi gratis**.
- Keamanan: rate limit per IP (hash), batas ukuran foto, moderasi sebelum tampil publik, tanpa data pribadi.
- **Tabel:** `citizen_reports`. **Referensi:** PetaBencana.id (crowdsourcing banjir, BNPB).

### C3 — "Cek lokasi saya" · ✅ · P2
Geolocation browser → 3 kamera terdekat beserta status, risiko, prakiraan BMKG kelurahan, peringatan aktif. Lokasi tidak disimpan.

### C4 — Rute hindari genangan · 🟡 · P3
Routing (mis. OpenRouteService/OSRM) dengan poligon penghindaran di sekitar kamera berstatus genangan sedang/tinggi. Butuh layanan routing dan validasi; cocok sebagai roadmap.

### C5 — Timelapse kejadian · ✅ · P2
Dari frame lokal worker (interval 5 menit), buat MP4/GIF pendek per kejadian dengan ffmpeg; unggah ke `events/{id}/timelapse.mp4`. Untuk demo, media sosial, dan laporan.

### C6 — Tampilan per OPD · ✅ · P2
Filter `audience` pada `alerts` dan `insights.recommendations`: tab BPBD, PU, Dishub, Perencana, Warga.

### C7 — Laporan PDF otomatis · ✅ · P3
Laporan harian/mingguan dari `insights` scope harian/mingguan, dirender ke PDF.

### C8 — Data terbuka / API publik · ✅ · P3
Endpoint baca-saja (agregat per jam, kejadian) + unduh CSV. **Referensi:** dashboard FloodNet NYC yang terbuka untuk warga, peneliti, dan jurnalis.

---

## D. Fitur untuk meyakinkan juri

### D1 — Halaman "Cara Kerja AI" · ✅ · P1
Untuk satu kamera unggulan, tampilkan langkah nyata dari pembacaan terakhir: frame mentah → ROI + garis acuan → JSON AI (status, alasan, keyakinan) → penghalusan (pembacaan sebelumnya) → skor risiko dengan komponen dan bobot → peringatan. Plus diagram pipeline dan statistik penghematan panggilan AI (panggilan aktual vs jika setiap siklus). Data dari `water_readings`, `camera_status.risk_components`, `system_status`.

### D2 — Evaluasi publik · ✅ / 🟠 · P2
Versi publik dari `/admin/evaluasi`: akurasi siang/malam, confusion matrix, dan (jika izin SIGAB ada) perbandingan dengan genangan resmi.

### D3 — Mosaik "Semarang saat ini" · ✅ · P1
Grid snapshot terbaru (dari Storage `latest/`) untuk kamera hidup, bingkai berwarna sesuai status + label teks, filter modul, waktu snapshot. **Jangan** memutar video live di mosaik (lihat Koreksi #4).

### D4 — Mode replay · ✅ · P1 (sudah di rencana inti)

---

## Dampak ke rencana kerja

Tambahkan ke `08-roadmap.md` setelah inti hari yang sama stabil:
- **Senin 12 Okt:** A5 (rekam sinyal cahaya di `quality.py`), Koreksi #1 (deteksi malam).
- **Selasa 13 Okt:** B1 (impor kelurahan + prakiraan), B2 (nowcast), A7 (halaman jaringan CCTV).
- **Rabu 14 Okt:** B4 (impor OSM + fasilitas terdekat), D3 (mosaik), D1 (cara kerja AI).
- **Rabu/Kamis:** C1 (bot Telegram) jika waktu cukup; jika tidak, pindah ke P2.

Env tambahan:
```
TELEGRAM_BOT_TOKEN=
BMKG_FORECAST_INTERVAL_MINUTES=180
BMKG_NOWCAST_INTERVAL_MINUTES=10
OSM_EXTRACT_PATH=./data/osm/<ekstrak-jawa>.osm.pbf
```

## Referensi

1. Moy de Vitry, M., Kramer, S., Wegner, J. D., & Leitão, J. P. (2019). Scalable flood level trend monitoring with surveillance cameras using a deep convolutional neural network. *Hydrology and Earth System Sciences*, 23, 4621–4634. https://hess.copernicus.org/articles/23/4621/2019/
2. Eawag – FloodVision. https://www.eawag.ch/en/department/sww/projects/floodvision
3. van Lieshout, C., van Oeveren, K., van Emmerik, T., & Postma, E. (2020). Automated river plastic monitoring using deep learning and cameras. *Earth and Space Science*. DOI 10.1029/2019EA000960. https://theoceancleanup.com/scientific-publications/automated-river-plastic-monitoring-using-deep-learning-and-cameras/
4. SIGAB – Sistem Inventarisasi Genangan Banjir, DPU Kota Semarang. https://sigab.semarangkota.go.id/
5. BMKG – data prakiraan cuaca terbuka (infoBMKG/data-cuaca). https://github.com/infoBMKG/data-cuaca
6. BMKG – Peringatan Dini Cuaca. https://www.bmkg.go.id/peringatan-dini
7. BMKG – Sistem prakiraan berbasis dampak. https://www.bmkg.go.id/berita/utama/bmkg-perkuat-aksi-merespons-peringatan-dini-melalui-sistem-prakiraan-berbasis-dampak
8. BMKG Maritim – Peringatan dini banjir rob. https://maritim.bmkg.go.id/peringatan-warning/peringatan-dini-banjir-rob.pdf
9. Abidin, H. Z., Andreas, H., Gumilar, I., & Brinkman, J. J. (2013). Spatial correlation between land subsidence and flooding in urban areas of Indonesia. EGU General Assembly. https://meetingorganizer.copernicus.org/EGU2013/EGU2013-6818.pdf
10. NYU Tandon – FloodNet dashboard. https://engineering.nyu.edu/news/new-data-dashboard-reporting-street-level-flooding-nyc-gives-government-responders-public-and
11. MLIT Jepang – kamera pemantau sungai sederhana dan pengukur muka air darurat (±5.300 unit). https://www.mlit.go.jp/report/press/mizukokudo03_hh_001314.html
12. NYU CUSP – Rapid detection of power outages from city lights. https://engineering.nyu.edu/research/centers/cusp/experiential-learning/capstone-projects/directory/detection-power-outage
13. City of Alexandria – AI Road Safety and Traffic Counts. https://alexandriava.gov/go/5475
14. SwRI – Machine-learning-assisted computer vision visibility sensing. https://www.swri.org/what-we-do/internal-research-development/2019/automotive-transportation/machine-learning-assisted-computer-vision-visibility-sensing-10-r8843
15. UN-SPIDER – Flood mapping with Sentinel-1 in Google Earth Engine. https://un-spider.org/advisory-support/recommended-practices/recommended-practice-google-earth-engine-flood-mapping/step-by-step
16. Google – Flood Forecasting API. https://developers.google.com/flood-forecasting
17. Rest of World – PetaBencana disaster bot. https://restofworld.org/2021/hi-im-disaster-bot/
18. OpenGov Asia – BNPB luncurkan platform crowdsourcing banjir. https://archive.opengovasia.com/2017/10/28/bnpb-indonesia-launches-open-source-platform-to-crowdsource-flood-information/
19. Geofabrik – OpenStreetMap extracts. https://download.geofabrik.de/asia/indonesia.html

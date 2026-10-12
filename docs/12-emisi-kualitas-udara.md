# 12 — Modul Emisi & Kualitas Udara

Modul keempat SemarSight, setara dengan modul air, lalu lintas, dan ruang publik. Hasil riset dan uji data 11 Okt 2026.

Skema: `supabase/schema_emissions.sql` (diuji bersama `schema.sql`, `seed_cameras.sql`, `schema_features.sql` di PostgreSQL 16, idempoten; contoh perhitungan Tier 2 dijalankan langsung di database dan hasilnya sesuai bagian "Contoh hitung").

## Status keputusan (11 Okt 2026, diperbarui 12 Okt)

- **12 Okt: emisi ditampilkan sebagai estimasi relatif, bukan kg/jam.** Pemilik proyek meminta tampilan emisi seperti pada video referensinya. Yang dibangun adalah lapisan "Beban emisi" di `/lalu-lintas` (`web/lib/emission.ts`): kendaraan yang terlihat 30 menit terakhir ditimbang faktor emisi pada dokumen ini (CO₂, NOx, CO), lalu ruas diperingkat terhadap ruas lain dalam "setara sepeda motor". Alasannya dua: snapshot memberi kendaraan yang terlihat, bukan yang lewat per jam; dan porsi jenis kendaraan belum bisa dipercaya (sepeda motor 29% dan truk 12% dari deteksi 6 jam terakhir pada 12 Okt). E2–E3 (kg/jam dari klip video) tetap menunggu uji kelayakan dan diusulkan untuk final.
- Faktor per kendaraan-km yang dipakai lapisan itu: CO₂ 58,8 / 199,2 / 666,1 / 532,9 g (motor / mobil / bus / truk, dari faktor per kg BBM dan asumsi konsumsi di bawah); NOx 0,29 / 2,18 / 11,9 / 17,7; CO 14 / 35,5 / 11 / 8,4. Mobil = 88% bensin + 12% solar.

- **E1 (kartu kualitas udara): dijadwalkan sebelum 16 Okt**, diperluas menjadi kartu "Kondisi luar ruang" (udara, suhu terasa, indeks UV, hujan). Sumber diuji 11 Okt pukul 11.00 WIB: PM2.5 44,2 µg/m³, US AQI 139, UV 10,1, suhu terasa 39,3 °C.
- **E2–E3 (arus kendaraan dan estimasi emisi): uji kelayakan dulu, baru diputuskan.** Pada hitungan snapshot yang sudah tersimpan, sepeda motor hanya 18% (malam 10 Okt) sampai 24% (siang 11 Okt) dari kendaraan terdeteksi, jauh di bawah porsi motor yang lazim di jalan kota. Karena motor adalah penyumbang utama CO dan HC dalam rumus Tier 2, estimasi emisi dari hitungan saat ini akan terlalu rendah. Langkahnya: rekam 2–3 klip siang dan malam, hitung manual, bandingkan dengan sistem. Jika galat hitungan motor di bawah ±30%, E2–E3 dibangun untuk final; jika tidak, modul ini masuk rencana pengembangan di laporan.
- **Jika pelacakan klip dibangun, pemakaian pertamanya adalah indikator "kendaraan tertahan" saat genangan** (insight genangan → lalu lintas), baru kemudian emisi.
- `supabase/schema_emissions.sql` belum dijalankan. Jalankan hanya saat fiturnya dikerjakan; file itu mengubah constraint metrik di tabel `baselines`.

## Konsep: dua hal yang harus dibedakan

| | Kualitas udara | Emisi kendaraan |
|---|---|---|
| Arti | Konsentrasi polutan di udara (µg/m³) | Massa polutan yang dikeluarkan kendaraan (gram/kg) |
| Asal data | API dan stasiun ukur (sudah ada) | **Dihitung sendiri** dari arus kendaraan CCTV × faktor emisi resmi |
| Sifat | Model (Open-Meteo/CAMS) atau terukur (stasiun BMKG) | Estimasi (metode Tier 2) |
| Resolusi | Satu titik stasiun / grid ±45 km | Per kamera/ruas, per jam |

**Aturan komunikasi (UI, laporan, prompt AI):** emisi selalu disebut "estimasi"; kualitas udara selalu disebut sumbernya (model atau terukur). **Jangan** mengklaim emisi di satu simpang menyebabkan perubahan PM2.5 kota; resolusi data udara tidak memungkinkan kesimpulan itu.

## Ringkasan fitur

| ID | Fitur | Kecocokan data | Prioritas |
|---|---|---|---|
| E1 | Kartu kualitas udara kota (model + terukur, kategori ISPU, saran kesehatan) | ✅ Teruji | **P1** |
| E2 | Arus kendaraan dari klip video (YOLO + tracking + garis hitung) | ✅ data / 🟡 akurasi perlu diuji | **P1** (5 kamera) → P2 (10–15 kamera) |
| E3 | Estimasi emisi per ruas per jam (Tier 2, Permen LH 12/2010) | ✅ setelah E2 jalan | **P1** (jika E2 jalan) / P2 |
| E4 | "Biaya emisi genangan" dan indikator kemacetan | 🟡 | P2 |
| E5 | Paparan emisi di dekat sekolah dan fasilitas kesehatan | ✅ (butuh B4 OSM) | P2 |
| E6 | Pola harian emisi vs kualitas udara (validasi kualitatif) | 🟡 | P2 |
| E7 | Peta NO₂ satelit bulanan (Sentinel-5P) | ✅ tersedia global / 🟡 | P3 |
| E8 | Komposisi armada dan "siapa penyumbang terbesar" | ✅ setelah E2 | P2 |

---

## E1 — Kartu kualitas udara kota · ✅ · P1

### Sumber (diuji 11 Okt 2026)

1. **Open-Meteo Air Quality API** (model CAMS global, ±45 km, 3-jaman diinterpolasi per jam)
   ```
   GET https://air-quality-api.open-meteo.com/v1/air-quality
       ?latitude=-6.98&longitude=110.42
       &hourly=pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide,ozone,us_aqi
       &current=pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,us_aqi
       &forecast_days=2&timezone=Asia%2FJakarta
   ```
   - Hasil uji pukul 11.00 WIB: PM2.5 44,2 µg/m³, PM10 52,6, NO₂ 4,2, CO 234 µg/m³, US AQI 139. Grid yang dikembalikan: lat −7,0, lon 110,4 (satu sel untuk seluruh kota).
   - Gratis untuk non-komersial, tanpa key. **Atribusi wajib:** CAMS (Copernicus Atmosphere Monitoring Service) dan Open-Meteo.
   - Ambil setiap 60 menit; simpan `is_model = true`.

2. **Stasiun PM2.5 BMKG Semarang** (pengukuran nyata, per jam)
   - Tampil di https://www.bmkg.go.id/kualitas-udara/pm25. Uji 11 Okt pukul 10.00 WIB: **43,5 µg/m³, kategori Sedang**.
   - Belum ada API resmi yang terdokumentasi. Opsi:
     - **WAQI** (aqicn.org, stasiun Semarang yang meneruskan data BMKG): API gratis dengan token. Syarat: atribusi WAQI dan sumber asli (BMKG), **tidak boleh mendistribusikan ulang data dalam bentuk cache/arsip**, dan pemakaian publik oleh lembaga nirlaba harus memberi tahu WAQI lebih dulu. Konsekuensi: tampilkan nilai terkini; untuk riwayat, simpan hanya untuk analisis internal dan minta izin sebelum menampilkan arsip.
     - Minta akses data ke BMKG.
   - Jika tidak ada akses, tampilkan tautan ke halaman BMKG dan tetap pakai Open-Meteo dengan label "model".

3. **Sumber opsional:** OpenAQ v3 (butuh API key; lokasi Semarang belum dicek), Google Air Quality API (mencakup Indonesia dengan indeks lokal versi KLHK, berbayar), sensor Nafas (pernah dipasang 5 titik di Semarang pada 2022; akses data belum jelas).

### Kategori ISPU dan saran

- Gunakan kategori **ISPU (Permen LHK No. 14/2020)**: Baik, Sedang, Tidak Sehat, Sangat Tidak Sehat, Berbahaya.
- Konversi konsentrasi PM2.5 → ISPU dengan interpolasi linear antar batas. Batas yang umum dipakai untuk PM2.5 (µg/m³): 0–15,5 (ISPU 0–50), 15,5–55,4 (51–100), 55,4–150,4 (101–200), 150,4–250,4 (201–300), >250,4 (>300). **Verifikasi tabel batas dengan lampiran Permen LHK 14/2020 sebelum dipakai**, termasuk ketentuan periode rata-rata. (Cek silang: BMKG mengategorikan 43,5 µg/m³ sebagai Sedang, konsisten dengan rentang 15,5–55,4.)
- Simpan tabel batas di konfigurasi, bukan hard-code tersebar.
- Tampilkan pembanding **pedoman WHO 2021** untuk PM2.5 (24 jam: 15 µg/m³; tahunan: 5 µg/m³) sebagai konteks kesehatan.
- Saran singkat per kategori (template, bukan LLM), mis. Tidak Sehat → "Kurangi aktivitas berat di luar ruangan; kelompok sensitif disarankan memakai masker."

### UI
Kartu di beranda "Denyut Kota" + halaman `/udara`: nilai terkini (terukur dan model, berdampingan dengan label sumber), kategori ISPU (warna + teks), grafik 24 jam dan prakiraan 48 jam (model), pembanding WHO, saran.

---

## E2 — Arus kendaraan dari klip video · ✅ / 🟡 · P1 (5 kamera) → P2

Snapshot 5 menit hanya memberi **kepadatan** (kendaraan terlihat). Emisi butuh **arus** (kendaraan lewat per jam), jadi perlu klip video pendek dan pelacakan.

### Pemilihan kamera
- Mulai **5 kamera** lalu lintas dengan sudut jelas (jalan terlihat memanjang, tidak terhalang), lalu 10–15 untuk final. Prioritaskan kamera yang juga kamera genangan (JRAKAH, SP. AKPOL, Tugumuda 3, Simpang Lima, Jembatan Mberok, dll.) agar E4 bisa dihitung.
- Set `cameras.flow_enabled = true` dan gambar **garis hitung** (`counting_line`) di alat kalibrasi admin (tambahkan mode "garis hitung" pada `/admin/kalibrasi/[id]`), melintang di seluruh lebar jalan, beri label arah.

### Akuisisi klip
- Setiap 15 menit per kamera (`FLOW_INTERVAL_MINUTES`), rekam 30 detik (`FLOW_CLIP_SECONDS`) tanpa encode ulang:
  ```bash
  ffmpeg -nostdin -loglevel error -rw_timeout 15000000 -i "<url m3u8>" -t 30 -c copy -y clip.ts
  ```
- Jalankan di antrean terpisah dari siklus snapshot agar siklus 5 menit tidak terlambat. Batasi konkurensi (mis. 2 klip paralel).

### Penghitungan
- Ultralytics YOLO11n dengan tracker ByteTrack: `model.track(source="clip.ts", tracker="bytetrack.yaml", classes=[2,3,5,7], persist=True, stream=True)`.
- Untuk tiap track ID, ambil titik tengah-bawah kotak; hitung **sekali** saat titik berpindah sisi garis hitung (perubahan tanda hasil perkalian silang), catat arah. Alternatif: modul `solutions.ObjectCounter` Ultralytics.
- Kelas: motorcycle(3), car(2), bus(5), truck(7). Simpan jumlah per kelas dan per arah, `flow_per_hour = total × 3600 / window_seconds`.
- **Indikator kemacetan:** `mean_track_speed` (perpindahan rata-rata titik track per detik, ternormalisasi terhadap tinggi frame) dan `stopped_share` (proporsi track yang hampir tidak bergerak). Ini bukan km/jam, hanya proksi relatif terhadap kondisi normal kamera tersebut.
- Hapus klip setelah dianalisis (simpan hanya angka), kecuali sampel untuk evaluasi.
- Malam hari/IR: tandai `is_night`; akurasi lebih rendah, tetap disimpan dengan kualitas.

### Evaluasi (wajib sebelum angka emisi ditampilkan)
Hitung manual 10 klip (siang dan malam) per kelas, bandingkan dengan sistem: galat persentase per kelas. Sepeda motor yang rapat sering tergabung dalam satu kotak; laporkan apa adanya.

---

## E3 — Estimasi emisi per ruas per jam · P1 (jika E2 jalan) / P2

### Metode Tier 2

Untuk polutan dengan faktor dalam g/km (CO, HC, NOx, PM10, SO₂):

```
E_p = Σ_j ( Q_j × L × FE_{j,p} )
```

- `Q_j` = jumlah kendaraan jenis j yang lewat pada periode (dari `traffic_flows`, dijumlahkan per jam; jika klip hanya 30 detik per 15 menit, ekstrapolasi: rata-rata `flow_per_hour` dari klip dalam jam tersebut)
- `L` = panjang ruas yang diwakili kamera (km), dari `road_segments.length_km`
- `FE_{j,p}` = faktor emisi (g/km), tabel `emission_factors`

Untuk CO₂ (faktor dalam g/kg BBM, pendekatan IPCC 2006):

```
E_CO2 = Σ_j ( Q_j × L × (1 / km_per_liter_j) × density_j × FE_{j,CO2} )
```

Pemetaan kelas YOLO → jenis kendaraan (`vehicle_assumptions`):
- motorcycle → sepeda_motor (100%)
- car → mobil_bensin 88% + mobil_solar 12% (proporsi dari sampel mobil penumpang studi TRUE Jakarta, ICCT/ITB 2021; sampel itu dari gerbang tol sehingga mungkin bias)
- bus → bus; truck → truk

### Faktor emisi (Permen LH No. 12/2010)

| Jenis | CO | HC | NOx | PM10 | SO₂ | CO₂ |
|---|---|---|---|---|---|---|
| | g/km | g/km | g/km | g/km | g/km | g/kg BBM |
| Sepeda motor | 14 | 5,9 | 0,29 | 0,24 | 0,008 | 3.180 |
| Mobil bensin | 40 | 4 | 2 | 0,01 | 0,026 | 3.180 |
| Mobil solar | 2,8 | 0,2 | 3,5 | 0,53 | 0,44 | 3.172 |
| Bus | 11 | 1,3 | 11,9 | 1,4 | 0,93 | 3.172 |
| Truk | 8,4 | 1,8 | 17,7 | 1,4 | 0,82 | 3.172 |

Sumber tabel: Permen LH No. 12/2010 sebagaimana dikutip Rahendaputri dkk. (2020). Cek ulang dengan dokumen Permen aslinya untuk laporan.

### Asumsi (wajib ditampilkan di UI dan laporan)

| Jenis | km/liter | Densitas BBM (kg/L) | Status |
|---|---|---|---|
| Sepeda motor | 40 | 0,74 | ASUMSI |
| Mobil bensin | 12 | 0,74 | ASUMSI |
| Mobil solar | 12 | 0,84 | ASUMSI |
| Bus | 4 | 0,84 | ASUMSI |
| Truk | 5 | 0,84 | ASUMSI |

Semua asumsi ada di tabel `vehicle_assumptions` sehingga bisa diganti tanpa mengubah kode. Ganti dengan data resmi jika ditemukan, dan cantumkan sumbernya di kolom `source_note`.

### Panjang ruas
- Default 1,0 km ("segmen representatif") sampai diisi.
- Lebih baik: dari data OSM (lihat B4 di `11-feature-backlog.md`), pilih *way* jalan terdekat dengan kamera dan ambil panjang segmen antar simpang terdekat; simpan `osm_way_ids` dan `road_class`.

### Contoh hitung (sudah dijalankan di database)

Satu jam, ruas 1 km, arus: 1.200 sepeda motor, 400 mobil, 10 bus, 30 truk.

| Polutan | Hasil |
|---|---|
| CO | 31,4 kg |
| HC | 8,6 kg |
| NOx | 1,87 kg |
| PM10 | 0,37 kg |
| SO₂ | 0,07 kg |
| CO₂ | 172,9 kg |

### Penjadwalan dan penyimpanan
- Job per jam: hitung `emission_estimates` (periode 60 menit) untuk setiap kamera `flow_enabled` yang punya data arus jam tersebut. Simpan salinan faktor dan asumsi di kolom `assumptions` (jejak audit).
- Baseline metrik `flow_per_hour`, `nox_g_per_hour`, `co2_g_per_hour` per jam-dalam-minggu (lihat `fusion/baseline.py`), untuk **indeks emisi relatif** (×1,4 dari biasanya).
- View `v_emissions_24h` untuk total 24 jam per kamera.

### UI (`/emisi`)
- Peta: lingkaran per kamera, ukuran = CO₂ per jam, warna = indeks relatif terhadap baseline.
- Grafik per kamera: arus per jenis kendaraan dan emisi per jam (hari ini vs baseline).
- Komposisi kontribusi per jenis kendaraan (E8).
- Kotak "Metode & asumsi": rumus, tabel faktor emisi, tabel asumsi, keterbatasan.

---

## E4 — "Biaya emisi genangan" dan kemacetan · 🟡 · P2

**Penting secara metodologis:** faktor Tier 2 tidak bergantung kecepatan. Saat macet, arus (kendaraan lewat per jam) bisa **turun** walaupun kendaraan menumpuk, sehingga Tier 2 murni bisa memberi kesan emisi turun padahal kendaraan terjebak lebih lama. Karena itu, dampak genangan dihitung dengan dua indikator:

1. **Kendaraan-jam tertahan:** selama kejadian genangan, selisih kepadatan (snapshot YOLO) di atas baseline × durasi, plus `stopped_share` dari E2.
2. **Estimasi CO₂ tambahan dari antrean (idle):** kendaraan-jam tertahan per jenis × `idle_liter_per_hour` × densitas × faktor CO₂. Disimpan di `emission_estimates.idle_co2_g`. Nilai `idle_liter_per_hour` adalah ASUMSI di `vehicle_assumptions`.

Contoh insight: *"Selama genangan 2 jam di Jl. Kaligawe, ±600 kendaraan-jam tertahan di 3 kamera sekitar, setara estimasi tambahan ±X kg CO₂ dari mesin menyala saat antre."* Selalu sertakan "estimasi" dan tautan ke asumsi.

Pengembangan lanjutan (P3): faktor emisi bergantung kecepatan (kurva COPERT, EMEP/EEA Guidebook) dengan estimasi kecepatan dari tracking yang sudah dikalibrasi jarak.

---

## E5 — Paparan di dekat fasilitas sensitif · P2
Gabungkan `emission_estimates` dengan `camera_facilities` (B4): koridor dengan indeks NOx/PM10 tertinggi dalam radius 300–500 m dari sekolah, rumah sakit, puskesmas, terutama jam masuk (06.30–07.30) dan pulang sekolah. Insight untuk Dishub dan Dinas Pendidikan/Kesehatan, mis. rekayasa titik antar-jemput.

## E6 — Pola emisi vs kualitas udara · P2
Bandingkan pola harian total estimasi emisi kota (jumlah dari kamera `flow_enabled`) dengan PM2.5 BMKG/Open-Meteo per jam. Tampilkan sebagai **pola berdampingan**, bukan korelasi sebab-akibat. Catat faktor lain yang tidak dimodelkan (angin, hujan, sumber non-kendaraan).

## E7 — Peta NO₂ satelit bulanan · P3
Sentinel-5P TROPOMI NO₂ (Google Earth Engine, koleksi `COPERNICUS/S5P/OFFL/L3_NO2` atau NRTI) rata-rata bulanan di atas Semarang, sebagai layer konteks. Resolusi kasar dan sering terhalang awan. Referensi pembanding: CREA EmisiMap (hotspot NOx Indonesia dari TROPOMI).

## E8 — Komposisi armada · P2
Dari E2/E3: proporsi jenis kendaraan per kamera dan kontribusi tiap jenis terhadap tiap polutan. Contoh: *"Sepeda motor 70% dari arus tetapi menyumbang ±X% HC; truk 2% arus tetapi menyumbang ±Y% NOx."* Didukung temuan TRUE Jakarta (ICCT/ITB): per liter bahan bakar, sepeda motor mengeluarkan NOx/CO/HC sekitar 20×/6×/8× mobil bensin, dan kendaraan diesel jauh lebih tinggi NOx-nya.

---

## Integrasi ke modul lain

- **Insight LLM (`07-ai-prompts.md`):** tambahkan ke `facts` situasi: kualitas udara terkini (nilai, sumber, model/terukur, kategori ISPU) dan emisi (indeks relatif per kamera, kontributor terbesar). Tambahkan aturan prompt: *"Emisi adalah estimasi Tier 2 berbasis faktor emisi Permen LH 12/2010 dan asumsi konsumsi BBM, bukan pengukuran. Jangan menyimpulkan bahwa emisi satu lokasi menyebabkan perubahan PM2.5 kota. Sebut sumber data kualitas udara dan apakah itu model atau terukur."*
- **Peringatan baru (opsional):** `air_quality_unhealthy` saat kategori ISPU ≥ Tidak Sehat (sumber terukur diutamakan). Jika dipakai, tambahkan nilai ini ke constraint `alerts.type` lewat migrasi.
- **Asisten AI:** tool baru `get_air_quality(hours)` dan `get_emissions(camera_id?, hours)`.
- **Halaman "Cara Kerja AI" (D1):** tambahkan alur klip → tracking → arus → emisi.

## Konfigurasi (`.env`)

```
AIR_QUALITY_INTERVAL_MINUTES=60
WAQI_TOKEN=                    # opsional; patuhi syarat WAQI
FLOW_ENABLED=true
FLOW_INTERVAL_MINUTES=15
FLOW_CLIP_SECONDS=30
FLOW_MAX_PARALLEL=2
EMISSION_JOB_MINUTE=5          # menit ke-5 setiap jam
```

## Rencana kerja

- **P1 (sebelum 16 Okt, setelah inti stabil):** E1 penuh. E2 + E3 untuk 5 kamera jika waktu cukup; jika tidak, E1 saja dan E2/E3 pindah ke P2.
- **P2 (final):** E2/E3 untuk 10–15 kamera dengan evaluasi hitungan manual, E4, E5, E6, E8.
- **P3:** E7, faktor emisi bergantung kecepatan.

## Referensi

1. Permen LH No. 12 Tahun 2010 tentang Pelaksanaan Pengendalian Pencemaran Udara di Daerah (faktor emisi kendaraan), sebagaimana dikutip dalam: Rahendaputri, C. S., Maria, M., & Fausia, R. N. (2020). Kajian Beban Emisi Pencemar Udara Sektor Transportasi Darat di Lingkungan ITK dengan Metode Tier 2. https://journal.itk.ac.id/index.php/sjt/article/download/167/86
2. Rahmasari, R. N., Jati, D. R., & Jumiati (2023). Inventarisasi Emisi dari Sektor Transportasi Darat di Kota Pontianak. *Jurnal Ilmu Lingkungan* 21(3). https://ejournal.undip.ac.id/index.php/ilmulingkungan/article/view/47385
3. IPCC (2006). Guidelines for National Greenhouse Gas Inventories, Vol. 2 Ch. 3 Mobile Combustion. https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_3_Ch3_Mobile_Combustion.pdf
4. EMEP/EEA Air Pollutant Emission Inventory Guidebook 2023, 1.A.3.b.i Road transport. https://www.eea.europa.eu/publications/emep-eea-guidebook-2023/part-b-sectoral-guidance-chapters/1-energy/1-a-combustion/1-a-3-b-i
5. ICCT / TRUE Initiative & ITB (2022). Real-world vehicle emissions in Jakarta (remote sensing, 2021). https://theicct.org/wp-content/uploads/2022/11/true-jakarta-remote-sensing-in-nov22.pdf
6. Permen LHK No. 14 Tahun 2020 tentang Indeks Standar Pencemar Udara. https://mail.ppkl.menlhk.go.id/website/filebox/988/210704011643PERMEN%20ISPU%20NO%2014%20TAHUN%202020.pdf
7. Open-Meteo – Air Quality API. https://open-meteo.com/en/docs/air-quality-api
8. BMKG – Konsentrasi Partikulat PM2.5. https://www.bmkg.go.id/kualitas-udara/pm25
9. WAQI – Semarang. https://aqicn.org/city/@13651/ ; syarat token: https://aqicn.org/data-platform/token/
10. OpenAQ API v3. https://docs.openaq.org/resources/locations
11. Google Air Quality API – coverage. https://developers.google.com/maps/documentation/air-quality/coverage
12. Nafas – sensor di Semarang, Surabaya, Malang. https://nafas.co.id/blog/New-sensors-have-arrived-Semarang-Surabaya-and-Malang
13. WHO Global Air Quality Guidelines (2021) – ringkasan. https://www.airclim.org/who-air-quality-guidelines
14. Google Earth Engine – Sentinel-5P NO₂. https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S5P_NRTI_L3_NO2
15. CREA – EmisiMap NOx dashboard explainer. https://emisimap.energyandcleanair.org/documents/EmisiMap%20-%20NOx%20dashboard%20explainer.pdf
16. Connecting Vision and Emissions: A Behavioural AI Approach to Carbon Estimation in Road Design (arXiv 2025). https://arxiv.org/pdf/2506.18924

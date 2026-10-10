# 03 — Sumber Data

## 1. PANTAUSEMAR (CCTV publik Kota Semarang)

- Situs: https://pantausemar.semarangkota.go.id/
- Tidak ada API resmi dan tidak ada syarat penggunaan tertulis. Data diambil dari halaman publik yang sama yang dilihat warga.

### Cara situs menyajikan data (hasil inspeksi 9–10 Okt 2026)

- Daftar kamera **tertanam di HTML** sebagai variabel JavaScript `var cctvs = [...]`, satu halaman per kategori:
  `https://pantausemar.semarangkota.go.id?cctv_category_id=<UUID>`
- Struktur satu titik:
  ```json
  {
    "cctv_id": 414,
    "owner_name": "KYAI SALEH",
    "lat": "-6.986660206981591",
    "lng": "110.41393529540247",
    "links": [
      {
        "id": 307,
        "is_preview": 1,
        "name": "KYAI SALEH",
        "owner_name": "DINAS PERHUBUNGAN KOTA SEMARANG",
        "status": 1,
        "url": "https://livepantau.semarangkota.go.id/<uuid>/index.m3u8"
      }
    ]
  }
  ```
  Satu titik bisa punya beberapa `links` (beberapa kamera). **Kunci unik kamera = `links[].id`.** Satu kamera bisa muncul di beberapa kategori.
- UUID kategori:

  | Slug | Nama di situs | UUID |
  |---|---|---|
  | `kantor` | KANTOR PEMERINTAHAN | `ee2827a7-f7a2-4599-bd22-5bbf4844fa2d` |
  | `lalin` | PANTAU LALIN | `fc3ed271-787c-4191-a7dd-fc84314a9f71` |
  | `pompa` | PANTAU POMPA AIR | `5b5b7e51-3a2e-446f-8fae-50d8e9e7196d` |
  | `pariwisata` | PARIWISATA | `815111a4-2beb-41f0-a44a-d6d11dfc31ca` |
  | `genangan` | RAWAN GENANGAN AIR | `df69dbea-87c9-4d79-9ddc-f388c33f2dc9` |
  | `sungai` | SUNGAI | `194fd5d9-098f-4dbe-93da-8288c6761bf0` |
  | *(dikecualikan)* | RT RW | `78076941-792e-4bd1-93cb-e1cd415cf15c` |

- Stream: **HLS** (`index.m3u8`, kadang berupa master playlist yang menunjuk ke chunklist). Codec H.264. Resolusi bervariasi dari 352×288 sampai 1920×1080.
- **CORS terbuka:** stream bisa diputar langsung dari domain lain dengan `hls.js`.

### Hasil uji

| Waktu | Uji | Hasil |
|---|---|---|
| 9 Okt 2026 malam | Putar 12 kamera campuran (genangan, sungai, lalin, pompa, wisata) dengan hls.js | **12/12 gambar bersih**, tanpa artefak |
| 10 Okt 2026 18.40 WITA | Uji playlist semua kamera non-RT/RW | **146 kamera unik, 135 hidup (92%)** |

Per kategori (10 Okt): genangan 13/14, kantor 12/12, lalin 57/66, pompa 62/64, pariwisata 9/9, sungai 22/23. Kamera air unik (sungai ∪ pompa ∪ genangan): **76, hidup 73**.

**Temuan berguna:**
- **12 kamera berkategori lalin sekaligus genangan** (mis. JRAKAH, SP. AKPOL, Jembatan Mberok, SIMPANG LIMA 1 360, Tugumuda 3, Bawah Tol X3W_IN). Ideal untuk insight genangan → lalu lintas dari kamera yang sama.
- Banyak kamera pompa/sungai berpasangan **`-IN` / `-OUT`** (mis. Banger-IN / Banger-Out, Progo-IN / Progo-OUT, KP.Kali-IN / KP.Kali-OUT). Kemungkinan sisi masuk dan keluar rumah pompa: bisa dipakai untuk analisis kerja pompa (fitur final).
- Kamera pariwisata berada di kawasan Kota Lama, Lawang Sewu, dan Titik Nol.

### Seed data

- `data/cameras_semarang.json` dan `.csv`: 146 kamera unik dengan `source_link_id`, nama, `categories[]`, pemilik, koordinat, URL stream, `alive_at_check`.
- Worker perlu skrip **sinkronisasi harian** yang mengambil ulang daftar dari situs (parse `var cctvs = [...]` per kategori), upsert berdasarkan `source_link_id`, menandai kamera yang hilang sebagai `is_active = false` (jangan dihapus).
- Parsing: regex `var\s+cctvs\s*=\s*(\[[\s\S]*?\]);` lalu `json.loads`. Jika struktur situs berubah, sinkronisasi gagal dengan log jelas, tetapi worker tetap memakai daftar di database.

### Cara mengambil frame

```bash
ffmpeg -nostdin -loglevel error -rw_timeout 15000000 \
  -i "https://livepantau.semarangkota.go.id/<uuid>/index.m3u8" \
  -frames:v 1 -q:v 3 -y out.jpg
```
- Bungkus dengan timeout proses (mis. 20 detik).
- Kirim header `User-Agent` browser yang wajar. Jangan membebani server: konkurensi maksimum 8, interval 5 menit per kamera.

## 2. Open-Meteo (cuaca)

- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Contoh:
  ```
  ?latitude=-6.99&longitude=110.42
  &current=precipitation,rain
  &hourly=precipitation,precipitation_probability
  &forecast_days=2&timezone=Asia%2FJakarta
  ```
- Gratis, tanpa API key, untuk penggunaan non-komersial. Cek batas pemakaian di https://open-meteo.com/en/terms.
- Strategi: **grid ±6–9 titik** yang menutupi Kota Semarang (cuaca tidak perlu per kamera). Setiap kamera dipetakan ke titik grid terdekat (`cameras.weather_grid_id`). Ambil setiap 30 menit.
- Data yang dipakai: hujan saat ini (mm), total prakiraan 1, 3, 6 jam ke depan (mm), probabilitas hujan maksimum 3 jam ke depan.

## 3. Data pendukung untuk laporan (bukan untuk sistem)

Cari dan kutip dengan sumber yang jelas:
- Riwayat kejadian banjir/genangan Semarang (BPBD Kota Semarang, BNPB DIBI).
- Penurunan muka tanah dan rob di pesisir Semarang (publikasi ilmiah, BIG).
- Sistem polder dan rumah pompa Kota Semarang (Dinas PU/Pusdataru).

## 4. Kota cadangan (jika PANTAUSEMAR bermasalah)

Hasil uji 9 Okt 2026:

| Kota | Portal | Kamera | Kualitas | Catatan |
|---|---|---|---|---|
| Yogyakarta | cctv.jogjakota.go.id (endpoint `/home/getdata`, butuh header `X-Requested-With: XMLHttpRequest`) | 142/150 hidup | 12/12 bersih | Cadangan terbaik; lalu lintas, Malioboro, taman, TPS liar, beberapa sungai |
| Surakarta | ccroom-dishub.surakarta.go.id/index.php/cctv | 96 | 9/12 bersih | HTTP-FLV; browser maks. 6 stream sekaligus |
| Bandung | pelindung.bandung.go.id | ±250 hidup dari 436 | **2/12 bersih** | Gambar banyak rusak di sumber; tidak direkomendasikan |

Arsitektur sengaja memisahkan sumber (`worker/semarsight_worker/sources/`) agar kota lain bisa ditambah sebagai modul sumber baru.

## 5. Etika, privasi, dan izin

- **Tidak memakai kamera RT/RW** (lingkungan perumahan warga).
- **Tidak ada pengenalan wajah dan tidak ada pembacaan pelat nomor.** YOLO hanya menghitung objek per kelas.
- **Retensi:**
  - Frame penuh di disk worker: maksimal 14 hari, lalu dihapus otomatis kecuali yang dipakai untuk label evaluasi atau snapshot kejadian.
  - Supabase Storage: hanya snapshot terbaru per kamera (ditimpa) dan snapshot kejadian.
  - Angka agregat (jumlah, status, skor) disimpan tanpa batas.
- **Beban server sumber:** satu frame per kamera per 5 menit, konkurensi terbatas.
- **Izin:** kirim email permohonan izin pemanfaatan data ke Diskominfo Kota Semarang dan lampirkan buktinya di laporan. Cantumkan atribusi "Sumber: PANTAUSEMAR, Pemerintah Kota Semarang" di website.

# 06 — Spesifikasi Web (Next.js)

## Stack dan konvensi

- Next.js 16 (App Router, Cache Components aktif) + TypeScript (strict) + Tailwind CSS 4.
  - Dengan Cache Components, opsi `revalidate` per halaman tidak dipakai. Komponen server yang membaca Supabase dibungkus `<Suspense>` dengan skeleton, sehingga kerangka halaman tampil seketika dan datanya selalu diambil saat diminta.
  - Waktu relatif ("x menit lalu") dihitung di komponen client (`useNow`), bukan di server.
  - Konvensi versi ini berbeda dari versi lama; rujuk `web/node_modules/next/dist/docs/` sebelum memakai API yang belum dipakai di repo.
- Data: `@supabase/supabase-js`. Dua client:
  - `lib/supabase/public.ts`: kunci publik (anon), read-only, dipakai komponen server maupun browser (query publik dan Realtime).
  - `lib/supabase/server.ts`: service role, **hanya** di route handler/server action (`import "server-only"`). Dibuat bersama halaman admin.
- Peta: `react-leaflet` + tile OpenStreetMap (atribusi wajib). Komponen peta di-*dynamic import* dengan `ssr: false`.
- Grafik: Recharts. Validasi: Zod. Tanggal: tampilkan dalam `Asia/Jakarta` (WIB).
- Video live (opsional): `hls.js` langsung ke URL stream (CORS PANTAUSEMAR terbuka). Default yang ditampilkan adalah **snapshot**, bukan video.
- Semua teks UI dalam Bahasa Indonesia. Simpan label status dan warna di satu file (`lib/status.ts`) agar konsisten.

## Arah visual: insight dulu, kamera sebagai bukti (keputusan 11 Okt)

Pengguna tidak datang untuk menonton CCTV; mereka datang untuk tahu wilayah mana yang bermasalah dan harus berbuat apa. Halaman publik disusun dalam tiga lapis: insight di depan, rincian wilayah di tengah, kamera sebagai bukti di belakang.

1. **Satuan utama di peta adalah kecamatan (16), bukan titik kamera.** Titik kamera menjadi lapisan tambahan yang mati secara bawaan.
2. **Bentuk visual mengikuti jenis data:** nilai per wilayah → choropleth; intensitas di titik ukur → heatmap radius kecil atau lingkaran proporsional; hubungan hulu–hilir → garis alir; pola waktu → heatmap jam × hari.
3. **Kartu insight berpola Kondisi → Penyebab → Dampak → Tindakan**, sesuai bentuk `insights` (temuan, bukti, rekomendasi per audiens).
4. **Tampilan saling terhubung:** memilih kecamatan di peta mengisi panel wilayah (tren 24 jam, temuan, jumlah titik pantau, tautan "lihat buktinya").
5. **Empat zona layar:** peta utama 50–70%, grafik pendukung 20–30%, kontrol 10–20%, lalu legenda dan keterangan.
6. **Jujur soal cakupan.** Sebaran kamera sangat tidak merata (74 dari 146 di Semarang Utara/Tengah; Mijen dan Tembalang nol). Kecamatan tanpa titik pantau tampil sebagai "tidak terpantau", bukan "aman". Warna heatmap di antara titik ukur adalah perkiraan dan diberi keterangan di legenda.
7. Palet aman buta warna, maksimal 5–7 kelas, legenda menyebut satuan, sumber, dan waktu data.

Menu utama berisi halaman insight (Beranda, Peta, Air, Lalu Lintas, Riwayat). `/kamera/[id]` dan `/mosaik` masuk kelompok sekunder "Sumber data". Halaman yang sudah berjalan (peta titik kamera, mosaik, detail kamera) tetap dipakai sebagai lapisan bukti; Beranda dan Peta dibangun ulang mengikuti arah ini.

Kebutuhan data baru: batas 16 kecamatan (GeoJSON), pemetaan kamera → kecamatan, dan agregat per kecamatan.

### Yang sudah dibangun (11 Okt)

- **Beranda `/`** kini berisi: kalimat kondisi kota yang disusun dari aturan (`citySituation` di `lib/insight.ts`, bukan LLM, jadi selalu tersedia), daftar peringatan aktif (Realtime), peta tematik per kecamatan, panel wilayah, dan dua daftar peringkat (lokasi air menurut risiko, lalu lintas paling padat dibanding kebiasaannya).
- **Peta tematik** punya tiga tema: risiko air (warna = lokasi dengan skor risiko tertinggi di kecamatan itu), kepadatan lalu lintas (median indeks kepadatan relatif kamera lalu lintas yang hidup; batas kelas sama dengan worker), dan hujan 3 jam ke depan (titik grid Open-Meteo terdekat ke pusat kecamatan). Sumber data tiap tema digambar sebagai titik kecil.
- **Kecamatan tanpa sumber data** untuk tema yang dilihat diberi warna abu-abu bergaris putus dan label "Tidak terpantau". Saat ini lokasi air baru terpantau di 9 dari 16 kecamatan.
- **Pemetaan kamera → kecamatan** dihitung di web (titik-dalam-poligon di `lib/geo/districts.ts`), tanpa kolom baru di database.
- **Peta titik kamera pindah ke `/kamera`** dan, bersama `/mosaik`, masuk kelompok "Sumber data" di menu. `/peta` dialihkan ke `/kamera`.
- **Tata letak peta penuh (11 Okt malam):** di layar lebar peta memenuhi seluruh area di bawah header dan semua isi lain mengambang di atasnya sebagai panel. Kiri atas: kondisi kota dan empat angka utama (bisa diciutkan). Tengah atas: pilihan tema. Kanan: tab Peringatan, Risiko air, dan Lalu lintas, yang berganti menjadi rincian kecamatan saat satu wilayah dipilih. Tengah bawah: legenda. Memilih kecamatan, atau menekan tombol pin di daftar peringkat, menggeser peta ke wilayah itu. Di layar sempit peta berada di atas dan panel bertumpuk di bawahnya.
- **Halaman kamera menjadi ruang bukti visual:** gambar terakhir, hasil penilaian AI, pembanding kondisi normal dan sekarang, gambar-gambar yang dinilai AI sebelumnya (disimpan worker selama 3 hari), rincian skor risiko per komponen, dan kamera terdekat.
- **Kartu insight dari LLM (12 Okt):** tab "Insight" menjadi tab pertama panel kanan beranda. Isinya lencana tingkat (dari aturan), judul dan ringkasan, lalu kartu berpola Kondisi → Penyebab → Dampak → Tindakan (`components/insight/AiInsight.tsx`). Kondisi selalu terlihat; penyebab, dampak, tindakan per audiens, dan dasar data dibuka saat diklik, dan hanya temuan di atas "info" yang langsung terbuka. Tautan "Lihat buktinya" membuka halaman kamera. Panel kecamatan menampilkan temuan yang menyangkut lokasi di kecamatan itu. Tingkat `aman` ditulis "Tidak ada temuan penting", bukan "aman", karena yang diketahui hanya lokasi yang dipantau. Insight yang lebih tua dari 2 jam diberi keterangan tertunda; tanpa insight, panel menjelaskan bahwa kondisi kota di panel kiri tetap berlaku. Isi divalidasi Zod (`lib/ai-insight.ts`) dan diperbarui lewat Realtime.
- **Tren di panel kecamatan (12 Okt):** grafik irama lalu lintas 24 jam (rata-rata kendaraan terdeteksi per gambar, per jam, dari semua kamera lalu lintas di kecamatan itu; jam tanpa data digambar terputus), prakiraan hujan per jam untuk 12 jam ke depan, dan kalimat perubahan status air 24 jam terakhir yang diambil dari status terkonfirmasi, bukan dari penilaian AI tunggal. Pembacaan lalu lintas diambil per halaman 1.000 baris dan diringkas di browser (`lib/trend.ts`); bila kelak terasa lambat, pindahkan ke view agregat per jam di database.
- **`/simulasi` (12 Okt):** layar yang sama dengan beranda (`InsightScreen`), diisi langkah demi langkah dari skenario kejadian air naik. Pita di atas peta memuat label "SIMULASI · Bukan data langsung", jam simulasi, tombol Sebelumnya / Putar / Berikutnya (8 detik per langkah), dan penjelasan apa yang terjadi di balik layar pada langkah itu. `InsightView` kini hanya pembungkus data langsung untuk layar tersebut. Beranda menautkan ke simulasi dari keadaan "tidak ada peringatan aktif".
- **Perkembangan lokasi air terlihat di layar, bukan hanya di teks (12 Okt).** Berlaku untuk beranda dan simulasi karena keduanya memakai layar yang sama:
  - **Linimasa "Perkembangan 2 jam terakhir"** di bawah panel kiri (`ProgressTimeline`). Per lokasi: tiap penilaian AI adalah satu titik (penuh = dihitung aturan, kosong = tidak dihitung), dan pita di bawahnya adalah status resmi. Terlihat kapan AI mulai menilai naik dan kapan status resmi berubah. Hanya tampil bila ada lokasi yang statusnya di atas normal, baru berubah, sedang menunggu penilaian kedua, atau perlu diperiksa; pada hari yang tenang panel ini tidak ada.
  - **Penanda di peta:** lokasi yang baru sekali dinilai naik digambar sebagai lingkaran besar berwarna level yang dinilai, bertepi putus-putus yang berdenyut, dengan label tetap ("Progo-IN · AI menilai waspada · 1 dari 2"); lokasi yang status resminya di atas normal sebagai titik besar bertepi gelap dengan label statusnya. Keduanya digambar di atas titik lokasi lain.
  - **Dua istilah yang tidak boleh tertukar:** *status resmi* (ditetapkan aturan; yang dipakai untuk peringatan dan warna peta) dan *indikasi awal* (AI kamera baru sekali menilai naik; belum menjadi status resmi). Pemilik proyek sempat bingung melihat "Normal" dan "Waspada" berdampingan pada lokasi yang sama, jadi keduanya kini selalu diberi nama.
  - **Blok "Indikasi awal"** (`PendingReading`), di linimasa (ringkas) dan di kartu lokasi pada panel kecamatan (lengkap): status resmi dan penilaian AI kamera berdampingan, "1 dari 2 penilaian sepakat", waktu dan keyakinan, batas waktu penilaian kedua, kutipan alasan AI, dan apa yang terjadi bila penilaian kedua sepakat atau tidak. Pada data langsung ada tautan "Lihat gambar yang dinilai"; pada simulasi ditulis bahwa penilaiannya buatan dan tidak punya gambar.
  - **Tabel "Riwayat penilaian AI kamera"** (`ReadingHistory`) di kartu lokasi yang sedang bergerak: jam, hasil penilaian, keyakinan, dihitung aturan atau tidak, dan status resmi sesudahnya, enam penilaian terakhir.
  - **Ringkasan AI ikut tahu:** fakta insight memuat `pending_confirmation`, sehingga kartu insight menyebut penilaian yang menunggu konfirmasi dan tidak lagi menulis "semua normal" di sebelah penilaian waspada (temuan pemilik proyek pada langkah 3 simulasi).
  - Web tidak mengulang aturannya: worker menyimpan hasil aturan di tiap penilaian (`water_readings.raw.smoothing`: level yang dihitung, status resmi sebelum dan sesudahnya). Penilaian dimuat ulang tiap menit (tabelnya tidak ikut Realtime).
- **`/riwayat` (12 Okt):** tabel kejadian (mulai, lokasi, jenis, puncak, lama, selesai atau "masih berlangsung") dari tabel `events`, dengan tombol "Unduh CSV" (`/api/export/events`). Selama belum ada kejadian, halaman menjelaskannya dan menautkan ke simulasi. Menu utama kini: Beranda, Riwayat, Simulasi.
- **`/tentang` (12 Okt):** cakupan saat ini (dihitung dari data langsung), cara kerja dalam empat langkah, bobot skor risiko, daftar "yang tidak dilakukan sistem ini", privasi dan retensi, serta sumber data dan lisensinya. Isinya harus ikut diperbarui bila batasan berubah (misalnya setelah evaluasi malam atau kejadian nyata pertama).
- **Halaman kamera** menyebut nama lokasi hulu yang ikut menentukan skor risiko, atau mengatakan bahwa lokasi itu belum punya hulu yang terhubung.
- Belum dibangun: garis alir hulu–hilir, heatmap jam × hari, riwayat status air sebagai grafik (menunggu pencatatan kejadian).

## Halaman publik

| Rute | Nama | Isi utama |
|---|---|---|
| `/` | **Denyut Kota** | Kalimat kondisi kota, peringatan aktif, peta tematik per kecamatan (risiko air / kepadatan lalu lintas / hujan), panel wilayah, peringkat lokasi; insight AI menyusul |
| `/kamera` | Kamera sumber data | Peta penuh semua kamera; filter modul (Air / Lalu Lintas / Ruang Publik / Kesehatan Kamera); klik marker → panel kamera. `/peta` dialihkan ke sini |
| `/mosaik` | Semarang Saat Ini | Grid snapshot terbaru semua kamera dari Storage (bukan video live), saringan modul, hanya kamera aktif, cari nama |
| `/udara` | Kualitas Udara (direncanakan) | Kartu "Kondisi luar ruang": kualitas udara (model Open-Meteo, terukur BMKG jika ada akses) dengan label sumber dan kategori ISPU, suhu terasa, indeks UV, hujan; grafik 24 jam + prakiraan 48 jam |
| `/emisi` | Emisi (setelah uji kelayakan) | Peta estimasi emisi per kamera, arus per jenis kendaraan, kotak "Metode & asumsi" (lihat `12-emisi-kualitas-udara.md`) |
| `/air` | Air | **Berjalan sejak 13 Okt, tanpa menu sendiri** (dibuka dari Beranda: tombol biru "Lihat lokasi air satu per satu" di panel kiri yang langsung terlihat saat beranda dibuka, tab Risiko air, dan panel kecamatan; keputusan pemilik proyek, supaya navbar tetap ringkas dan tidak ada dua pintu untuk "air"). Peta penuh dengan satu pin per lokasi air yang dikalibrasi, berwarna status resmi. Kiri: kondisi sekarang, jumlah per status, hujan 3 jam ke depan, pasangan hulu → hilir, linimasa perkembangan. Kanan: lokasi yang paling perlu diperhatikan, atau rincian lokasi (status resmi, gambar dengan garis acuan, rincian skor risiko, hulu–hilir, lalu lintas di sekitarnya). Komponen: `components/water/WaterView.tsx`, `WaterMap.tsx`, `SitePanel.tsx`; logika: `lib/water.ts` |
| `/lalu-lintas` | Lalu Lintas | **Berjalan sejak 12 Okt.** Peta penuh dengan tiga lapisan (rincian di bawah tabel): Ruas jalan, Aktivitas per jam, Beban emisi |
| `/ruang-publik` | Ruang Publik | Keramaian kawasan wisata; pola per jam; "waktu terbaik berkunjung" |
| `/insight` | Insight | Insight lintas modul (genangan → lalu lintas, hujan → keramaian, sampah + hujan); laporan harian |
| `/riwayat` | Riwayat | Kejadian (tanggal, lokasi, durasi, puncak), statistik titik rawan, unduh CSV |
| `/kamera/[id]` | Detail kamera | Snapshot terbaru (+ tombol video live), status dan alasan AI, timeline status 24 jam, grafik kepadatan vs baseline, komponen skor risiko, kamera hulu/hilir terkait |
| `/replay` & `/replay/[eventId]` | Replay | Putar ulang kejadian terekam: slider waktu, snapshot, status, peringatan yang muncul, kecepatan 1×–60× |
| `/tentang` | Tentang | Cara kerja (pipeline), sumber data dan atribusi PANTAUSEMAR, batasan sistem, privasi |

Komponen global:
- **Banner status sistem:** muncul jika worker tidak terlihat > 15 menit ("Data mungkin tidak terbaru, terakhir diperbarui HH:MM WIB").
- **Penanda kesegaran:** setiap kartu/panel menampilkan "diperbarui X menit lalu".
- **Asisten AI** (fitur final): tombol mengambang → panel tanya-jawab.

## Halaman admin (dilindungi `ADMIN_PASSWORD`)

`proxy.ts` (nama baru middleware di Next.js 16) mengarahkan semua `/admin/*` dan `/api/admin/*` ke `/admin/login` jika tidak ada sesi. Sesi adalah cookie `httpOnly` berisi waktu kedaluwarsa (12 jam) yang ditandatangani HMAC-SHA256 dengan `ADMIN_SESSION_SECRET`. Setiap route handler dan halaman admin memeriksa ulang sesi itu sendiri, tidak hanya mengandalkan proxy. Semua aksi tulis lewat route handler dengan service role, dan masukannya divalidasi Zod (`lib/admin/schemas.ts`).

| Rute | Fungsi |
|---|---|
| `/admin/kamera` | Tabel semua kamera: status kesehatan, ketersediaan 24 jam, modul, `is_active`, `is_featured`, `water_kind`, sistem sungai. Edit inline |
| `/admin/kalibrasi/[id]` | **Alat kalibrasi:** tampilkan snapshot terbaru di canvas; klik untuk membuat poligon ROI; gambar garis acuan (normal/waspada/siaga/awas); simpan foto saat ini sebagai referensi siang/malam; isi `calibration_notes`. Opsional: ROI jalan untuk YOLO |
| `/admin/sungai` | Kelola `river_links`: pilih hulu dan hilir di peta, isi jeda default |
| `/admin/label` | **Alat label:** tampilkan snapshot acak dari sampel evaluasi; tombol status (normal/waspada/siaga/awas/tidak dapat dinilai), genangan, sampah; simpan ke `labels` |
| `/admin/evaluasi` | Akurasi AI vs label: akurasi keseluruhan, per siang/malam, per kamera, confusion matrix |
| `/admin/sistem` | Heartbeat worker, panggilan AI hari ini, error terbaru |

Koordinat kalibrasi disimpan ternormalisasi 0..1 (lihat `04-database.md`).

## API route (server)

| Route | Metode | Fungsi |
|---|---|---|
| `/api/admin/login` | POST | Cek `ADMIN_PASSWORD`, set cookie |
| `/api/admin/cameras/[id]` | PATCH | Ubah kolom kamera (Zod) |
| `/api/admin/calibration/[id]` | POST | Simpan ROI, garis, catatan; salin `latest` ke `reference/{id}/day|night.jpg` |
| `/api/admin/river-links` | POST/DELETE | Kelola relasi hulu-hilir |
| `/api/admin/labels` | POST | Simpan label |
| `/api/export/events` | GET | CSV kejadian |
| `/api/assistant` | POST | Asisten AI (OpenAI function calling, lihat `07-ai-prompts.md`), rate limit 20 permintaan/jam per IP (tabel `assistant_usage`, IP di-hash), maks. 500 karakter input |

Data publik dibaca langsung dari Supabase oleh Server Components (anon key) dengan `revalidate` 30–60 detik, ditambah langganan Realtime di client untuk `camera_status`, `alerts`, `insights`, `system_status`.

## Struktur folder

```
web/
├── app/
│   ├── (public)/page.tsx, peta/, air/, lalu-lintas/, ruang-publik/, insight/, riwayat/, kamera/[id]/, replay/, tentang/
│   ├── admin/...
│   ├── api/...
│   ├── layout.tsx
│   └── globals.css            # design tokens (placeholder)
├── components/
│   ├── ui/                    # Button, Card, Badge, Stat, Tabs, Skeleton, EmptyState, ErrorState
│   ├── map/                   # CityMap, CameraMarker, Legend
│   ├── camera/                # CameraPanel, SnapshotView, LivePlayer, StatusTimeline, RiskBreakdown
│   ├── water/                 # RiverDiagram, WaterStatusList
│   ├── traffic/               # DensityChart, AnomalyList
│   ├── insight/               # InsightCard, AlertList
│   └── system/                # SystemBanner, FreshnessTag
├── lib/
│   ├── supabase/{public,server}.ts
│   ├── status.ts              # label, urutan, token warna per status
│   ├── time.ts                # format WIB, "x menit lalu"
│   ├── queries.ts             # semua query baca
│   ├── hooks.ts               # useNow, useLiveCameras, useWorkerHeartbeat (Realtime)
│   ├── storage.ts             # URL publik snapshot
│   └── types.ts               # tipe hasil query (atau generate dari Supabase)
└── ...
```

## Desain

Sejak 11 Okt tampilan dikerjakan langsung di repo ini (tidak lagi menunggu desainer). Gaya visual mengambil acuan dari rancangan "SemarSight Command Center" yang dibuat di Stitch, dengan isi tiap layar dikurangi: satu layar menjawab satu pertanyaan, rincian muncul setelah kecamatan dipilih.

Yang diambil dari acuan: huruf (Plus Jakarta Sans untuk judul dan angka, Inter untuk teks), biru `#2563eb` sebagai warna utama, kartu putih bergaris tipis dengan sudut 12 px, lencana status berbentuk pil, panel berwarna lembut dengan garis kiri sesuai status, label kecil huruf besar, dan arsiran diagonal untuk wilayah tidak terpantau (arsiran itu dilepas 12 Okt; lihat butir 3 di bawah).

Yang sengaja **tidak** diambil, karena datanya tidak kita punya: tinggi air dalam cm, kecepatan dalam km/jam, jumlah dan debit pompa, kualitas udara, identitas petugas, dan tanda "diverifikasi petugas". Semua angka di layar harus berasal dari data yang benar-benar dikumpulkan sistem.

1. **Semua warna, radius, bayangan, dan font lewat CSS variables** di `globals.css`, dipetakan ke Tailwind lewat `@theme inline`. Komponen tidak memakai kode warna langsung.
   - Tiap status punya tiga warna: warna utama (titik, garis, peta), latar lembut (`--status-*-bg`), dan teks di atas latar itu (`--status-*-text`).
   - Kelas `tint tone-*` memberi latar dan teks sesuai status; `accent-left` menambah garis kiri; `label-caps` untuk label kecil huruf besar.
   - Font dimuat lewat `next/font` (di-host sendiri, tanpa permintaan ke Google saat halaman dibuka).
2. **Komponen UI primitif** di `components/ui/` (Card, Badge, Button, Stat, Icon, EmptyState, ErrorState, Skeleton), tanpa library desain. Ikon berupa SVG garis sederhana dan hanya hiasan; makna selalu ada di teks.
3. **Status tidak boleh hanya dibedakan warna:** selalu ada label teks. Wilayah tidak terpantau digambar **hanya garis batasnya, tanpa isi** (sejak 12 Okt malam, keputusan pemilik proyek: arsiran membuat peta terasa penuh dan kusam); namanya tetap tertulis, dan legenda serta tooltip menyebut "Tidak terpantau". Yang tidak boleh berubah: wilayah itu tidak pernah diberi warna hijau.
4. **Hanya tema terang.** Peta dasar OpenStreetMap berwarna terang dan diredam (abu-abu, transparan) agar warna wilayah menonjol; tema gelap otomatis dihapus karena bertabrakan dengan peta.
5. **Mobile-first:** semua halaman bisa dipakai di layar 360 px; peta dan panel berganti menjadi tampilan bertumpuk.
6. **Setiap komponen data wajib punya empat keadaan:** memuat (skeleton), kosong (penjelasan + kenapa), error (pesan + coba lagi), dan data usang/offline (penanda kesegaran).

## Kriteria penerimaan web untuk penyisihan

- Halaman `/`, `/peta`, `/air`, `/lalu-lintas`, `/kamera/[id]`, `/riwayat` berfungsi dengan data nyata.

## Sampah perairan ditonjolkan (13 Okt)

Penilaian sampah berasal dari panggilan AI yang sama dengan status air, jadi tidak menambah biaya. Supaya terlihat: (1) tema peta keempat di Beranda, "Sampah perairan" (kecamatan berwarna tingkat sampah tertinggi di lokasinya; lokasi bersampah banyak diberi pin besar berlabel); (2) baris di panel kiri Beranda yang menyebut jumlah dan nama lokasi bersampah banyak, dan membuka tema itu saat diklik; (3) blok "Sampah di perairan" di halaman Air; (4) keterangan di rincian lokasi dan di panel kecamatan. Semua memakai status sampah resmi (dihaluskan), dan selalu disebut sebagai tingkat hasil penilaian AI, bukan ukuran berat atau volume.

## Halaman Ruang Publik (13 Okt)

`/ruang-publik`, dengan menu sendiri karena isinya tidak ada di Beranda. Satu kartu per tempat (`lib/public-places.ts`: Kota Lama, Goa Kreo, dan Balai Kota, ditentukan dari titik pusat dan radius), menjawab "seberapa ramai sekarang dibanding biasanya": pejalan kaki terlihat sekarang (jumlah dari semua sudut kamera yang hidup), rata-rata pada jam yang sama dari profil aktivitas worker, tingkat sepi / biasa / ramai / sangat ramai (di bawah 10 orang tidak disebut ramai), pola 24 jam, dan gambar kamera sebagai bukti. Di atasnya ada peta kecil dengan satu pin per tempat (besar lingkaran = pejalan kaki terlihat sekarang; `components/crowd/PlacesMap.tsx`), dan tiap tempat dipecah menjadi titik-titiknya (Kota Lama: Jalan Sri Gunting, Taman Srigunting, Gereja Blenduk; Balai Kota: pintu masuk, halaman, pintu keluar), masing-masing dengan gambar dan tingkatnya sendiri. Tempat baru hanya ditambahkan setelah kameranya diperiksa menghadap ruang pejalan kaki. Komponen: `components/crowd/PublicSpacesView.tsx`.

## Halaman Lalu Lintas (12 Okt)

Dibuat dari video referensi pemilik proyek (dasbor lalu lintas dengan ruas berwarna, heksagon, dan angka emisi). Yang diambil adalah gagasannya; tata letaknya tetap mengikuti arah kita: peta penuh, panel mengambang, satu lapisan menjawab satu pertanyaan, dan tidak ada angka yang tidak dikumpulkan sistem.

| Lapisan | Pertanyaan | Isi | Batas yang ditulis di layar |
|---|---|---|---|
| Ruas jalan | Seberapa padat tiap ruas sekarang? | Satu ruas per kamera lalu lintas (`lib/geo/road-segments.json`, dipotong dari OpenStreetMap), berwarna tingkat kepadatan. Kiri: ringkasan dan batang sebaran. Kanan: ruas terpadat; memilih ruas mendekatkan peta dan menampilkan angka di balik tingkatnya, gambar kamera, grafik 24 jam, dan jenis kendaraan | Garis tebal = ±200 m yang terlihat kamera; garis tipis = jalan yang sama sampai ±1 km, perkiraan dari kamera itu (keduanya berhenti di tengah jarak ke kamera lain di jalan yang sama); jalan utama lain (`lib/geo/road-network.json`) = perkiraan dari kamera terdekat, lebih pudar bila kameranya lebih dari 1,5 km. Warna berarti dibanding kebiasaan, bukan kecepatan |
| Aktivitas per jam | Kawasan mana yang biasanya ramai pada jam tertentu? | Heksagon 400 m berisi rata-rata kendaraan (atau orang) terlihat per gambar pada jam yang dipilih, dari profil yang ditulis worker ke `system_status` (`activity_profile`). Penggeser jam, tombol putar, grafik 24 batang, rincian per heksagon | Kisi heksagon memenuhi kota; yang tanpa kamera abu-abu rata, tidak diisi perkiraan. Jam yang datanya belum cukup digambar bergaris putus, bukan sepi. Hitungan orang ikut memuat pengendara motor |
| Beban emisi | Ruas mana yang estimasi beban emisinya paling berat? | Kendaraan terlihat 30 menit terakhir ditimbang faktor emisi Permen LH 12/2010 (CO₂, NOx, CO); ruas diperingkat terhadap ruas lain, dalam "setara sepeda motor", dengan porsi tiap jenis kendaraan | Estimasi relatif. Bukan pengukuran udara dan bukan kg per jam, karena sistem tahu kendaraan yang terlihat, bukan yang lewat. Porsi per jenis belum diuji dengan hitungan manual |

Semua peta (Beranda, Simulasi, Lalu Lintas, Kamera) memakai peta dasar yang sama (`lib/map-tiles.ts`) dan punya tombol **Peta gelap** (`components/map/MapThemeToggle.tsx`, `lib/map-theme.ts`): peta dasar digelapkan lewat CSS supaya warna ruas dan batas wilayah lebih menonjol; pilihannya diingat di browser.

Percobaan peta 3D: `/lalu-lintas/3d` (`components/traffic/Map3D.tsx`, `Traffic3DView.tsx`) menampilkan lapisan Ruas jalan di atas peta vektor OpenFreeMap dengan MapLibre GL, sudut pandang miring, dan bangunan timbul. Dibuka lewat tautan "3D" di bilah atas halaman Lalu lintas.

Komponen: `components/traffic/TrafficView.tsx` (lapisan dan keadaan), `TrafficMap.tsx` (peta), `RoadPanels.tsx`, `ActivityPanels.tsx`, `EmissionPanels.tsx`, `SegmentPanel.tsx`. Logika murni: `lib/traffic.ts`, `lib/activity.ts`, `lib/emission.ts`, `lib/geo/roads.ts`.
- Status kamera berubah di browser tanpa refresh saat worker memperbarui `camera_status`.
- Mematikan worker → banner muncul dalam 15 menit; halaman tetap menampilkan data terakhir.
- Kamera mati tampil sebagai "Offline sejak HH:MM" dengan snapshot terakhir.
- `npm run build` sukses tanpa error; deploy Vercel berjalan; tidak ada secret di bundle client (cek `NEXT_PUBLIC_` hanya untuk URL dan anon key).

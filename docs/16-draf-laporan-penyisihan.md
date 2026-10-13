# 16 — Draf Laporan Penyisihan

Draf isi laporan, mengikuti urutan bab pada template resmi panitia (`TEMPLATE SOFTWARE DEVELOPMENT.docx`, diunduh 13 Okt 2026; salinannya di `C:\semarsight\laporan-penyisihan\`). Isi di bawah ini dipindahkan ke template itu.

Cara memakai draf ini:
- Bagian bertanda `[ISI: …]` hanya bisa diisi tim (nama, NIM, tautan, tangkapan layar).
- Angka sistem diambil 13 Okt 2026 pukul 16.40 WIB. **Perbarui pada hari pengumpulan** (jalankan `worker/scripts/status.py`); bagian yang perlu diperbarui bertanda `[PERBARUI]`.
- Angka dari luar sistem (banjir, penurunan tanah) sudah diberi sumber; **baca ulang sumbernya sebelum dikirim**.
- Tangkapan layar halaman Lalu lintas diambil Kamis 15 atau Jumat 16, bukan Rabu 14 (lihat `10-tasklist.md`, masa peralihan model).

---

## Halaman judul

**SemarSight: CCTV Publik Kota Semarang sebagai Sensor Kota untuk Peringatan Dini Air, Kepadatan Lalu Lintas, dan Insight Lintas Modul**

Disusun oleh: `[ISI: nama tim]`
Anggota: `[ISI: ketua tim (NIM)]`, `[ISI: anggota 1 (NIM)]`, `[ISI: anggota 2 (NIM)]`

Software Development Competition, ICONFEST 2026

## Kata Pengantar

`[ISI: ditulis tim. Usulan isi: syukur, tujuan laporan (memenuhi babak penyisihan ICONFEST 2026 cabang Software Development bertema Smart City), ucapan terima kasih kepada pihak yang membantu, dan harapan menerima masukan. Sebut Pemerintah Kota Semarang sebagai penyedia tayangan CCTV publik PANTAUSEMAR.]`

## Abstrak

Kota Semarang memiliki ratusan CCTV publik yang ditayangkan lewat layanan PANTAUSEMAR, tetapi pemanfaatannya masih sebatas ditonton. Pada saat yang sama, kota ini menghadapi banjir, rob, dan genangan yang berulang, diperberat oleh penurunan muka tanah di wilayah utara. SemarSight adalah platform web yang memperlakukan CCTV publik itu sebagai sensor kota. Sebuah proses latar mengambil satu gambar dari 146 kamera setiap lima menit, menghitung kendaraan dan orang dengan model deteksi yang berjalan lokal, dan menilai kondisi air pada 20 lokasi terkalibrasi dengan AI vision yang hanya dipanggil saat gambar berubah atau pada pemeriksaan berkala. Keputusan resmi tidak diambil langsung dari jawaban AI: status air baru naik setelah dua penilaian berturut-turut sepakat, lalu digabung dengan tren, kondisi hulu, dan prakiraan hujan menjadi skor risiko yang bobotnya terbuka. Hasilnya ditampilkan sebagai kondisi per kecamatan, peringatan, ruas jalan berwarna kepadatan, dan ringkasan berbahasa awam yang setiap angkanya diperiksa terhadap data. Dalam `[PERBARUI]` tiga hari berjalan, sistem mencatat lebih dari 92 ribu pemeriksaan kamera, 43 ribu hitungan lalu lintas, dan 1.860 penilaian air; dalam 24 jam terakhir semua siklus selesai tanpa jeda. Laporan ini juga memuat hasil evaluasi awal secara terus terang, termasuk satu peringatan palsu dan perbaikannya, serta batas sistem: status air adalah penilaian visual, bukan pengukuran tinggi air.

Kata kunci: smart city, CCTV publik, peringatan dini banjir, AI vision, kepadatan lalu lintas.

---

# BAB I — PENDAHULUAN

## 1.1 Latar Belakang

Semarang adalah kota pesisir dengan persoalan air yang berlapis: hujan lokal, kiriman dari hulu, rob, dan sistem polder serta pompa yang harus bekerja terus. Badan Geologi Kementerian ESDM melaporkan laju penurunan tanah di Semarang bagian utara sekitar 7 sampai 9 cm per tahun [1], yang membuat kawasan itu makin sulit dikeringkan. Dampaknya nyata: pada banjir pertengahan Maret 2024, BPBD Kota Semarang mencatat lebih dari 158 ribu jiwa terdampak [2], tersebar di beberapa kecamatan seperti Pedurungan, Genuk, Gayamsari, Semarang Barat, Ngaliyan, dan Tugu [3].

Di sisi lain, Pemerintah Kota Semarang sudah memasang dan menayangkan ratusan CCTV publik melalui layanan PANTAUSEMAR [4]: di sungai, rumah pompa, titik rawan genangan, simpang jalan, dan kawasan wisata. Kamera-kamera itu adalah infrastruktur pengamatan yang sudah ada dan sudah dibiayai. Namun tayangan hanya berguna bila ada yang menontonnya, dan tidak ada petugas yang sanggup mengamati ratusan layar sepanjang hari, membandingkannya dengan keadaan biasa, lalu mengingat apa yang terjadi kemarin.

SemarSight berangkat dari celah itu: bukan menambah sensor baru, melainkan membuat yang sudah ada bisa "dibaca" secara terus-menerus.

## 1.2 Rumusan Masalah

1. Bagaimana memanfaatkan CCTV publik yang sudah ada untuk memantau kondisi air dan lalu lintas kota secara terus-menerus tanpa bergantung pada petugas yang menonton?
2. Bagaimana menjadikan penilaian AI atas gambar cukup dapat dipercaya untuk dasar peringatan, mengingat AI bisa salah baca?
3. Bagaimana menghubungkan kondisi air, hujan, dan lalu lintas sehingga menghasilkan informasi yang bisa ditindaklanjuti, bukan sekadar tayangan?
4. Bagaimana menyajikannya agar dipahami orang awam dan jujur terhadap batas datanya?

## 1.3 Tujuan Project

1. Membangun proses yang merekam dan menganalisis semua kamera publik aktif setiap lima menit.
2. Menghasilkan status air per lokasi yang ditetapkan oleh aturan terbuka, dengan AI sebagai pengamat, bukan pengambil keputusan.
3. Menghasilkan indeks kepadatan lalu lintas relatif terhadap kebiasaan tiap ruas.
4. Menggabungkan status air, tren, kondisi hulu, dan prakiraan hujan menjadi peringatan dan ringkasan yang bisa ditindaklanjuti.
5. Menyediakan website publik yang menampilkan kondisi per wilayah dengan kamera sebagai bukti.

## 1.4 Manfaat Project

| Pihak | Manfaat |
|---|---|
| BPBD | Melihat lokasi air yang naik dan peringatan untuk lokasi hilir sebelum airnya sampai |
| Dinas PU dan operator pompa | Kondisi tiap rumah pompa dan temuan sampah di perairan tanpa menonton tiap kamera |
| Dishub | Ruas yang lebih padat dari biasanya, dan keadaan lalu lintas di sekitar lokasi yang tergenang |
| Perencana kota | Riwayat kejadian: lokasi, puncak, dan lama sampai kembali normal |
| Warga | Kondisi sekitar dalam bahasa awam, dengan gambar kamera sebagai bukti |
| Pemerintah kota | Nilai tambah dari infrastruktur CCTV yang sudah ada, tanpa perangkat baru |

---

# BAB II — DESKRIPSI PROJECT

## 2.1 Deskripsi Project

SemarSight adalah platform web yang mengubah CCTV publik Kota Semarang menjadi sensor kota. Sistem terdiri atas dua bagian. Bagian pertama adalah proses latar (worker) yang setiap lima menit mengambil satu gambar dari tiap kamera, memeriksa apakah kamera hidup, menghitung kendaraan dan orang, menilai kondisi air, lalu menyimpan hasilnya. Bagian kedua adalah website yang menampilkan hasil itu sebagai kondisi per kecamatan, peringatan, dan ringkasan.

Arah tampilannya adalah "insight dulu, kamera sebagai bukti": yang ditonjolkan adalah kondisi wilayah, sedangkan gambar kamera muncul saat pengguna ingin memeriksa dasar sebuah status.

## 2.2 Permasalahan dan Urgensi Project

- **Skala pengamatan.** Sistem saat ini memantau 146 kamera aktif. Mengamati sebanyak itu secara manual sepanjang hari tidak realistis.
- **Respons yang reaktif.** Tanpa pembanding dan tanpa hubungan antar-lokasi, kawasan baru disiagakan setelah air terlihat naik di tempat itu sendiri.
- **Data yang terpisah.** Kondisi air, hujan, dan lalu lintas saling memengaruhi tetapi dipantau terpisah.
- **Dampak sosial.** Banjir Maret 2024 berdampak pada lebih dari 158 ribu jiwa [2]. Informasi dini beberapa puluh menit lebih awal berarti waktu untuk menyiapkan pompa, mengalihkan arus, atau memindahkan kendaraan.

## 2.3 Solusi yang Ditawarkan

| Modul | Sumber | Cara kerja | Yang dihasilkan |
|---|---|---|---|
| Air dan genangan (unggulan) | 20 lokasi terkalibrasi: rumah pompa, kolam, dan jalan rawan genangan | AI vision membandingkan gambar saat ini dengan foto keadaan normal dan garis acuan yang digambar manusia | Status resmi normal / waspada / siaga / awas, tren, skor risiko |
| Lalu lintas | 66 kamera | Model deteksi lokal menghitung kendaraan; dibandingkan dengan kebiasaan kamera itu pada jam yang sama | Indeks kepadatan relatif, ruas jalan berwarna |
| Hujan | Open-Meteo, 9 titik | Prakiraan 3 jam ke depan | Masukan skor risiko dan peringatan hujan lebat |
| Hulu → hilir | 4 pasangan rumah pompa | Status sisi hulu masuk ke skor risiko sisi hilir | Peringatan dini untuk lokasi hilir |
| Lintas modul | Air + lalu lintas | Keadaan titik lalu lintas dalam radius 1 km dari lokasi air yang naik | Catatan dampak yang terjadi bersamaan |
| Ringkasan AI | Semua angka di atas | Model bahasa menulis kondisi, penyebab, dampak, dan tindakan | Insight berbahasa awam per audiens |
| Kesehatan kamera | Semua kamera | Cek tayangan tiap siklus | Kamera mati atau beku ditandai, tidak diam-diam diabaikan |

## 2.4 Keunggulan dan Nilai Inovasi

1. **AI untuk mengamati dan menjelaskan, aturan untuk memutuskan.** Status resmi tidak pernah diambil dari satu jawaban AI. Naik butuh dua penilaian sepakat dari dua gambar berbeda; turun butuh tiga. Satu penilaian naik hanya tampil sebagai "indikasi awal".
2. **Kalibrasi oleh manusia.** Tiap lokasi air punya area pengamatan, empat garis acuan, dan foto keadaan normal siang dan malam. AI tidak menebak dari nol; ia membandingkan.
3. **Hemat dan tepat guna.** Penghitungan kendaraan berjalan lokal tanpa biaya per gambar. AI vision dipanggil hanya saat gambar berubah berarti atau pada pemeriksaan berkala: rata-rata ±32 panggilan per lokasi per hari, dibanding 288 bila dipanggil tiap siklus (hemat ±89%).
4. **Ringkasan AI yang diperiksa.** Setiap angka dalam ringkasan dicocokkan dengan data; satuan yang tidak dikumpulkan sistem (cm, km/jam, liter) ditolak; tingkat kegentingan ditetapkan aturan, bukan oleh model bahasa.
5. **Jujur terhadap batas.** Wilayah tanpa kamera ditandai "tidak terpantau", tidak diwarnai hijau. Pembanding yang datanya belum cukup diberi label "sementara". Estimasi emisi ditampilkan sebagai perbandingan antar-ruas, tidak sebagai kg per jam.
6. **Insight lintas modul.** Kondisi air dihubungkan dengan hujan, kondisi hulu, dan lalu lintas di sekitarnya.

**Pembeda dari dasbor CCTV pada umumnya.** Dasbor pemantauan kota biasanya menampilkan tayangan kamera atau angka hitungan mentah. SemarSight berbeda dalam empat hal: fokus utamanya air dan peringatan dini hulu–hilir; keputusan memakai aturan terbuka di atas penilaian AI yang dikalibrasi manusia; lalu lintas dinyatakan sebagai indeks relatif terhadap kebiasaan tiap ruas, bukan volume; dan emisi hanya ditampilkan sebagai estimasi relatif karena datanya belum mendukung angka mutlak.

---

# BAB III — PERANCANGAN DAN IMPLEMENTASI PROJECT

## 3.1 Konsep dan Alur Project

Alur satu siklus (setiap 5 menit):

1. **Akuisisi.** Satu gambar diambil dari tayangan tiap kamera. Kamera yang tidak menjawab dicatat mati; gambar yang sama persis berulang-ulang dicatat beku.
2. **Kualitas.** Gambar gelap, buram, atau malam ditandai, supaya penilaiannya diperlakukan lebih hati-hati.
3. **Hitung lokal.** Model deteksi menghitung mobil, sepeda motor, bus, truk, dan orang. Tidak ada pengenalan wajah atau pelat nomor.
4. **Penilaian air.** Untuk lokasi terkalibrasi, bila gambar berubah berarti atau sudah waktunya pemeriksaan berkala, AI vision menilai posisi air terhadap garis acuan dan foto normal. Jawaban yang menyatakan naik ditanyakan ulang pada gambar yang sama; bila dua jawabannya berbeda, penilaian itu tidak dihitung.
5. **Aturan.** Penghalusan menetapkan status resmi; tren dihitung dari riwayat; skor risiko = status air 40% + tren 20% + kondisi hulu 20% + prakiraan hujan 20%.
6. **Peringatan dan kejadian.** Peringatan dibuat dari templat saat status naik, hulu waspada, hujan lebat diprakirakan, atau lokasi unggulan tidak terpantau. Tiap periode status di atas normal dicatat sebagai kejadian: mulai, puncak, lama.
7. **Ringkasan.** Fakta dirangkum, tingkat keseluruhan ditetapkan aturan, lalu model bahasa menulis ringkasan yang kemudian diperiksa.
8. **Tampil.** Website membaca hasilnya dan memperbarui diri saat data berubah.

`[ISI: sisipkan diagram arsitektur; sumbernya ada di README.md dan docs/02-architecture.md]`

## 3.2 Target Pengguna dan Potensi Pasar

Pengguna utama adalah pemerintah kota: BPBD, Dinas PU dan operator rumah pompa, Dishub, dan perencana. Pengguna kedua adalah warga. Karena memakai infrastruktur yang sudah ada, pendekatan ini bisa diterapkan di kota lain yang menayangkan CCTV publik; sumber kamera dipisahkan dari bagian analisis sehingga penggantian kota tidak mengubah inti sistem. `[ISI: bila ingin, sebut kota lain yang sudah dicoba tim dan hasilnya]`

## 3.3 Perancangan Project

- **Tiga komponen.** Worker (Python) menulis ke basis data dengan kunci penuh; website (Next.js) membaca dengan kunci baca-saja; basis data, penyimpanan gambar, dan pembaruan langsung disediakan Supabase.
- **Satu pipeline, banyak penganalisis.** Akuisisi dan cek kesehatan dipakai bersama; tiap modul menambah penganalisisnya sendiri.
- **Membandingkan kamera dengan dirinya sendiri.** Sudut dan mutu tiap kamera berbeda, jadi yang dipakai adalah perbandingan terhadap kebiasaan kamera itu pada jam yang sama, dengan hari kerja dan akhir pekan dipisah.
- **Tahan gangguan.** Kamera mati, worker berhenti, AI gagal, dan data kosong masing-masing punya keadaan yang ditulis jelas di layar ("Data tertunda", "Belum ada pembanding", "Tidak terpantau").
- **Rancangan tampilan.** Peta memenuhi layar dengan panel mengambang; satu layar menjawab satu pertanyaan; rincian muncul saat diklik. Tersedia mode peta gelap.
- **Privasi.** Kamera lingkungan RT/RW tidak dipakai. Yang disimpan jangka panjang hanya angka agregat; gambar disimpan terbatas.

## 3.4 Teknologi yang Digunakan

| Bagian | Teknologi | Alasan pemilihan |
|---|---|---|
| Website | Next.js (App Router), TypeScript, Tailwind CSS | Halaman cepat dimuat, mudah di-deploy, tipe data terjaga |
| Peta dan grafik | MapLibre GL dengan peta vektor OpenFreeMap (peta 3D), Leaflet sebagai cadangan, data OpenStreetMap, Recharts | Gratis, tanpa kunci API, data jalan dan bangunan terbuka |
| Basis data, gambar, pembaruan langsung | Supabase (PostgreSQL, Storage, Realtime) | Satu layanan untuk tiga kebutuhan; hak baca publik dipisah dari hak tulis |
| Worker | Python, ffmpeg, OpenCV | Pengambilan gambar dari tayangan dan pengolahan gambar |
| Hitung kendaraan dan orang | Ultralytics YOLO11 (yolo11s), berjalan lokal | Tanpa biaya per gambar; cukup cepat untuk 146 kamera per siklus |
| Penilaian air dan ringkasan | OpenAI API (model vision dan teks, keluaran terstruktur) | Membaca posisi air terhadap acuan; keluaran berbentuk tetap sehingga bisa divalidasi |
| Cuaca | Open-Meteo | Gratis, tanpa kunci |
| Validasi | Pydantic (worker), Zod (web) | Jawaban AI yang bentuknya salah ditolak, tidak menjatuhkan sistem |

## 3.5 Prototype dan Implementasi

- Tautan prototype: `[ISI: tautan deploy]`
- Repositori: `[ISI: tautan GitHub]`
- Worker berjalan terus di satu komputer tim sejak 10 Oktober 2026. `[PERBARUI]`

`[ISI: tangkapan layar Beranda, rincian kecamatan, halaman Air, halaman Lalu lintas (tiga lapisan), halaman Simulasi, halaman kalibrasi]`

---

# BAB IV — HASIL DAN PEMBAHASAN

## 4.1 Hasil Project

Keadaan sistem per 13 Oktober 2026 pukul 16.40 WIB `[PERBARUI]`:

| Ukuran | Nilai |
|---|---|
| Kamera aktif yang direkam tiap 5 menit | 146 (130 hidup, 16 mati saat diperiksa) |
| Lokasi air terkalibrasi / dinilai AI | 22 / 20 |
| Kamera lalu lintas | 66 |
| Pemeriksaan kesehatan kamera tercatat | 92.778 |
| Hitungan lalu lintas tercatat | 43.669 |
| Penilaian air oleh AI | 1.860 |
| Ringkasan AI yang ditulis | 68 |
| Siklus 24 jam terakhir | 291 selesai, tanpa jeda |
| Unit test worker | 203, semuanya lulus |

## 4.2 Fitur dan Fungsionalitas

| Fitur | Keadaan |
|---|---|
| Perekaman dan cek kesehatan semua kamera | Berjalan |
| Status air resmi, tren, skor risiko | Berjalan di 20 lokasi |
| Peringatan (status naik, hulu waspada, hujan lebat, lokasi tidak terpantau) | Berjalan |
| Hubungan hulu → hilir | Berjalan untuk 4 rumah pompa; jeda waktunya masih perkiraan awal |
| Pencatatan kejadian dan unduhan CSV | Berjalan |
| Indeks kepadatan lalu lintas | Berjalan; pembanding masih berlabel sementara `[PERBARUI]` |
| Insight lintas modul (air → lalu lintas) | Berjalan; belum teruji kejadian nyata |
| Ringkasan AI | Berjalan |
| Beranda per kecamatan, halaman Air, halaman Lalu lintas (ruas jalan, aktivitas per jam, beban emisi relatif), Riwayat, Simulasi, Tentang | Berjalan |
| Halaman kalibrasi (admin) | Berjalan |
| Penanganan kamera mati, data tertunda, data kosong | Berjalan di halaman utama |
| Deploy publik | `[PERBARUI]` |
| Tingkat sampah di perairan (tiga tingkat, status dihaluskan) dan peringatan "sampah menumpuk + hujan diprakirakan" untuk Dinas PU | Berjalan; peringatannya belum pernah menyala dengan data langsung karena belum ada prakiraan hujan lebat |
| Keramaian ruang publik: pejalan kaki terlihat di Kota Lama, Balai Kota, dan Goa Kreo dibanding biasanya | Berjalan; tingkat keramaian masih menunggu pembanding `[PERBARUI]` |
| Asisten tanya-jawab, evaluasi berlabel manusia | Rencana menuju final |

Selama sistem berjalan belum ada kejadian air naik yang nyata. Karena itu alur kejadian diperlihatkan lewat halaman Simulasi: masukannya buatan dan diberi label jelas, tetapi status, peringatan, dan ringkasannya dihasilkan aturan dan model yang sama dengan sistem.

## 4.3 Pengujian

**Unit test.** 203 pengujian otomatis untuk aturan penghalusan, skor risiko, peringatan, pencatatan kejadian, pemeriksaan ringkasan AI, pembanding lalu lintas, dan geometri ruas jalan.

**Salah baca AI dan perbaikannya.** Ke-22 penilaian air yang bukan normal sampai 12 Oktober ditinjau, dari gambar buktinya atau dengan menilai ulang gambar yang tersimpan, dan tidak ada yang menunjukkan kenaikan air nyata. Penyebabnya antara lain busa pompa, sinar matahari dari belakang, dan foto referensi yang tidak mewakili keadaan normal. Pada 13 Oktober sistem mengeluarkan satu peringatan palsu: dua penilaian berturut-turut menyatakan waspada di satu rumah pompa saat air terkena sinar siang. Penelusurannya menemukan akar masalah yang lebih mendasar: petunjuk untuk AI menyebut "melewati garis normal berarti waspada", padahal garis normal digambar tepat pada muka air. Setelah petunjuk diselaraskan (waspada berarti mencapai garis waspada), 104 gambar bukti dari 20 lokasi dinilai ulang: penilaian naik yang dihitung aturan turun dari 14 menjadi 0 sampai 2 pada dua putaran. Kejadian palsu itu dihapus dari riwayat publik dan dicatat dalam dokumentasi.

**Hitungan kendaraan.** Sepuluh gambar siang hari dari sepuluh kamera diperiksa dengan membandingkan kotak deteksi terhadap hitungan mata `[ISI: bila sempat, ulangi hitungan pembanding oleh anggota tim; pembanding saat ini dikerjakan dengan bantuan asisten AI]`:

| Jenis | Dicatat sistem | Hitungan pembanding |
|---|---|---|
| Mobil | 115 | ±119 |
| Sepeda motor | 27 | ±78 |
| Bus | 5 | 2 |
| Truk | 29 | ±15 |
| Semua kendaraan | 176 | ±214 |

Sistem menghitung sekitar 82% kendaraan, tetapi hanya sekitar sepertiga sepeda motor. Karena tiap kamera dibandingkan dengan dirinya sendiri, kekurangan yang ajek ini tidak merusak indeks kepadatan relatif; namun porsi jenis kendaraan tidak layak dikutip. Menindaklanjuti temuan itu, model deteksi diganti ke ukuran yang lebih besar pada hari yang sama; siklus pertamanya mencatat sekitar 1,4 kali lebih banyak kendaraan dan 1,5 kali lebih banyak sepeda motor. Model baru belum dievaluasi dengan hitungan pembanding. `[PERBARUI]`

**Penilaian sampah.** Satu gambar siang terbaru dari tiap lokasi air (16 lokasi) dinilai AI lalu dibandingkan dengan penilaian mata `[ISI: bila sempat, ulangi oleh anggota tim; pembanding saat ini dikerjakan dengan bantuan asisten AI]`: 13 dari 16 sepakat, 3 berbeda satu tingkat antara "tidak terlihat" dan "sedikit", dan tidak ada "banyak" yang keliru. Busa pompa dan tanaman air tidak terbaca sebagai sampah. Karena penilaian per gambar tidak ajek, status "banyak" baru berlaku bila empat dari enam penilaian terakhir sepakat. Yang dinilai adalah tingkat, bukan berat atau volume sampah.

**Hitungan pejalan kaki.** Orang yang terdeteksi sedang menaiki sepeda motor tidak dihitung. Seluruh 141 kamera yang punya arsip diperiksa untuk mencari kawasan pejalan kaki: di kamera jalan, "orang" yang terhitung hampir semuanya pengendara yang motornya tidak terdeteksi, jadi hitungan orang hanya ditampilkan untuk tempat yang kameranya menghadap ruang pejalan kaki.

**Keandalan.** `[PERBARUI: jumlah siklus selesai dan jeda sejak 12 Okt dari status.py]`

**Yang belum diuji.** Penilaian air pada kejadian naik yang nyata; peringatan sampah dengan hujan sungguhan; akurasi malam hari terhadap penilaian manusia; hitungan kendaraan malam hari; tampilan di layar ponsel.

---

# BAB V — PENUTUP

## 5.1 Kesimpulan

CCTV publik yang sudah ada dapat dijadikan sumber data kota yang berjalan terus dengan biaya rendah, asalkan AI ditempatkan sebagai pengamat dan keputusan diserahkan kepada aturan yang terbuka. Dalam tiga hari pertama sistem merekam 146 kamera dan menghasilkan status air, indeks kepadatan, peringatan, dan ringkasan; sejak dipindah ke komputer yang menetap pada 12 Oktober tidak ada siklus yang terlewat `[PERBARUI]`. Pengalaman dengan salah baca AI menunjukkan bahwa kualitas kalibrasi dan kecocokan petunjuk dengan cara kalibrasi lebih menentukan daripada model yang dipakai.

## 5.2 Keterbatasan

- Status air adalah penilaian visual, bukan pengukuran tinggi air; sistem ini pelengkap, bukan pengganti alat ukur resmi.
- Hitungan kendaraan lebih rendah dari keadaan sebenarnya, terutama sepeda motor; yang dipakai adalah indeks relatif.
- Wilayah tanpa kamera tidak diketahui kondisinya.
- Sistem bergantung pada ketersediaan tayangan PANTAUSEMAR.
- Belum ada kejadian nyata untuk menguji kepekaan sistem terhadap air yang benar-benar naik.

## 5.3 Rencana Menuju Final

1. Evaluasi berlabel manusia untuk penilaian air (siang dan malam) dan hitungan kendaraan.
2. Pembanding lalu lintas yang matang dengan model deteksi baru, dan anomali kepadatan.
3. Menambah pasangan hulu → hilir dan mempelajari jeda waktunya dari kejadian yang tercatat.
4. Estimasi emisi dalam satuan mutlak hanya bila uji hitungan arus dari klip video lulus.
5. Asisten tanya-jawab atas data sistem.

## Daftar Pustaka

`[ISI: sesuaikan gaya penulisan dengan ketentuan panitia; baca ulang tiap sumber sebelum dikirim]`

1. Kementerian ESDM, Badan Geologi. "Penurunan Laju Tanah di Semarang Utara hingga 9 cm per tahun: Badan Geologi Lakukan Upaya Pencegahan." https://www.esdm.go.id/id/media-center/arsip-berita/penurunan-laju-tanah-di-semarang-utara-hingga-9-cm-per-tahun-badan-geologi-lakukan-upaya-pencegahan
2. Rakyat Merdeka (15 Maret 2024). "BPBD: 158 Ribu Jiwa Terdampak Banjir Semarang, Ratusan Warga Mengungsi." https://rm.id/baca-berita/nasional/213755/bpbd-158-ribu-jiwa-terdampak-banjir-semarang-ratusan-warga-mengungsi
3. Kompas TV (Maret 2024). "7 Kecamatan di Semarang Terdampak Banjir dan Tanah Amblas." https://www.kompas.tv/regional/492737/7-kecamatan-di-semarang-terdampak-banjir-dan-tanah-amblas
4. Pemerintah Kota Semarang. PANTAUSEMAR. https://pantausemar.semarangkota.go.id/
5. Open-Meteo. Weather Forecast API. https://open-meteo.com/
6. Kontributor OpenStreetMap. https://www.openstreetmap.org/copyright
7. Ultralytics. YOLO11. https://docs.ultralytics.com/
8. Peraturan Menteri Negara Lingkungan Hidup No. 12 Tahun 2010 tentang Pelaksanaan Pengendalian Pencemaran Udara di Daerah (faktor emisi kendaraan).

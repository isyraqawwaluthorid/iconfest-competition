# 13 — Catatan Keputusan dan Pelajaran

Ringkasan keputusan yang diambil selama pengembangan, beserta alasannya dan bukti yang mendasarinya. Dokumen ini ada supaya siapa pun yang melanjutkan pekerjaan (di mesin lain, atau anggota tim lain) tidak perlu mengulang diskusi yang sama. Rincian teknis tetap di dokumen masing-masing; di sini hanya "apa yang diputuskan dan kenapa".

Terakhir diperbarui: 12 Oktober 2026.

## 1. Arah produk

| Keputusan | Alasan |
|---|---|
| **Insight dulu, kamera sebagai bukti.** Yang ditonjolkan ke pengguna adalah kondisi wilayah, bukan tayangan CCTV. | Pengguna datang untuk tahu wilayah mana yang bermasalah dan harus berbuat apa, bukan untuk menonton kamera. Kamera masuk kelompok menu "Sumber data". |
| **Satuan wilayah adalah kecamatan (16).** | Cukup besar untuk dirangkum, cukup kecil untuk ditindaklanjuti, dan batasnya tersedia terbuka (OpenStreetMap). |
| **Beranda berupa peta penuh dengan panel mengambang.** | Permintaan pemilik proyek: lebih interaktif, visualisasi data muncul sebagai panel. Kiri: kondisi kota. Kanan: peringatan dan peringkat, atau rincian kecamatan. |
| **Kecamatan tanpa sumber data ditandai "tidak terpantau"** (hanya garis batas tanpa isi; sampai 12 Okt berarsir), tidak pernah hijau. | Sebaran kamera sangat tidak merata. Lokasi air baru terpantau di 9 dari 16 kecamatan. Menganggap "tidak ada data" sebagai "aman" akan menyesatkan. |
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
- **Pembanding kepadatan = titik itu sendiri pada jam yang sama (±1 jam) di hari-hari sebelumnya**, mengutamakan jenis hari yang sama (12 Okt). Sebelumnya median 24 jam bergulir, yang membuat 68–70% titik terbaca "padat" pada siang hari karena jam malam yang sepi ikut dihitung. Pembanding dari kurang dari tiga hari ditandai sementara: anomali belum dinilai dan tingkatnya belum dikirim ke insight. Jam yang belum punya data hari sebelumnya ditulis "belum ada pembanding", tidak diisi dengan angka pengganti.
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

### Pelajaran kalibrasi (12 Okt)
Sejak 11 Okt ada 22 penilaian yang bukan normal. Yang terjadi 12 Okt di Kartini-OUT, KP.Kali-OUT, KS-OUT-2, IPdome-Polder Tawang, dan Kartini-IN dilihat langsung gambar buktinya; sisanya dinilai ulang dengan alat. Tidak ada yang menunjukkan kejadian nyata.

6. **Foto referensi harus menunjukkan keadaan normal yang paling tinggi** (kolam terisi, kanal saat penuh), karena prompt menjadikan referensi patokan utama. Referensi siang Kartini-OUT (kolam hampir kosong) dan KP.Kali-OUT (kanal surut) diganti; foto lama dicadangkan di `FRAMES_DIR\_state\referensi-lama`.
7. **Garis N digambar sedikit di atas muka air normal, bukan tepat di atasnya.** Di IPdome-Polder Tawang dan Kartini-IN, garis N yang berimpit dengan muka air membuat riak kecil terbaca "melewati N".
8. **Garis W dan S di KP.Kali-OUT tertukar** dan sudah dibetulkan; halaman kalibrasi kini menolak urutan yang tertukar.
9. **Penilaian AI atas gambar yang sama bisa berbeda saat diulang**, terutama pada pemandangan di batas dan saat busa pompa menutupi permukaan. Karena itu pembacaan naik kini butuh keyakinan ≥ 0,65 agar dihitung; di bawah itu hanya menandai "perlu diperiksa".
10. **Setiap perubahan kalibrasi atau prompt diuji dengan `scripts/replay_readings.py`**, yang menilai ulang gambar bukti tersimpan. Setelah perbaikan di atas, 130 gambar dari 20 lokasi tidak lagi menghasilkan satu pun pembacaan naik (sebelumnya 8).

11. **Penilaian yang hasilnya naik langsung diulang sekali atas gambar yang sama** (12 Okt sore), dan baru dihitung bila keduanya sepakat. Pemicunya Banger-SD-IN pukul 17.00: kamera melawan cahaya sore, dinilai "awas" dengan keyakinan 0,80, padahal muka airnya setinggi referensi. Saat gambar yang sama dinilai ulang, hasilnya berganti-ganti antara awas dan normal. Dengan pengulangan, tiga putaran atas enam gambar sore kamera itu tidak lagi menghasilkan penilaian naik yang dihitung; yang tidak sepakat ditandai "perlu diperiksa". Biayanya hanya muncul saat ada penilaian naik.
12. **Memilih referensi menurut kecerahan tidak menolong** untuk kasus itu: kecerahan rata-rata area pengamatan Banger-SD-IN hanya berbeda sedikit antara referensi siang (80), referensi malam (61), dan gambar sore (62–70), karena dinding yang gelap dan pantulan langit yang terang saling meniadakan. Gagasan itu diukur lalu ditinggalkan.
13. **Garis N Kartini-OUT ikut digeser** ke dasar dinding beton, seperti IPdome: air kolam yang terisi berimpit dengan garis lama dan sesekali terbaca "waspada" secara konsisten.
14. Batas token jawaban penilaian air dinaikkan dari 700 ke 1.200: sesekali jawaban terpotong menjadi JSON tidak utuh dan tercatat "tidak dapat dinilai".

### Peringatan palsu pertama (13 Okt)
- **Yang terjadi.** Semarang Indah_OUT dinilai "waspada" pada 12.12 (keyakinan 0,72) dan 12.47 WIB (0,66). Keduanya lolos semua saringan: keyakinan ≥ 0,65, dinilai dua kali pada gambar yang sama dan sepakat, dan AI menyebut air "lebih tinggi daripada referensi". Dua penilaian sepakat berturut-turut, jadi status resmi naik, peringatan dibuat, dan kejadian dibuka. Tidak hujan (prakiraan 0,0 mm). Penilaian 13.17 dan 13.47 kembali normal; status resmi turun sendiri setelah penilaian normal ketiga.
- **Gambarnya.** Batas air di dinding kolam sama pada semua gambar pukul 10.37–13.47. Yang berubah hanya warna air: gelap pada pagi hari, hijau-kuning terang saat terkena sinar siang (11.42–13.17).
- **Sebabnya dua lapis.** (1) Garis N kamera ini tergambar di atas permukaan air, di bawah kaki dinding, sehingga menurut definisi prompt ("melewati N → waspada") air selalu di ambang waspada. (2) Saat air terang, AI menilainya lebih tinggi. Catatan 12 Okt sudah menyebut gambar pukul 13.13 kamera ini kadang terbaca "waspada"; pola siangnya nyata.
- **Yang diperbaiki.** Garis N digeser 40% ke arah W, ke kaki dinding (garis lama di `C:\semarsight\frames\_state\referensi-lama`). Nilai ulang 10 gambar terakhir: gambar 12.47 menjadi normal; gambar 12.12 tetap "waspada"; gambar 11.07 sekali terbaca "waspada" lalu normal (ditahan aturan penilaian ganda). Dengan garis baru dua penilaian itu tidak lagi berturut-turut, tetapi **AI masih bisa salah baca pada gambar siang kamera ini.**
- **Pelajaran.** Garis N harus digambar pada benda tetap sedikit DI ATAS muka air normal, tidak pernah di atas airnya. Ini sudah tiga kali terjadi (Kartini-OUT, IPdome, Semarang Indah_OUT); kamera lain belum diaudit untuk hal yang sama.
- **Kejadian palsunya dihapus dari tabel `events`** (keputusan pemilik proyek 13 Okt: halaman Riwayat hanya boleh memuat status yang nyata dan bisa dipertanggungjawabkan). Status resmi turun sendiri pukul 14.22 WIB setelah penilaian normal ketiga, peringatan tertutup, dan kejadian tertutup dengan lama 95 menit; setelah itu barisnya dihapus. Salinannya di `C:\semarsightrames\_stateeferensi-lama\kejadian-palsu-Semarang_Indah_OUT-13okt.json`. Baris kejadian tidak boleh dihapus selagi statusnya masih naik: siklus berikutnya akan membuatnya lagi.
- **Belum diputuskan (menunggu pemilik proyek):** aturan tambahan "tanpa hujan, kenaikan butuh tiga penilaian sepakat, bukan dua".
- **Sisi baiknya.** Ini pertama kalinya alur status resmi → peringatan → kejadian → turun sendiri berjalan dengan data langsung, dan semuanya bekerja seperti di simulasi.

### Risiko dan peringatan
- **Skor risiko 0–1, terbuka:** status air 40%, tren 20%, kondisi hulu 20%, prakiraan hujan 3 jam 20%. Dihitung ulang tiap siklus tanpa menambah panggilan AI.
- **Hubungan hulu–hilir diisi untuk empat rumah pompa** (12 Okt): sisi masuk → sisi keluar Bulu Drain, Kartini, Progo, dan Trimulyo, dengan jeda awal 15 menit yang selalu disebut "perkiraan awal". Hanya pasangan yang jelas dari nama dan jarak (0–140 m) yang diisi; tiga pasangan lain yang berdekatan (IPdome → Mberok, Mberok → Jembatan Mberok, Bulu Drain-OUT → KS-OUT-2) ditinggalkan sampai ada yang memastikan alirannya. Lokasi tanpa hulu tetap berkomponen hulu 0, dan halaman kamera mengatakannya terus terang.
- **Peringatan dari aturan dan template**, bukan dari LLM: air naik, jalan tergenang, hujan lebat, sampah sebelum hujan, kamera unggulan tidak terbaca. Diselaraskan tiap siklus; yang syaratnya hilang ditutup otomatis.
- **Gambar yang dinilai AI disimpan 3 hari** di Storage sebagai bukti; angkanya disimpan tanpa batas.

### Insight dari LLM (12 Okt)
- **LLM menjelaskan, aturan memutuskan.** Tingkat keseluruhan dihitung aturan dari status air terkonfirmasi dan prakiraan hujan, lalu menimpa apa pun yang ditulis LLM. Kalimat "Kondisi kota" di panel kiri juga tetap dari aturan, sehingga selalu tersedia walau LLM gagal.
- **Setiap angka di teks LLM diperiksa terhadap fakta** sebelum disimpan. Angka yang tidak ada di fakta (atau satuan yang tidak diukur: cm, km/jam, liter) membuat item itu dibuang; bila ada di ringkasan, seluruh jawaban dibuang. Ini penerapan langsung dari aturan "jangan menampilkan angka yang tidak dikumpulkan sistem".
- **Schema insight ditambah `cause` dan `impact`**, supaya pola Kondisi → Penyebab → Dampak → Tindakan benar-benar terpisah di data, bukan hanya di tampilan. LLM diminta menulis "belum dapat dipastikan dari data" bila penyebab tidak terlihat, dan "bersamaan dengan" bila hanya korelasi.
- **Tingkat kepadatan lalu lintas tidak dikirim ke LLM selama pembanding masih sementara.** Temuan awalnya: pada siang hari 40 dari 54 titik terbaca "padat" (indeks sampai 15×) karena median 24 jam ikut memuat jam-jam malam yang sepi; kalau angka itu dikirim, LLM akan menulis kota macet. Pembandingnya sudah diganti menjadi per jam pada hari yang sama (lihat bagian Lalu lintas), dan beranda kini menyebut bila pembanding masih sementara. Tingkat kepadatan mulai dikirim ke LLM setelah pembanding punya tiga hari data.
- **Hemat:** fakta disusun tiap siklus tanpa LLM; LLM dipanggil hanya saat keadaan berubah (paling sering tiap 15 menit, segera bila tingkat naik) atau tiap 60 menit sebagai penyegaran. Satu panggilan ±$0,001.
- **Saat tenang paling banyak dua kartu**, dan hujan ringan bukan temuan. Uji pertama menghasilkan empat kartu untuk keadaan normal, termasuk saran "perbaiki baseline" untuk perencana kota; keterbatasan sistem sekarang hanya boleh disebut, tidak dijadikan temuan.
- Label tingkat `aman` di web adalah "Tidak ada temuan penting", karena lokasi air hanya terpantau di 9 dari 16 kecamatan.

### Simulasi kejadian (12 Okt)
- **Belum pernah ada kejadian air naik yang nyata**, jadi tidak ada yang bisa diputar ulang, dan saat demo kemungkinan besar juga tidak ada. Halaman `/simulasi` dibuat supaya alur lengkapnya tetap bisa diperlihatkan.
- **Hanya masukannya yang dibuat-buat** (penilaian AI untuk Progo-IN, Progo-OUT, dan JRAKAH, serta prakiraan hujan). Status, tren, skor risiko, peringatan hulu–hilir, dan ringkasan AI di tiap langkah dihasilkan kode yang sama dengan worker, termasuk panggilan LLM dan pemeriksaan angkanya. Skrip penyusunnya gagal bila hasil aturan tidak sesuai dengan cerita tiap langkah, sehingga simulasi tidak bisa diam-diam menyimpang dari sistem.
- **Tidak ada yang ditulis ke database.** Skenario disimpan sebagai berkas di repo (`web/lib/demo/scenario.json`) dan ditimpakan di browser ke data langsung; tabel `camera_status`, `alerts`, dan `insights` tidak tersentuh, jadi beranda tidak mungkin ikut menampilkan data simulasi.
- **Label selalu terlihat:** pita "SIMULASI · Bukan data langsung" dengan jam simulasi dan penjelasan langkah. Snapshot, lalu lintas, dan halaman kamera tetap data langsung, dan itu ditulis di pita yang sama.

### Perubahan harus terlihat di visual, bukan hanya di teks (12 Okt)
- Masukan pemilik proyek atas simulasi: perubahan tiap langkah harus terbukti dari visualisasinya, dan yang tampil di simulasi harus sama dengan yang tampil saat kejadian nyata. Karena itu linimasa perkembangan dan penanda peta dibuat di layar bersama (`InsightScreen`), bukan khusus simulasi: **saat kejadian nyata, semuanya muncul di Beranda dengan cara yang sama.**
- Yang sebelumnya tidak terlihat sama sekali: lokasi yang baru sekali dinilai naik oleh AI dan belum dikonfirmasi. Sekarang tampak di peta (lingkaran putus-putus), di linimasa (titik di atas pita yang belum berubah), dan di panel kecamatan.
- Linimasa tidak tampil pada hari yang tenang, supaya layar tetap renggang.
- Satu penilaian AI yang kurang yakin tidak lagi menaikkan tingkat kota menjadi "perlu perhatian"; lokasinya tetap disebut dalam fakta insight.

### Halaman Lalu Lintas dari video referensi (12 Okt malam)
- Pemilik proyek memberi video referensi (dasbor lalu lintas kota lain: ruas jalan berwarna, heksagon "potensi", angka emisi 8 polutan dalam g/menit) dan meminta tiga hal: jalan dari dekat dengan tingkat kepadatannya, emisi bila memungkinkan, dan heksagon potensi aktivitas. Disepakati: ruas jalan dan heksagon dibangun; emisi sebagai estimasi relatif untuk 16 Okt, kg/jam diusulkan untuk final.
- **Tata letaknya tidak ditiru.** Referensi itu dasbor padat berangka banyak; halaman kita tetap peta penuh dengan satu lapisan untuk satu pertanyaan. Beranda tidak diubah.
- **Ruas menerus, tetapi yang terlihat dan yang diperkirakan dibedakan.** Versi pertama hanya mewarnai ±200 m di sekitar kamera. Pemilik proyek menunjukkan tangkapan layar referensi dan meminta ruas seperti itu: seluruh jaringan jalan tergambar dan berwarna menerus. Jalan tengahnya: (1) semua jalan utama digambar abu-abu sebagai "tanpa kamera"; (2) jalan yang punya kamera diwarnai sampai ±1 km dari kamera di jalan yang sama, bergaris tipis, sebagai perkiraan; (3) ±200 m yang benar-benar terlihat bergaris tebal bertepi putih. Keterangan di layar menyebut garis tipis sebagai perkiraan.
- **Tidak ada abu-abu; peta dibuat hidup (12 Okt malam, keputusan pemilik proyek).** Versi dengan jalan tanpa kamera berwarna abu-abu dan peta dasar yang diredam dinilai "terlalu kosong"; pemilik proyek meminta sama persis dengan referensi, dan berlaku untuk semua peta termasuk Beranda. Sekarang: (1) jalan tanpa kamera diwarnai dari **kamera lalu lintas terdekat yang sedang punya nilai**, sebagai perkiraan, dan lebih pudar bila kameranya lebih dari 1,5 km; (2) semua peta memakai peta OpenStreetMap standar dengan warna aslinya (`web/lib/map-tiles.ts`), tanpa peredam abu-abu; warna kecamatan di Beranda dibuat lebih tembus pandang. Kejujurannya dipindah dari warna ke teks: keterangan peta dan tooltip tiap jalan menyebut "perkiraan dari kamera terdekat, bukan pengamatan jalan ini". **Ini melonggarkan kebiasaan kita "yang tidak terpantau tidak diberi warna"; bila juri bertanya, jawabannya ada di keterangan itu.** Gaya Voyager dari CARTO sempat dicoba tetapi ubinnya kini bercap "API key required".
- **Heksagon hanya di tempat yang punya kamera**, dan isinya rata-rata dari hari-hari yang sudah terekam ("biasanya"), bukan "potensi" hasil model. Skala warna dihitung dari semua jam sekaligus supaya jam yang berbeda bisa dibandingkan saat penggeser digerakkan. Warnanya ungu, sengaja bukan hijau–merah, supaya tidak terbaca sebagai status bahaya.
- **Mode peta gelap (12 Okt malam).** Pemilik proyek menilai warna jalur dan batas wilayah bertabrakan dengan warna peta dasar, dan meminta mode gelap seperti contoh yang ia kirim. Tombol "Peta gelap" ada di Beranda, Simulasi, Lalu lintas, dan Kamera; pilihannya satu untuk semua peta dan diingat di browser (`web/lib/map-theme.ts`). Peta gelapnya adalah ubin OpenStreetMap yang sama, dibalik warnanya lewat CSS (`.map-dark` di `globals.css`), karena peta dasar gelap siap pakai (CARTO) kini butuh kunci API. Bawaan tetap terang; menjadikannya bawaan cukup mengubah nilai awal di `map-theme.ts`.
- **Pin kamera dan heksagon (12 Okt malam, masukan pemilik proyek).** Pin kamera di peta lalu lintas membesar saat peta didekatkan (jari-jari 6 px pada skala kota sampai 18 px pada skala jalan), garisnya ikut sedikit menebal, dan kamera yang berdiri di tempat yang sama (≤ 30 m) digabung menjadi satu pin berangka; mengklik pin gabungan berulang kali berpindah antar-kameranya. Kisi heksagon kini memenuhi seluruh kota: heksagon tanpa kamera digambar abu-abu rata dan tidak bisa diklik. Di sini abu-abu memang diminta, karena berarti "tidak ada kamera", berbeda dari jalan (yang diberi warna perkiraan).
- **Peta 3D ditunda (12 Okt malam).** Pemilik proyek menanyakan peta 3D seperti MAPID "Street 3D". Bisa, tanpa MAPID: MapLibre GL + OpenFreeMap (tanpa kunci API; sudah diuji terjangkau dari PC ini). Tetapi Leaflet tidak bisa 3D, jadi halaman yang dipindah harus ditulis ulang seluruh lapisannya. Disepakati: tetap peta datar untuk sekarang; versi 3D dibuat nanti bila ada waktu (TX.9), dimulai dari halaman percobaan. Yang belum diketahui: kelengkapan data tinggi bangunan Semarang di OpenStreetMap.
- **Emisi tidak pernah ditulis dalam kg.** Lihat `12-emisi-kualitas-udara.md`. Satuan "setara sepeda motor" dipilih karena jujur sebagai pembanding dan mudah dibayangkan.
- **Temuan saat membangunnya:** indeks kepadatan dari angka kecil menyesatkan (4 kendaraan vs biasanya 1 = "padat"). Diperbaiki di worker dengan batas jumlah minimum, bukan di tampilan, supaya Beranda, insight, dan peringatan ikut benar.
- **Yang belum:** pola heksagon baru dari 3 hari data; porsi jenis kendaraan belum diuji dengan hitungan manual; halaman belum dicoba di layar ponsel; `road-segments.json` berkunci `id` kamera sehingga harus dibangun ulang bila database diganti; data jalan diambil dengan kotak yang hanya 450 m lebih lebar dari kamera terluar (Overpass kehabisan waktu untuk kotak yang lebih lebar pada 12 Okt malam), jadi perpanjangan ruas kamera di tepi wilayah bisa terpotong sebelum 1 km. Jalankan ulang `build_road_segments.py` tanpa `--cache` saat Overpass lancar.

### Keandalan
- Worker menulis log ke berkas bergulir (`FRAMES_DIR/_state/worker.log`), meminta Windows tidak menidurkan mesin, dan menjalankan satu siklus segera setelah mesin terbangun.
- Hanya **satu worker** yang boleh berjalan. Dua worker membuat data ganda dan biaya AI dobel.
- **Klien Supabase di worker memakai HTTP/1.1**, bukan HTTP/2 bawaan pustaka. Di PC, 8 utas yang mengunggah lewat satu sambungan HTTP/2 membuat 10–17% unggahan snapshot gagal (WinError 10035). Uji terpisah dengan pola waktu yang sama: HTTP/2 gagal 12 dan 25 dari 64, HTTP/1.1 berhasil 128 dari 128.

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
- Hubungan hulu–hilir antar lokasi yang berbeda, belajar jeda dari kejadian, halaman admin sungai, dan skema alirannya. Empat pasangan rumah pompa sudah berjalan sejak 12 Okt.
- Kejadian, insight harian, dan insight lintas modul (genangan → lalu lintas). Insight situasi sudah berjalan sejak 12 Okt.
- Pembanding lalu lintas per jam-dalam-minggu dari 28 hari (rancangan akhir); versi per jam dari 14 hari sudah berjalan sejak 12 Okt.
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
| 12 Okt 12.08–13.35 WIB | Tiga penilaian "awas" dalam sehari (Kartini-OUT keyakinan 0,99, KP.Kali-OUT 0,87, KS-OUT-2 0,55 saat pompa berbusa); status resmi tetap normal karena butuh dua penilaian sepakat | Referensi dua kamera diganti, garis KP.Kali-OUT dibetulkan, pembacaan naik butuh keyakinan ≥ 0,65; lihat pelajaran kalibrasi 12 Okt |
| 12 Okt 12.51 WIB | Worker mulai berjalan di PC (siklus terakhir laptop 12.44); dua siklus pertama gagal mengunggah 23 dan 14 snapshot | Klien Supabase dipindah ke HTTP/1.1; pembacaan kamera dan angka tidak terpengaruh, hanya gambar terbaru kamera itu yang tertinggal satu-dua siklus |

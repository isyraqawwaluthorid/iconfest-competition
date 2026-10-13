# 09 — Demo, Evaluasi, dan Laporan

## Evaluasi akurasi (nilai plus untuk Teknologi dan tanya jawab)

1. **Sampel:** ±200 snapshot kamera air unggulan, bertingkat: siang/malam, setiap kamera, dan sebanyak mungkin kondisi tidak normal (semua kejadian yang terekam dimasukkan).
2. **Label manual** di `/admin/label` tanpa melihat output AI (blind). Bila memungkinkan, dua orang melabeli 50 sampel yang sama untuk mengukur kesepakatan antar-pelabel.
3. **Metrik:**
   - Akurasi dan F1 per kelas status (normal/waspada/siaga/awas) dan genangan.
   - Confusion matrix.
   - Dipisah siang vs malam, dan per kualitas gambar.
   - Tingkat "tidak dapat dinilai" (berapa persen sistem menolak menilai).
   - Untuk penghalusan: berapa peringatan palsu yang dicegah dibanding output mentah.
4. **Lalu lintas:** hitung manual kendaraan pada 50 snapshot, bandingkan dengan YOLO (MAE dan korelasi). Tekankan bahwa yang dipakai adalah indeks relatif.
5. **Biaya:** rata-rata panggilan AI vision per kamera per hari dan berapa persen dihemat oleh deteksi perubahan lokal (dibanding memanggil AI setiap siklus).
6. **Keandalan:** ketersediaan worker dan kamera selama periode uji.

### Hasil evaluasi hitungan kendaraan (13 Okt 2026, siang)

Sampel: 10 kamera lalu lintas, satu gambar tiap kamera, siklus 15.30 WIB (cerah). Pembandingnya adalah hitungan dengan mata atas gambar yang sama, **dilakukan asisten AI yang mengerjakan proyek, bukan manusia**, dari gambar berlebar 960 px dengan kotak deteksi tergambar (`worker/scripts/annotate_counts.py`). Angka pembanding bersifat kira-kira, terutama pada kerumunan sepeda motor.

| Jenis | Dicatat sistem (yolo11n) | Hitungan pembanding | Catatan |
|---|---|---|---|
| Mobil | 115 | ±119 | Jumlahnya dekat, tetapi sebagian karena galat yang saling menutup: mobil jauh terlewat, sebagian mobil terbaca truk |
| Sepeda motor | 27 | ±78 | **Hanya sekitar sepertiga yang terhitung.** Pengendaranya sering terdeteksi sebagai orang, motornya tidak |
| Bus | 5 | 2 | Papan toko dan mobil gelap terbaca bus |
| Truk | 29 | ±15 | Mobil van, MPV besar, dan pikap terbaca truk; pikap kadang terhitung dua kali (mobil dan truk) |
| Semua kendaraan | 176 | ±214 | Sistem menghitung sekitar 82% |

Artinya:
- **Indeks kepadatan relatif masih layak dipakai**: tiap kamera dibandingkan dengan dirinya sendiri, jadi kekurangan hitung yang ajek ikut tercoret. Yang tidak boleh dilakukan adalah menyebut angka itu sebagai jumlah kendaraan sebenarnya.
- **Porsi jenis kendaraan tidak layak dikutip**: sepeda motor 15% menurut sistem, ±36% menurut pembanding; truk 16% berbanding ±7%. Lapisan Beban emisi bergantung pada porsi ini, jadi hanya peringkat antar-ruasnya yang berguna.
- Kamera bersudut sangat lebar (Tugumuda 2 Wide) kehilangan banyak kendaraan kecil di kejauhan.

Perbandingan model pada 10 gambar kamera yang sama (diambil 15.35 WIB, lebar 960 px, tanpa hitungan pembanding):

| Model | Mobil | Sepeda motor | Bus | Truk | Waktu 10 gambar |
|---|---|---|---|---|---|
| yolo11n (dipakai sekarang) | 90 | 29 | 7 | 11 | 1,7 detik (termasuk pemanasan) |
| yolo11s | 103 | 72 | 1 | 15 | 1,0 detik |
| yolo11m | 99 | 66 | 2 | 18 | 2,5 detik |

yolo11s menemukan ±2,5 kali lebih banyak sepeda motor dan jauh lebih sedikit bus palsu; dua gambar hasilnya diperiksa dengan mata dan kotak tambahannya memang sepeda motor. Kerumunan motor yang rapat tetap banyak terlewat. **Model diganti ke yolo11s pada 13 Okt 2026 pukul 16.29 WIB.** Pada siklus pertamanya, kamera lalu lintas mencatat 1.238 kendaraan (mobil 622, sepeda motor 441, bus 19, truk 156) dari 55 kamera, dibanding 896 (mobil 488, sepeda motor 285, bus 23, truk 100) dari 51 kamera pada siklus terakhir model lama lima menit sebelumnya: sekitar 1,4 kali lebih banyak, dan sepeda motor 1,5 kali. Kenaikannya lebih kecil daripada pada uji gambar 960 px karena worker menghitung pada gambar ukuran penuh. Porsi truk masih 13%, jadi salah baca van dan pikap sebagai truk belum hilang. Lama siklus naik dari ±50 menjadi ±90 detik (batasnya 300). Karena hitungan naik di semua kamera, pembanding ("kebiasaan") dikumpulkan ulang dari nol; riwayat pembanding hanya memakai hitungan dari model yang sama. **Model baru belum dibandingkan dengan hitungan mata.**

Yang belum dievaluasi: malam hari, hujan, hitungan orang, dan pembanding oleh manusia.

### Hasil evaluasi penilaian sampah (13 Okt 2026, siang)

Sampel: satu gambar siang terbaru dari tiap lokasi air yang dinilai AI dan bukan jalan (16 lokasi), dinilai ulang dengan petunjuk yang sudah memuat definisi tiap tingkat. Pembandingnya penilaian mata atas gambar yang sama, **dikerjakan asisten AI yang mengerjakan proyek, bukan manusia**, dari potongan gambar berlebar ±470 px.

| | Jumlah |
|---|---|
| Sepakat | 13 dari 16 |
| Berbeda satu tingkat, antara "tidak terlihat" dan "sedikit" | 3 (Kartini-OUT, Semarang Indah_OUT, Trimulyo_Depan) |
| "Banyak" yang benar | 1 dari 1 (KP.Kali-OUT) |
| "Banyak" yang keliru | 0 |

Busa pompa di Bulu Drain-OUT dan tanaman air di Kartini-OUT tidak dinilai sebagai sampah banyak. Perbedaan yang ada hanya di ujung bawah skala, yang tidak memicu apa pun.

Batas evaluasi ini: sampel kecil; hanya satu lokasi yang benar-benar bersampah banyak, jadi kemampuan sistem menemukan "banyak" di lokasi lain belum teruji; malam hari belum dievaluasi; pembandingnya bukan manusia. Yang dinilai adalah tingkat (tiga kelas) dari gambar, bukan berat atau volume sampah.

Penghalusan: dengan aturan "4 dari 6 penilaian", pada penilaian 72 jam yang tersimpan status "banyak" menyala 7 kali di empat lokasi (11 kali dengan "3 dari 4"; penilaian mentahnya berganti jauh lebih sering).

## Skenario video demo penyisihan (±3 menit)

1. **Masalah (20 detik):** ratusan CCTV kota Semarang, hanya ditonton; banjir dan genangan kronis.
2. **Denyut Kota (30 detik):** beranda dengan kondisi terkini, insight AI, peringatan aktif.
3. **Air (60 detik):** buka kamera sungai unggulan: snapshot dengan garis acuan, status, alasan AI, timeline. Diagram hulu → hilir. Replay satu kejadian: status naik di hulu, peringatan muncul untuk hilir sebelum hilir naik.
4. **Lintas modul (30 detik):** genangan di kamera JRAKAH/SP. AKPOL bersamaan dengan kepadatan naik ×2 di sekitarnya.
5. **Di balik layar (30 detik):** pipeline: YOLO lokal, AI vision hanya saat ada perubahan, aturan transparan, skor risiko dengan bobot terbuka. Angka akurasi dan penghematan panggilan AI.
6. **Penutup (10 detik):** untuk BPBD, PU, Dishub, warga.

## Struktur demo final (15 menit)

| Menit | Isi |
|---|---|
| 0–2 | Live: beranda dan peta dengan data saat itu (tunjukkan kesegaran data) |
| 2–6 | Modul air: kamera live, kalibrasi (tunjukkan admin kalibrasi), replay kejadian hulu → hilir |
| 6–9 | Lalu lintas dan ruang publik: anomali, baseline, insight lintas modul |
| 9–11 | Asisten AI: 2–3 pertanyaan yang sudah diuji |
| 11–13 | Keandalan: kamera mati, worker dimatikan → banner; data tetap tampil |
| 13–15 | Evaluasi: akurasi, confusion matrix, batasan |

**Rencana cadangan:** jika internet venue buruk, gunakan hotspot sendiri; jika tetap gagal, putar video demo dan gunakan replay dari data lokal.

## Persiapan tanya jawab

| Pertanyaan juri | Inti jawaban |
|---|---|
| Kenapa tidak cukup petugas menonton CCTV? | Ratusan kamera, 24 jam; sistem membandingkan dengan normal tiap kamera, menghubungkan hulu-hilir dan cuaca, dan menyimpan riwayat |
| Seberapa akurat? | Tunjukkan angka evaluasi siang/malam; sistem menolak menilai gambar buruk; penghalusan mencegah alarm palsu |
| Kenapa memakai AI vision, bukan sensor? | Memanfaatkan infrastruktur yang sudah ada tanpa biaya perangkat; melengkapi, bukan menggantikan, alat ukur resmi |
| Bagaimana jika malam/hujan di lensa? | Deteksi kualitas, mode malam, keyakinan rendah → "tidak dapat dinilai" |
| Biaya AI? | Deteksi perubahan lokal + batas harian; tunjukkan angka penghematan |
| Privasi dan legalitas? | Tanpa kamera RT/RW, tanpa pengenalan wajah/pelat, hanya agregat, retensi terbatas, atribusi, permohonan izin ke Diskominfo |
| Apa bedanya dengan karya serupa (mis. EcoTraffic GIS)? | Fokus air dan peringatan dini hulu-hilir, multi-modul dengan insight lintas modul, pengguna operasional |
| Bisa dipakai kota lain? | Sumber data modular; Yogyakarta sudah diuji (142/150 kamera hidup, gambar bersih) |
| Kalau sumber CCTV mati? | Pemantauan kesehatan kamera, data historis tetap, sinkronisasi harian |

## Kerangka laporan penyisihan

Ikuti **template resmi panitia** (bit.ly/TemplateLaporandanKeaslianproject). Jika template mengizinkan, petakan isinya ke rubrik:

1. **Pendahuluan dan latar belakang** → *Urgensi (25%)*: banjir/genangan Semarang dengan data resmi dan sumber; CCTV kota yang belum dimanfaatkan.
2. **Rumusan masalah dan tujuan.**
3. **Solusi dan kesesuaian dengan tema Smart City** → *Ide (25%)*: konsep sensor kota, modul, insight lintas modul, pengguna.
4. **Inovasi dan pembeda** → *Ide*: perbandingan dengan karya/produk serupa.
5. **Arsitektur dan teknologi** → *Teknologi (30%)*: pipeline, alasan pemilihan tiap teknologi (ketepatan), diagram, tech stack.
6. **Metodologi analisis:** kalibrasi, deteksi perubahan, klasifikasi AI vision, penghalusan, baseline, skor risiko.
7. **Implementasi dan progres** → *Progres (20%)*: fitur selesai vs rencana, tangkapan layar, link deploy dan repo.
8. **Evaluasi awal:** akurasi, biaya, keandalan.
9. **Etika, privasi, dan keterbatasan.**
10. **Rencana pengembangan menuju final.**
11. **Daftar pustaka.**

Bahan dari dokumen lain: masalah dan solusi (`01`), arsitektur (`02`), sumber data dan etika (`03`), metode (`05`), prompt (`07`).

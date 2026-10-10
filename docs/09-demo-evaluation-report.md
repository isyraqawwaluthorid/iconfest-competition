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

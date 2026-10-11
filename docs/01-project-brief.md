# 01 — Project Brief

## Ringkasan satu kalimat

**SemarSight** (nama kerja) mengubah ratusan CCTV publik Kota Semarang yang selama ini hanya "ditonton" menjadi sensor kota: AI membaca kondisi air, lalu lintas, dan ruang publik, lalu menghubungkannya dengan cuaca dan riwayat untuk memberi peringatan dini dan insight yang bisa ditindaklanjuti.

## Konteks lomba

- **Lomba:** ICONFEST 2026 (HMIF Universitas Siliwangi), cabang **Software Development**, tema **Smart City**.
- **Bentuk karya:** website (boleh web, mobile, atau desktop).
- **Deliverables penyisihan (16 Okt 2026, progres ≥75%):**
  1. Laporan penyisihan (deskripsi, urgensi, tech stack), mengikuti template resmi panitia.
  2. Link repository (GitHub).
  3. Link prototype/deployment yang bisa diakses langsung oleh juri.
  4. Video presentasi/demo singkat.
  5. Scan surat pernyataan orisinalitas, ditandatangani ketua tim di atas materai.
- **Final luring (26 Okt 2026):** 5 tim terbaik; presentasi 20 menit, demo 15 menit, tanya jawab 5 menit.
- **Aturan penting:** diskualifikasi jika karya terbukti pernah diunggah di lomba lain, atau ada plagiarisme.

### Rubrik penilaian

| Babak | Kategori | Bobot | Yang dinilai |
|---|---|---|---|
| Penyisihan | Ide | 25% | Kesesuaian dengan tema; inovasi dan kreativitas |
| | Urgensi | 25% | Manfaat dan dampak sosial |
| | Teknologi & Implementasi | 30% | **Keterbaruan** dan **ketepatan** teknologi |
| | Laporan & Progres | 20% | Format penulisan; capaian progres |
| Final | Penyampaian & Pemahaman | 25% | Kejelasan; penguasaan masalah dan solusi |
| | Teknis & Fungsionalitas | **45%** | Fungsi utama berjalan; **stabilitas dan keandalan**; **arsitektur dan maintainability** |
| | UI/UX | 30% | Kemudahan penggunaan; desain; mudah dipahami orang awam |

**Implikasi:** model bisnis tidak dinilai. Yang menang adalah masalah yang kuat, teknologi yang tepat guna (bukan sekadar canggih), dan sistem yang stabil saat demo. Tiga fitur yang berjalan sempurna lebih baik daripada sepuluh fitur setengah jadi.

## Masalah

1. **CCTV kota melimpah tetapi hanya ditonton.** Semarang memiliki ratusan kamera publik (sungai, rumah pompa, titik genangan, simpang, kawasan wisata), tetapi pemantauannya mengandalkan petugas yang melihat layar satu per satu. Tidak ada yang merangkum, membandingkan dengan kondisi normal, atau mendeteksi pola.
2. **Banjir dan genangan adalah masalah kronis Semarang** (hujan lokal, rob, penurunan muka tanah, sistem polder dan pompa). Respons sering reaktif: kawasan baru disiagakan setelah air naik.
3. **Data kota terpisah-pisah.** Kondisi air, lalu lintas, dan cuaca dipantau terpisah, padahal saling memengaruhi (genangan → kemacetan; hujan → keramaian turun; sampah di pintu air → risiko luapan).
4. **Warga tidak mendapat informasi yang bisa ditindaklanjuti**, misalnya jalan mana yang sedang tergenang dan rute mana yang sebaiknya dihindari.

> Untuk laporan: dukung poin 2 dengan data resmi (BPBD Kota Semarang, BNPB/DIBI, publikasi penurunan muka tanah), dan kutip sumbernya. Jangan memakai angka tanpa rujukan.

## Solusi

Satu platform dengan satu pipeline bersama dan beberapa modul analisis:

| Modul | Kamera sumber | Metode | Contoh insight |
|---|---|---|---|
| **Air & genangan** (unggulan) | Sungai, pompa, genangan (76 kamera unik) | AI vision terkalibrasi (ROI + garis acuan), dipanggil saat ada perubahan | "Hulu Kali X siaga; hilir diperkirakan naik 60–90 menit lagi" |
| **Lalu lintas** | Lalu lintas (66 kamera) | YOLO hitung kendaraan + baseline per jam | "Simpang Kalibanteng 2× lebih padat dari biasanya untuk Jumat 17.00" |
| **Ruang publik** | Pariwisata (9 kamera: Kota Lama, Lawang Sewu, Titik Nol) | YOLO hitung orang + baseline | "Kota Lama paling ramai Sabtu 19.00–21.00" |
| **Sampah perairan** (tambahan) | Sungai, pompa | Bagian dari klasifikasi AI vision | "Sampah menumpuk di intake pompa X, bersihkan sebelum hujan" |
| **Kualitas udara & emisi** (bertahap, lihat `12-emisi-kualitas-udara.md`) | Open-Meteo, stasiun PM2.5 BMKG; lalu lintas terpilih untuk emisi | Kualitas udara model + terukur dengan kategori ISPU. Estimasi emisi Tier 2 (Permen LH 12/2010) dari arus kendaraan, setelah uji kelayakan hitungan | "PM2.5 kategori Sedang; estimasi NOx di Simpang X 1,4× dari biasanya" |
| **Kesehatan jaringan CCTV** | Semua | Cek stream | "9 kamera lalu lintas mati >24 jam" |

**Insight lintas modul** (pembeda utama):
- Hujan/genangan → lalu lintas. Ada **12 kamera yang sekaligus kamera lalu lintas dan titik genangan**, sehingga dampaknya terlihat dari kamera yang sama.
- Sampah di pintu air + prakiraan hujan → risiko luapan lebih cepat.
- Cuaca → keramaian ruang publik.
- Rencana lanjutan: genangan → kendaraan tertahan → estimasi tambahan emisi dari antrean; emisi koridor → paparan di sekitar sekolah dan fasilitas kesehatan.

## Pengguna dan tindakan

| Pengguna | Kebutuhan | Tindakan yang dibantu |
|---|---|---|
| BPBD Kota Semarang | Peringatan dini, prioritas kawasan | Menyiagakan kawasan sebelum air naik |
| Dinas PU / operator pompa | Kondisi sungai, pompa, sampah | Menyiapkan pompa, membersihkan pintu air |
| Dishub | Dampak genangan ke lalu lintas, anomali kepadatan | Pengalihan arus |
| Bappeda / perencana | Riwayat titik rawan, durasi surut | Prioritas perbaikan drainase |
| Warga | Jalan tergenang, kondisi sekitar | Menghindari rute, bersiap |

## Nilai unik (jawaban untuk "kenapa tidak cukup menonton CCTV / pakai ChatGPT?")

1. **Memantau terus-menerus** ratusan kamera, sesuatu yang tidak mungkin dilakukan manusia secara konsisten.
2. **Membandingkan dengan kondisi normal tiap kamera** (baseline per jam dalam seminggu), sehingga anomali terdeteksi.
3. **Menghubungkan kamera satu sama lain** (hulu → hilir) dan dengan cuaca, menghasilkan peringatan sebelum masalah sampai.
4. **Menyimpan riwayat** sehingga muncul pola: titik paling sering tergenang, durasi surut, dampak ke lalu lintas.
5. **AI tepat guna:** model deteksi lokal yang murah untuk menghitung, AI vision hanya saat dibutuhkan, aturan transparan untuk keputusan, LLM untuk menjelaskan.

## Karya terdahulu dan pembeda

- **EcoTraffic GIS** (MAPID Catalyst 2026, Yogyakarta): menghitung kendaraan dari CCTV Jogja dengan YOLO11n, menghitung emisi, skoring AHP untuk prioritas koridor, rekomendasi AI. Fokus: **emisi lalu lintas** untuk perencana.
- **Pembeda SemarSight:** fokus utama **air dan genangan** (peringatan dini hulu-hilir), **multi-modul dengan insight lintas modul**, kota berbeda, pengguna operasional (BPBD, PU, warga) selain perencana. Modul lalu lintas di SemarSight pertama-tama melayani insight lintas modul; estimasi emisi adalah pengembangan lanjutan yang dihubungkan dengan genangan, fasilitas sensitif, dan kualitas udara terukur, dengan EcoTraffic GIS sebagai rujukan metode.
- Referensi produk serupa di luar negeri untuk *state of the art* (cek dan kutip sendiri): sistem analitik video kota (smart city video analytics), pemantauan sungai berbasis kamera (camera-based river monitoring / image-based water level), Waze (data berbasis komunitas), Opower (perbandingan dengan baseline).

## Batasan yang disampaikan secara jujur

- Status air berbasis visual, **bukan pengukuran tinggi air dalam cm**. Alat bantu peringatan dini, bukan pengganti alat ukur resmi.
- Akurasi menurun pada malam hari dan saat lensa basah/berembun; sistem menandai "tidak dapat dinilai".
- Ketersediaan bergantung pada stream PANTAUSEMAR (tidak ada API resmi). Sistem memantau kesehatan kamera dan menyimpan riwayat sebagai cadangan.
- Jumlah kendaraan/orang adalah **indeks relatif** terhadap kondisi normal kamera tersebut, bukan hitungan presisi.

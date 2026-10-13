# 17 — Naskah Video Demo Penyisihan

Naskah per adegan untuk video demo (target ±3 menit; sesuaikan bila panitia menetapkan durasi lain). Direkam **Jumat 16 Okt**; halaman Lalu lintas sudah berwarna sejak Rabu sore.

## Sebelum merekam

1. Jalankan `worker\scripts\status.py`: pastikan worker terlihat beberapa menit lalu dan tidak ada peringatan yang janggal.
2. Buka tautan deploy (bukan `localhost`) di jendela browser selebar ±1440 px, zoom 100%.
3. Pilih satu tampilan peta (terang atau gelap) dan pakai terus sepanjang video. Saran: gelap, karena warna status lebih menonjol.
4. Buka dulu tiap halaman sekali supaya peta sudah termuat.
5. Rekam layar dan suara terpisah bila bisa; suara lebih mudah diulang daripada gerakan layar.
6. Jangan menyebut angka yang tidak ada di layar. Kata yang dipakai: "menilai", "status", "indeks relatif", "estimasi"; hindari "mengukur", "akurat 100%", "real-time" (datanya diperbarui tiap 5 menit).

## Adegan

| # | Detik | Layar dan yang diklik | Narasi |
|---|---|---|---|
| 1 | 0–20 | Halaman Kamera → Mosaik (banyak gambar CCTV sekaligus) | "Kota Semarang punya ratusan CCTV publik: di sungai, rumah pompa, simpang jalan, dan kawasan wisata. Semuanya bisa ditonton, tetapi tidak ada yang sanggup menonton semuanya sepanjang hari. Padahal Semarang berulang kali dilanda banjir dan genangan." |
| 2 | 20–45 | Beranda. Arahkan kursor ke panel kiri, lalu tab Insight di kanan | "SemarSight menjadikan kamera-kamera itu sensor kota. Setiap lima menit sistem mengambil satu gambar dari 146 kamera. Yang ditampilkan bukan tayangannya, melainkan kesimpulannya: kondisi air tiap kecamatan, hujan tiga jam ke depan, dan ringkasan berbahasa awam beserta saran tindakan." |
| 3 | 45–75 | Klik "Lihat lokasi air satu per satu" → klik satu lokasi (mis. KP.Kali-OUT) → tunjuk gambar dengan garis N/W/S/A dan rincian skor risiko | "Di tiap lokasi air, manusia menggambar garis acuan sekali. AI vision lalu membandingkan gambar terbaru dengan garis itu dan dengan foto keadaan normal. Tetapi AI hanya mengamati. Status resmi baru naik bila dua penilaian berturut-turut sepakat, lalu digabung dengan tren, kondisi hulu, dan prakiraan hujan menjadi skor risiko yang bobotnya terbuka." |
| 4 | 75–115 | Simulasi. Klik Berikutnya pelan-pelan: langkah 2 (peringatan sampah + hujan), langkah 3 (indikasi awal), langkah 4 (status naik, peringatan dini hilir), langkah 6 (siaga + genangan JRAKAH), langkah 8 (kembali normal) | "Selama sistem berjalan belum ada air yang benar-benar naik, jadi alurnya kami perlihatkan lewat simulasi. Hanya masukannya yang buatan; aturan dan AI-nya sama. Hujan diprakirakan, dan karena sampah menumpuk di satu rumah pompa, Dinas PU diingatkan membersihkan saringan. AI menilai air naik: itu baru indikasi awal. Penilaian kedua sepakat, status resmi naik, dan lokasi hilirnya mendapat peringatan dini sebelum airnya sampai. Setelah tiga penilaian normal, semuanya tertutup sendiri dan tercatat di Riwayat." |
| 5 | 115–140 | Lalu lintas: lapisan Ruas jalan, klik satu ruas → Aktivitas per jam, geser penggeser → Beban emisi | "Kamera jalan menghitung kendaraan dengan model yang berjalan lokal, tanpa biaya per gambar. Tiap ruas dibandingkan dengan kebiasaannya sendiri pada jam yang sama, jadi warna berarti lebih padat dari biasanya, bukan kecepatan. Dari data yang sama: pola aktivitas per jam dan estimasi relatif beban emisi." |
| 6 | 140–155 | Ruang publik (peta kecil dan kartu Kota Lama) → Beranda, tema Sampah perairan | "Di Kota Lama sistem menghitung pejalan kaki, tanpa pengenalan wajah. Dan dari gambar yang sama dengan status air, AI menilai tingkat sampah di perairan." |
| 7 | 155–175 | Halaman Tentang (bagian batasan), lalu sekilas README/arsitektur | "Kami menuliskan batasnya terus terang: ini penilaian visual, bukan pengukuran tinggi air; wilayah tanpa kamera ditandai tidak terpantau; dan saat AI kami salah baca, kami menelusuri sebabnya dan memperbaikinya di aturan. Sistem ini melengkapi, bukan menggantikan, alat ukur resmi." |
| 8 | 175–185 | Beranda | "SemarSight: infrastruktur yang sudah ada, dibuat bisa dibaca. Untuk BPBD, Dinas PU, Dishub, dan warga Semarang." |

## Catatan

- Adegan 4 adalah inti video; bila harus memotong, pendekkan adegan 5 dan 6, bukan adegan 4.
- Bila pada hari perekaman ada peringatan sungguhan di Beranda, tunjukkan itu di adegan 2 dan sebut bahwa itu data langsung.
- Halaman Lalu lintas dan Ruang publik masih berlabel "pembanding sementara" sampai Senin 19 Okt. Tidak perlu disembunyikan; bila ingin, sebut: "sistem tahu kapan datanya belum cukup, dan mengatakannya."
- Jangan menayangkan halaman admin dengan sandi terlihat, berkas `.env`, atau dasbor Supabase.

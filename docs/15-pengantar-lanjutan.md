# 15 — Pengantar untuk Melanjutkan Pekerjaan

Catatan serah-terima saat pengerjaan utama berpindah dari laptop ke PC pada 12 Oktober 2026. Isinya: keadaan saat itu, urutan kerja yang disarankan sampai tenggat, hal yang mudah salah, dan cara menjaga kesinambungan. Latar keputusan ada di `13-catatan-keputusan.md`; cara menjalankan ada di `14-operasional.md`; daftar tugas rinci ada di `10-tasklist.md`.

Tenggat: penyisihan **Jumat, 16 Oktober 2026** (progres minimal 75%), final **26 Oktober 2026** (presentasi 20 menit, demo 15 menit, tanya jawab 5 menit).

## 1. Keadaan saat serah-terima

- Worker merekam 146 kamera tiap 5 menit; 20 lokasi air (16 pompa/sungai/kolam, 4 jalan) dinilai AI. Tren, skor risiko, dan lima jenis peringatan berjalan.
- Web: beranda peta penuh per kecamatan dengan panel mengambang, halaman bukti visual per kamera, peta kamera, mosaik, admin kalibrasi. Belum di-deploy; baru berjalan lokal.
- Semua lokasi berstatus normal dan cuaca kering. **Belum pernah ada kejadian air naik yang nyata**, jadi jalur peringatan air baru teruji dengan data buatan.
- Data lalu lintas terkumpul sejak 10 Okt malam, dengan beberapa jeda (lihat tabel kejadian di dokumen 13).

## 2. Urutan kerja yang disarankan

Urutan ini menimbang rubrik lomba (fungsi berjalan, kebaruan, kejelasan untuk orang awam, kejujuran data) dan sisa waktu.

### Sebelum 16 Oktober

1. **Pastikan worker di PC stabil.** Awali tiap sesi dengan `worker\scripts\status.py`. Jeda data hanya boleh terjadi karena hal di luar kendali.
2. **Deploy web ke Vercel.** Juri membuka tautan, bukan `localhost`. Setelah ter-deploy, kalibrasi juga bisa dilakukan dari perangkat mana pun. Akar proyek `web`; dua variabel publik dan empat variabel server (lihat `.env.example`). Sandi admin di Vercel harus kuat.
3. **Insight dari LLM.** Ini pembeda utama proyek: kartu Kondisi → Penyebab → Dampak → Tindakan dari fakta yang dikumpulkan worker (`insights.py`, prompt dan schema di `07-ai-prompts.md`). LLM menerima angka dan status, bukan gambar, dan hanya dipanggil saat ada perubahan berarti. Tempatnya di panel kanan beranda dan di panel kecamatan.
4. **Hubungan hulu–hilir.** Susun usulan pasangan dari nama dan lokasi (misalnya sisi masuk → sisi keluar pompa yang sama, lalu lokasi dalam satu sistem sungai), minta persetujuan pemilik proyek, isi `river_links`. Ini menghidupkan komponen hulu di skor risiko (sekarang selalu 0) dan peringatan dini hilir.
5. **Cara mendemokan kejadian.** Kemungkinan besar tidak ada banjir saat demo. Siapkan mode replay atau data simulasi yang **ditandai jelas** (kolom `source` sudah punya nilai `live`, `replay`, dan `synthetic`; lihat `04-database.md`), supaya juri bisa melihat status naik, peringatan muncul, dan panel berubah. Jangan pernah mencampur data simulasi ke tampilan langsung tanpa label.
6. **Grafik di panel kecamatan:** tren 24 jam lebih dulu; kurva hari ini vs kebiasaan dan matriks jam × hari menyusul karena butuh beberapa hari data.
7. **README, video demo, dan laporan** (kerangka di `09-demo-evaluation-report.md`).

### Antara 16 dan 26 Oktober

8. **Evaluasi akurasi dengan label manusia**, siang dan malam, minimal ±100 sampel; hasilnya masuk laporan. Arsip gambar di `FRAMES_DIR` adalah bahannya.
9. Kejadian dan insight lintas modul (genangan → lalu lintas), halaman Air, Lalu Lintas, Riwayat (dengan unduh CSV), Tentang / Cara Kerja AI.
10. Fitur tambahan terpilih di `11-feature-backlog.md`, hanya jika inti sudah rapi.

## 3. Hal yang mudah salah

**Worker**
- Hanya satu worker. Sebelum menyalakan, pastikan detak di database tidak sedang diperbarui mesin lain.
- Buat virtualenv dengan `py -3.13`; pasang `ultralytics` dengan `--no-deps`.
- Setelah mengubah kode worker, muat ulang di antara dua siklus (`scripts\windows\muat-ulang-worker.ps1`), lalu baca log untuk memastikan siklus berikutnya selesai.
- Setelah mengubah prompt atau kalibrasi, uji dengan `scripts\probe_camera.py` pada beberapa frame **sebelum** worker memakainya, lalu uji ulang semua lokasi agar tidak ada yang mundur.
- Status air yang naik harus dicurigai dulu sebagai salah baca (kalibrasi, busa, pantulan) dan diperiksa dari gambarnya, sebelum dianggap kejadian.

**Web**
- Membangun web memakan CPU dan bisa membuat pengambilan gambar worker kehabisan waktu; pakai `scripts\windows\mulai-web.ps1` yang menunggu worker diam.
- PostgREST mengembalikan paling banyak 1.000 baris per permintaan. Untuk grafik per kecamatan, agregasikan di database (view atau fungsi SQL) atau ambil bertahap; jangan mengandalkan satu permintaan besar.
- Perubahan skema berarti berkas SQL baru yang dijalankan pemilik proyek di Supabase SQL Editor; `schema_features.sql` dan `schema_emissions.sql` **belum** dijalankan.
- Ikuti pola Next.js 16 yang sudah ada; baca `web/AGENTS.md` sebelum memakai API yang belum dipakai di repo.

**Windows dan PowerShell**
- Jangan menamai variabel `$pwd` atau `$host` (bentrok dengan variabel bawaan).
- `Set-Content -Encoding utf8` di Windows PowerShell menambah BOM; untuk berkas yang dibaca program lain pakai `[IO.File]::WriteAllText` dengan UTF-8 tanpa BOM.
- Kunci rahasia Supabase ditolak jika `User-Agent` permintaan menyerupai browser.
- Jangan menaruh repo, `.env`, atau arsip gambar di folder yang tersinkron ke OneDrive.

**Data dan kejujuran**
- Tidak ada tinggi air dalam cm, kecepatan, debit, atau angka lain yang tidak benar-benar dikumpulkan.
- Kecamatan tanpa sumber data tetap "tidak terpantau".
- Periksa rahasia sebelum setiap push; `.env` dan `web/.env.local` tidak boleh pernah ter-commit.

## 4. Yang menunggu pemilik proyek

- Referensi siang untuk 4 kamera jalan (JRAKAH, SP. AKPOL, Jembatan Mberok, DPU_Pahlawan); referensi malam DPU-Mberok2-OUT bila gambarnya cukup terang.
- Persetujuan atas usulan pasangan hulu–hilir.
- Akun dan langkah deploy Vercel.
- Email izin ke Diskominfo; jam tenggat dan template laporan dari panitia; materai.
- Menjadikan repo publik sebelum 16 Okt; mengganti kunci rahasia Supabase dan sandi admin sebelum pengumpulan.

## 5. Menjaga kesinambungan

- **PC adalah tempat kerja utama.** Laptop hanya dipakai di luar rumah dan tidak menjalankan worker.
- Awali sesi dengan `git pull`; akhiri dengan commit kecil dan `git push`.
- Di akhir tiap sesi, perbarui `10-tasklist.md`. Setiap keputusan baru, hasil brainstorm, atau pelajaran dicatat di `13-catatan-keputusan.md` (dan `11-feature-backlog.md` untuk ide fitur), supaya sesi berikutnya, di mesin mana pun, mulai dari keadaan yang sama.
- Uji sebelum menyatakan selesai: satu siklus worker terhadap kamera nyata, data masuk Supabase, halaman web menampilkannya.

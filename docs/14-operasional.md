# 14 — Panduan Operasional

Cara menyiapkan mesin, menjalankan worker dan web, memeriksa keadaan, dan memindahkan worker antar mesin. Semua perintah untuk Windows PowerShell, dijalankan dari folder repo.

## 1. Peran tiap mesin

| Mesin | Peran |
|---|---|
| **PC (menetap)** | Menjalankan worker 24 jam dan menjadi tempat pengerjaan utama. |
| **Laptop** | Hanya untuk bekerja di luar rumah: web, dokumen, kalibrasi lewat browser. **Tidak menjalankan worker.** |

Aturan paling penting: **hanya satu worker yang boleh berjalan.** Dua worker bersamaan membuat data ganda, biaya AI dobel, dan status yang saling menimpa. Web boleh dijalankan di mesin mana pun karena hanya membaca dari Supabase.

Sebelum bekerja di mesin mana pun, jalankan `git pull`. Setelah selesai, commit dan `git push`.

## 2. Menyiapkan mesin baru

### 2.1 Program yang dibutuhkan

```powershell
winget install Git.Git
winget install Python.Python.3.13
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
```

Tutup lalu buka lagi PowerShell, kemudian periksa: `git --version`, `py -3.13 --version`, `node --version` (20 ke atas), `ffmpeg -version`.

Pakai `py -3.13`, bukan `python`: di mesin yang sudah punya Python lama, perintah `python` bisa menunjuk ke versi lama itu (di PC tim, `python --version` menjawab 3.5.4). Worker butuh Python 3.11 ke atas. Setelah virtualenv dibuat, semua perintah memakai `.venvScriptspython.exe`, jadi versi bawaan mesin tidak berpengaruh lagi.

Jangan menaruh repo, `.env`, atau arsip gambar di dalam folder OneDrive: isinya akan ikut tersinkron ke awan.

### 2.2 Kode dan berkas rahasia

```powershell
git clone https://github.com/randymuflih/iconfest-competition.git
cd iconfest-competition
```

Dua berkas rahasia **tidak ada di GitHub** dan harus disalin dari mesin lama lewat flashdisk, bukan lewat chat:

| Berkas | Letak di repo | Dipakai oleh |
|---|---|---|
| `.env` | folder utama repo | worker |
| `.env.local` | folder `web/` | web |

Di `.env`, sesuaikan `FRAMES_DIR` dengan drive yang lega di mesin baru (arsip gambar tumbuh ±7,5 GB per hari dan dihapus otomatis setelah `FRAMES_RETENTION_DAYS`).

### 2.3 Worker

```powershell
cd worker
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install --no-deps ultralytics==8.4.175
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m semarsight_worker.main --once --limit 3 --dry-run --verbose
```

`ultralytics` dipasang terpisah dengan `--no-deps` agar tidak menimpa OpenCV versi headless. Perintah terakhir mengambil gambar 3 kamera tanpa menulis apa pun; hasilnya harus berupa tiga baris kamera `live` dan "siklus selesai".

### 2.4 Web

```powershell
cd web
npm install
```

### 2.5 Mesin tidak boleh tidur

Worker berhenti saat mesin tidur. Jalankan sekali **sebagai Administrator**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\jangan-tidur.ps1
```

Pada laptop, pengaturan ini hanya berlaku saat tercolok listrik, dan menutup layar tetap menidurkannya.

## 3. Menjalankan

| Keperluan | Perintah |
|---|---|
| Menyalakan worker (jendela sendiri, menyala ulang otomatis) | `powershell -ExecutionPolicy Bypass -File scripts\windows\mulai-worker.ps1` |
| Memuat ulang worker setelah kodenya berubah | `powershell -ExecutionPolicy Bypass -File scripts\windows\muat-ulang-worker.ps1` |
| Membangun dan menjalankan web di `localhost:3000` | `powershell -ExecutionPolicy Bypass -File scripts\windows\mulai-web.ps1` |
| Web mode pengembangan | `cd web; npm run dev` |

Jendela "SemarSight worker - JANGAN DITUTUP" harus tetap terbuka. Kalau tertutup, worker berhenti; jalankan lagi `mulai-worker.ps1`.

Membangun web memakai banyak CPU dan bisa membuat pengambilan gambar worker kehabisan waktu. `mulai-web.ps1` sudah menunggu sampai worker diam di antara dua siklus; kalau membangun secara manual, lakukan di luar menit ke-0 sampai ke-2 dari tiap siklus.

## 4. Memeriksa keadaan

```powershell
cd worker
.\.venv\Scripts\python.exe scripts\status.py            # detak worker, 20 lokasi air, peringatan, jeda 24 jam
.\.venv\Scripts\python.exe scripts\status.py --hours 48
.\.venv\Scripts\python.exe scripts\probe_camera.py "JRAKAH"   # uji penilaian AI satu kamera, tanpa menulis
.\.venv\Scripts\python.exe scripts\replay_readings.py "Kartini-OUT" --odd   # nilai ulang gambar bukti yang dulu bukan normal
.\.venv\Scripts\python.exe scripts\replay_readings.py --all 3               # semua lokasi, setelah mengubah kalibrasi atau prompt
.\.venv\Scripts\python.exe scripts\probe_insight.py           # uji ringkasan AI atas keadaan sekarang, tanpa menulis
```

Setelah mengganti foto referensi, muat ulang worker (`muat-ulang-worker.ps1`): foto referensi disimpan sementara di memori worker.

- **Log worker:** `FRAMES_DIR\_state\worker.log` (bergulir, 4 berkas × 2 MB). Baris "siklus selesai" muncul tiap 5 menit.
- **"jaringan worker bermasalah"** berarti internet mesin ini putus; kamera tidak dicatat mati.
- **"siklus gagal"** hampir selalu berarti Supabase tidak terjangkau; siklus berikutnya mencoba lagi.
- Di web, lencana header menunjukkan "Sistem aktif" atau "Data tertunda" berdasarkan detak worker.

## 5. Memindahkan worker ke mesin lain

1. **Mesin baru:** selesaikan bagian 2 sampai uji `--dry-run` berhasil.
2. **Mesin lama:** tutup jendela "SemarSight worker", lalu pastikan tidak ada proses Python worker yang tersisa:
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'semarsight_worker' }
   ```
   Hasilnya harus kosong.
3. **Mesin baru:** jalankan `mulai-worker.ps1`, tunggu 2 menit, lalu `scripts\status.py`. "Terakhir terlihat" harus 0–2 menit lalu.
4. Buka web dan pastikan lencana header menunjukkan "Sistem aktif".

Yang ikut pindah dengan sendirinya: semua data (ada di Supabase), termasuk baseline lalu lintas dan riwayat penilaian air, yang dibaca ulang worker saat mulai.

Yang tidak ikut pindah, dan tidak wajib:
- **Arsip gambar** di `FRAMES_DIR` mesin lama. Hanya diperlukan untuk evaluasi dan pelabelan; salin lewat harddisk eksternal bila perlu.
- **Jejak deteksi gambar beku** (`FRAMES_DIR\_state\frame_states.json`). Worker membangunnya lagi dalam 3 siklus.

Efek yang wajar setelah pindah: semua lokasi air dinilai ulang pada siklus pertama, dan grafik menunjukkan jeda selama perpindahan.

## 6. Masalah yang pernah terjadi

| Gejala | Penyebab | Penyelesaian |
|---|---|---|
| Data hilang berjam-jam | Mesin tertidur | `jangan-tidur.ps1`; tetap tercolok; jangan tutup layar laptop |
| Banyak kamera "mati" sekaligus | Internet mesin worker putus | Sudah ditangani penjaga gangguan jaringan; tidak perlu tindakan |
| Belasan kamera "mati" satu siklus lalu pulih | Server sumber menjawab 5XX | Dicatat apa adanya; tidak perlu tindakan |
| Status air naik padahal airnya biasa | Kalibrasi terlalu lebar, busa pompa, atau aspal mengilap | Lihat pelajaran kalibrasi di `13-catatan-keputusan.md`; uji dengan `probe_camera.py` |
| `pip install ultralytics` merusak OpenCV | Menarik `opencv-python` (dengan GUI) | Selalu pasang dengan `--no-deps` |
| Web lokal menampilkan versi lama | Server belum dibangun ulang | `mulai-web.ps1` |
| Banyak "unggah snapshot gagal: [WinError 10035]" di log | Unggahan serentak lewat satu sambungan HTTP/2 | Sudah diperbaiki: klien Supabase worker memakai HTTP/1.1 (`worker/semarsight_worker/db.py`) |
| Jam di log worker satu jam lebih maju dari WIB | Zona waktu PC diatur UTC+8 | Tidak memengaruhi data (worker memakai UTC dan WIB secara eksplisit); `status.py` sudah menampilkan WIB |

## 7. Rahasia

- `SUPABASE_SERVICE_ROLE_KEY` dan `OPENAI_API_KEY` memberi akses penuh; hanya ada di `.env` dan `web/.env.local`, tidak pernah di-commit dan tidak pernah dikirim ke browser.
- Sebelum pengumpulan: ganti kunci rahasia Supabase, ganti `ADMIN_PASSWORD` dengan sandi yang kuat, dan pastikan kunci OpenAI belum kedaluwarsa. Setelah mengganti, perbarui `.env` di **semua** mesin dan variabel lingkungan di Vercel.
- **`.env` di PC adalah acuan**, karena worker membaca dari sana. Perubahan nilai dilakukan di PC lebih dulu, lalu disalin ke laptop.

### Memindahkan berkas rahasia antar mesin tanpa flashdisk

Berkas dikunci dengan sandi lebih dulu, sehingga boleh dikirim lewat jalur apa pun (WhatsApp ke diri sendiri, Google Drive). Sandinya tidak ikut dikirim: dibaca dari layar mesin asal dan diketik di mesin tujuan. Alat penguncinya (`openssl`) ikut terpasang bersama Git for Windows.

```powershell
# Mesin asal: kunci berkas (ganti SANDI dengan sandi acak yang panjang)
& "C:\Program Files\Git\usr\bin\openssl.exe" enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in rahasia.zip -out rahasia.enc -pass pass:SANDI

# Mesin tujuan: buka kuncinya
& "C:\Program Files\Git\usr\bin\openssl.exe" enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in rahasia.enc -out rahasia.zip -pass pass:SANDI
```

Pesan `bad decrypt` berarti sandinya salah ketik. Setelah selesai, hapus berkas `.enc` dari jalur pengiriman dan dari folder unduhan.

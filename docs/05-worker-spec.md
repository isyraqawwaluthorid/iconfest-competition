# 05 — Spesifikasi Worker (Python)

Worker adalah jantung sistem: mengambil frame, menganalisis, menyimpan, dan membuat peringatan. Website hanya membaca hasilnya.

## Dependensi

`worker/requirements.txt` (pakai versi stabil terbaru saat instalasi, lalu kunci versinya):
```
opencv-python-headless
numpy
ultralytics           # YOLO11n (lisensi AGPL-3.0; aman untuk repo publik lomba)
supabase
httpx
pydantic
python-dotenv
apscheduler
pytest
```
Paket sistem: **ffmpeg**.

Dua paket dari rancangan awal tidak dipakai: SSIM dihitung langsung dengan OpenCV (tanpa `scikit-image`), dan OpenAI dipanggil lewat `httpx` ke endpoint Responses (tanpa SDK `openai`), sehingga daftar dependensi tetap pendek.

## Konfigurasi (`config.py`, dari env)

| Nama | Default | Keterangan |
|---|---|---|
| `CYCLE_SECONDS` | 300 | Interval siklus kamera |
| `MAX_CONCURRENCY` | 8 | Batas ambil frame paralel |
| `FRAME_TIMEOUT_SECONDS` | 20 | Timeout ffmpeg per kamera |
| `FRAMES_DIR` | `./frames` | Penyimpanan frame lokal |
| `FRAMES_RETENTION_DAYS` | 14 | |
| `YOLO_MODEL` | `yolo11n.pt` | |
| `YOLO_CONF` | 0.25 | Ambang keyakinan deteksi |
| `WATER_CHANGE_THRESHOLD` | 0.12 | `1 - SSIM` di ROI untuk memicu AI vision (kalibrasi dari data) |
| `WATER_HEARTBEAT_MINUTES` | 30 | Panggilan AI minimum per kamera air |
| `WATER_RAIN_HEARTBEAT_MINUTES` | 10 | Heartbeat saat hujan > `RAIN_TRIGGER_MM` |
| `RAIN_TRIGGER_MM` | 2.0 | Hujan saat ini/1 jam ke depan (mm) |
| `AI_VISION_ENABLED` | true | Matikan untuk menghemat kredit saat pengembangan |
| `AI_DAILY_CALL_CAP` | 3000 | Batas keras panggilan vision per hari |
| `OPENAI_VISION_MODEL` | (wajib diisi) | Model kecil yang mendukung gambar + structured outputs |
| `OPENAI_TEXT_MODEL` | (wajib diisi) | Model untuk insight |
| `WATER_ONLY_FEATURED` | true | Untuk penyisihan, AI vision hanya untuk kamera `is_featured` yang sudah dikalibrasi |

## Struktur modul

```
semarsight_worker/
├── main.py            # entrypoint + APScheduler; flag --once, --only-camera <id>, --limit <n>, --dry-run, --verbose
├── config.py
├── db.py              # client Supabase (service role), helper upsert/insert, unggah Storage
├── storage.py         # arsip frame lokal + encode JPEG untuk snapshot `latest/`
├── models.py          # Pydantic: CameraRow, VisionResult, InsightResult, dst.
├── sources/
│   ├── pantausemar.py # sync_cameras(): parse `var cctvs` per kategori → upsert
│   └── openmeteo.py   # fetch_grid_weather()
├── acquisition.py     # grab_frame(), check_health()
├── quality.py         # assess_quality() → good|fair|poor, is_night
├── analyzers/
│   ├── traffic.py     # YOLO: count_objects(frame, roi) → counts
│   └── water.py       # change_score(), should_call_ai(), classify_with_ai()
├── fusion/
│   ├── smoothing.py   # confirm_water_status() dengan histeresis
│   ├── baseline.py    # hitung baseline, density_index(), is_anomaly()
│   ├── trend.py       # water_trend()
│   ├── risk.py        # risk_score() + komponen
│   ├── upstream.py    # propagasi peringatan hulu → hilir, belajar jeda
│   ├── cross_module.py# genangan/hujan → lalu lintas, hujan → keramaian, sampah + hujan
│   └── events.py      # buka/perbarui/tutup kejadian
├── water_pipeline.py  # alur modul air per siklus: pemicu, panggilan AI, penghalusan
├── prompts/           # prompt AI sebagai berkas teks
├── alerts.py          # upsert/resolve peringatan (satu aktif per jenis+kamera)
├── insights.py        # insight situasi 15 menit + laporan harian (LLM teks)
└── housekeeping.py    # retensi frame, heartbeat worker
```

## Siklus kamera (setiap `CYCLE_SECONDS`)

```python
def run_cycle():
    cams = db.active_cameras()
    weather = db.latest_weather_by_grid()
    results = parallel_map(process_camera, cams, max_workers=MAX_CONCURRENCY)
    upstream.propagate(results)                 # setelah semua kamera air diperbarui
    cross_module.update(results, weather)
    housekeeping.heartbeat(cycle_stats)

def process_camera(cam):
    frame, health, latency = acquisition.grab_frame(cam)   # health: live|frozen|dead
    db.log_health(cam, health, latency)
    if health != "live":
        db.update_status(cam, health=health, consecutive_failures=+1)
        alerts.maybe_camera_offline(cam)       # jika mati > 60 menit
        return
    q = quality.assess(frame)
    path = storage.save_local(cam, frame); storage.upload_latest(cam, frame)
    if {"traffic", "crowd"} & set(cam.modules):
        counts = traffic.count_objects(frame, cam.traffic_roi)
        idx = baseline.density_index(cam, counts, now)
        db.insert_traffic_reading(...); db.update_status(...)
        alerts.maybe_traffic_or_crowd_anomaly(cam, idx)
    if "water" in cam.modules and cam.is_calibrated and (cam.is_featured or not WATER_ONLY_FEATURED):
        score = water.change_score(frame, cam)
        trigger = water.should_call_ai(cam, score, weather[cam.weather_grid_id])
        if trigger:
            result = water.classify_with_ai(frame, cam, q)          # VisionResult (Pydantic)
            db.insert_water_reading(result, trigger, score, path)
            confirmed = smoothing.confirm_water_status(cam, result)
            trend_ = trend.water_trend(cam)
            risk_ = risk.score(cam, confirmed, trend_, upstream_level, weather)
            db.update_status(...); events.update(cam, confirmed); alerts.maybe_water(...)
```

Setiap kamera diproses dalam `try/except` sendiri. Error satu kamera tidak boleh menghentikan siklus. Catat error ke log dan ke `health_checks.error`.

**Gangguan jaringan worker bukan kamera mati.** Kegagalan dibedakan menjadi dua: server CCTV menjawab dengan kode HTTP (mis. 404, stream memang tidak ada) dan tidak ada jawaban sama sekali (koneksi diputus, timeout). Jika kamera tanpa jawaban melebihi 40% dalam satu siklus, penyebabnya hampir pasti jaringan di sisi worker; kegagalan itu tidak ditulis ke `health_checks` maupun `camera_status`, dan jumlahnya dicatat di heartbeat (`unreachable`). Latar belakang: pada 11 Okt worker berjalan lewat hotspot yang memutus koneksi, dan tiga siklus mencatat 71–103 kamera "mati" palsu.

## Akuisisi (`acquisition.py`)

- `ffmpeg -nostdin -loglevel error -rw_timeout 15000000 -user_agent "<UA>" -i URL -frames:v 1 -f image2pipe -vcodec mjpeg -` → baca bytes dari stdout → `cv2.imdecode`. Bungkus `subprocess.run(timeout=FRAME_TIMEOUT_SECONDS)`.
- **Frozen:** hitung sidik 64-bit (BLAKE2b dari frame grayscale 160×90). Jika sidiknya **persis sama** dengan frame sebelumnya selama 3 siklus berturut-turut → `frozen`.
  - Rancangan awal memakai dHash 9×8 dengan jarak Hamming ≤ 2. Pada uji malam 10 Okt, aturan itu menandai 43 dari 146 kamera sebagai beku dalam satu jam, padahal semuanya hidup: adegan diam (rumah pompa, jalan sepi) menghasilkan dHash yang nyaris sama dari siklus ke siklus.
  - Stream yang benar-benar beku mengirim ulang frame yang sama, sehingga hasil decode-nya identik. Kamera hidup selalu berbeda di tingkat piksel karena derau sensor dan jam di pojok gambar. Aturan baru diuji pada 1.848 pasangan frame berurutan dari arsip: 0 positif palsu.
  - Batasan: kamera yang gambarnya macet tetapi tetap di-encode ulang oleh perangkatnya tidak terdeteksi oleh aturan ini.
- **Dead:** ffmpeg gagal atau timeout.
- Jejak dHash per kamera disimpan di `FRAMES_DIR/_state/frame_states.json` agar deteksi beku bertahan saat worker dimulai ulang.
- Simpan frame lokal: `FRAMES_DIR/{camera_id}/{YYYYMMDD}/{HHMMSS}.jpg` (kualitas JPEG 85, nama folder dan file memakai waktu UTC). Frame berstatus `frozen` tetap diarsipkan (tetapi tidak diunggah) supaya ambang deteksi beku bisa dikalibrasi dari data nyata.
- Status dan log kesehatan ditulis **sekali per siklus secara batch** (`health_checks` insert, `camera_status` upsert), bukan satu permintaan per kamera.
- Unggah `latest/{camera_id}.jpg` (lebar maks. 960 px) ke bucket `snapshots` dengan `upsert=True`, lalu isi `camera_status.latest_snapshot_path` dan `latest_snapshot_at`.

## Kualitas (`quality.py`)

- `brightness` = rata-rata kanal V (HSV). `sharpness` = varians Laplacian pada grayscale. `saturation` = rata-rata kanal S. `dark_pct` = proporsi piksel dengan luminans < 25.
- **`is_night` berdasarkan posisi matahari, bukan kecerahan:** ketinggian matahari di Semarang < 0° (rumus pendekatan NOAA; 11 Okt: terbit 05.22, terbenam 17.29 WIB). Kamera memakai auto-exposure, sehingga kecerahan rata-rata frame malam (median 102) hampir sama dengan siang (median 127). Aturan lama `brightness < 70` hanya mengenali 28 dari 139 kamera pada pukul 21–23 WIB.
- `is_ir` (mode inframerah hitam-putih) = saturasi rata-rata < 15.
- `poor` jika sharpness < 30 atau `dark_pct` > 60%; `fair` jika sharpness < 80 atau `dark_pct` > 35% atau `is_ir`; selain itu `good`.
- Kalibrasi 11 Okt pada arsip (139 kamera malam, 137 siang): malam 115 `good`, 23 `fair`, 1 `poor`; siang 136 `good`, 1 `fair`. Ketajaman terendah yang teramati (persentil 5) adalah 441, jauh di atas ambang, jadi ambang ketajaman hanya menangkap gambar yang benar-benar buram.

## Lalu lintas dan keramaian (`analyzers/traffic.py`)

- Muat model sekali (singleton). `model.predict(frame, imgsz=<adaptif>, conf=YOLO_CONF, classes=[0,1,2,3,5,7], verbose=False)`. Inferensi dijalankan bergantian (lock), karena frame diproses dari beberapa thread akuisisi.
- **Ukuran inferensi adaptif:** sisi terpanjang frame dibulatkan ke kelipatan 32, dibatasi 640–1280 px. Pada kamera 1080p ke atas dengan sudut lebar, 640 px melewatkan kira-kira separuh mobil (uji 10 Okt, Simpang Lima 1: 15 mobil di 640 px, 30 di 1280 px; ±30 ms vs ±90 ms per frame di CPU). Kamera resolusi rendah tetap 640 px.
- **Batasan yang diketahui:** sepeda motor kecil dan rapat pada malam hari banyak yang tidak terdeteksi oleh YOLO11n, di ukuran berapa pun. Karena itu angka yang ditampilkan adalah **indeks relatif terhadap baseline kamera itu sendiri**, bukan jumlah kendaraan. Perlu dievaluasi ulang pada siang hari.
- Instalasi: `ultralytics` menarik `opencv-python` (dengan GUI) yang bertabrakan dengan `opencv-python-headless`; `requirements.txt` mengunci versi headless dan `ultralytics` dipasang dengan `--no-deps` (lihat README).
- Jika `traffic_roi` ada, hitung hanya kotak yang titik tengah-bawahnya berada di dalam poligon.
- Untuk `crowd`, metrik utama `persons`; untuk `traffic`, `vehicle_total = cars + motorcycles + buses + trucks`.

### Baseline (`fusion/baseline.py`)
- Job malam (02.00 WIB): untuk setiap kamera dan metrik, hitung median dan p90 per `hour_of_week` dari 28 hari terakhir dengan `n ≥ 3`.
- `density_index = value / max(median, 1)`. Jika baseline belum ada: median 24 jam bergulir, set `baseline_is_provisional = true`.
- Baseline sementara disimpan di memori worker (`RollingHistory`) dan diisi ulang dari `traffic_readings` 24 jam terakhir saat worker dimulai. Indeks baru dihitung setelah ada ≥ 12 pembacaan (±1 jam); sebelum itu `density_level = tidak_diketahui`.
- **Anomali tidak dinilai selama baseline masih sementara.** Median 24 jam mencampur siang dan malam, sehingga jam sibuk harian akan selalu tampak tidak normal. Anomali aktif setelah baseline per jam-dalam-minggu tersedia.
- Metrik utama per kamera: `vehicle_total` jika kamera punya modul `traffic`, selain itu `persons` (modul `crowd`).
- Level: `lancar` < 0,8 ≤ `normal` < 1,3 ≤ `ramai` < 1,8 ≤ `padat`.
- Anomali: nilai > p90 **dan** index ≥ 1,5 selama 2 siklus berturut-turut.
- Pembacaan malam hari dengan kualitas `poor` tidak dipakai untuk baseline maupun anomali.

## Air (`analyzers/water.py`)

### Kalibrasi (prasyarat)
Kamera air baru diproses jika `roi` terisi. Kalibrasi dilakukan di halaman admin (lihat `06-web-spec.md`).

### Deteksi perubahan
- **Area pengamatan** = selubung cembung dari titik area air dan titik semua garis acuan. Garis acuan sering digambar di dinding tepat di luar area air, dan dinding itulah tempat air naik.
- Potong ke kotak pembatas area pengamatan (bagian di luar poligon tidak ikut dihitung), resize ke 256 px lebar, grayscale.
- `change = 1 - SSIM(area sekarang, area saat AI terakhir dipanggil)`.
- **Ambang perubahan per kamera:** `max(WATER_CHANGE_THRESHOLD, 2 × median skor terakhir kamera itu)`, dan baru berlaku setelah ada 6 skor. Uji 11 Okt pada 16 kamera unggulan: riak air dan bayangan membuat median skor berkisar 0,04 sampai 0,29, sehingga ambang tunggal 0,12 akan memanggil AI pada 57% siklus.
- `should_call_ai` mengembalikan trigger pertama yang terpenuhi:
  1. `change` jika skor perubahan ≥ ambang kamera itu
  2. `rain` jika hujan grid > `RAIN_TRIGGER_MM` dan sudah ≥ `WATER_RAIN_HEARTBEAT_MINUTES` sejak panggilan terakhir
  3. `heartbeat` jika sudah ≥ `WATER_HEARTBEAT_MINUTES`
- Hormati `AI_DAILY_CALL_CAP` (hitung dari `water_readings` hari ini).

### Klasifikasi AI vision
- Gambar 1: area pengamatan saat ini dengan **garis acuan digambar di atasnya** (semi-transparan agar tepi air tetap terlihat; label N, W, S, A digeser supaya tidak bertumpuk), lebar 512 px, JPEG kualitas 80.
- Gambar 2: foto referensi kondisi normal dengan garis yang sama.
- Teks: kartu kamera (`water_kind`, `calibration_notes`, nama sungai) dan kualitas gambar.
- Panggil OpenAI dengan **structured outputs (JSON schema)** sesuai `07-ai-prompts.md`. Validasi dengan Pydantic. Gagal/timeout → simpan `status = tidak_dapat_dinilai`, jangan ulangi lebih dari 1 kali.
- Simpan `raw` JSON (jawaban dan pemakaian token) serta nama model.
- Foto referensi dipilih sesuai waktu (siang atau malam) dan jatuh ke yang satunya bila belum ada.
- Alur per siklus ada di `water_pipeline.py`: `observe` di thread tiap kamera, `commit` sekali per siklus.
- Uji 11 Okt (siang, 16 kamera unggulan): seluruhnya dinilai `normal` dengan keyakinan 0,68–0,91, ±1.400 token masuk dan ±300 token keluar per panggilan, atau ±$0,0003 per panggilan dengan `gpt-6-luna`.

### Penghalusan (`fusion/smoothing.py`)
Urutan level: normal(0) < waspada(1) < siaga(2) < awas(3).
- Abaikan pembacaan dengan `confidence < 0.5` atau kualitas `poor` → set `needs_verification = true`, status terkonfirmasi tidak berubah.
- Abaikan juga pembacaan yang bertentangan dengan dirinya sendiri: status di atas normal tetapi air dinilai sama atau lebih rendah dari foto referensi. Pada uji pertama, dua kamera dengan garis acuan yang sangat rapat sempat dinilai waspada dan siaga padahal kondisinya sama dengan referensi.
- Status pertama: satu pembacaan `normal` cukup; status di atas normal tetap butuh dua pembacaan.
- **Naik:** jika 2 pembacaan valid terakhir ≥ level baru → konfirmasi level terendah dari keduanya.
- **Turun:** jika 3 pembacaan valid terakhir < level sekarang → turunkan ke level tertinggi dari ketiganya.
- Kamera `water_kind = jalan` memakai `road_flood` dengan aturan sama (tidak_tergenang < ringan < sedang < tinggi). Pemetaan ke status umum: ringan → waspada, sedang → siaga, tinggi → awas.

### Tren (`fusion/trend.py`)
Bandingkan level terkonfirmasi sekarang dengan 30 dan 60 menit lalu: naik ≥ 2 level dalam 60 menit atau ≥ 1 level dalam 30 menit → `naik_cepat`; naik ≥ 1 level dalam 60 menit → `naik`; turun → `turun`; selain itu `stabil`.

Level pembanding diambil dari pembacaan AI valid terakhir pada atau sebelum titik waktu itu, asal umurnya tidak lebih dari 45 menit dari titik tersebut. Jika tidak ada pembanding sama sekali, tren adalah `tidak_diketahui`.

### Risiko (`fusion/risk.py`)
Lihat rumus di `02-architecture.md`. Simpan komponen dan bobot di `camera_status.risk_components` agar bisa ditampilkan: nilai tiap komponen, `weights`, dan `inputs` (status, tren, status hulu, mm hujan 3 jam ke depan).

- Batas level: skor < 0,30 `rendah`; < 0,55 `sedang`; < 0,75 `tinggi`; selebihnya `sangat_tinggi`. Lokasi yang status airnya belum terkonfirmasi tidak diberi skor.
- Tren dan risiko dihitung ulang **setiap siklus** untuk kamera air yang hidup, bukan hanya saat AI dipanggil, karena keduanya bergantung pada waktu dan prakiraan hujan. Riwayat level disimpan di memori worker, jadi penghitungan ulang ini tidak menambah panggilan AI maupun kueri database.
- Komponen hulu bernilai 0 sampai `river_links` diisi.

### Hulu → hilir (`fusion/upstream.py`)
- Untuk setiap `river_links`: jika status hulu ≥ waspada dan naik, buat/perbarui peringatan `upstream_warning` pada kamera hilir: "Hulu {nama} {status}; perkiraan dampak di {hilir} dalam {lag} menit". `lag = learned_lag_minutes ?? default_lag_minutes`.
- **Belajar jeda:** setelah kejadian di hilir dimulai, cari waktu kenaikan hulu terakhir sebelumnya (maks. 6 jam). Perbarui `learned_lag_minutes` sebagai median jeda dari semua kejadian; naikkan `learned_from_events`.

## Lintas modul (`fusion/cross_module.py`)

1. **Genangan → lalu lintas**
   - Kamera dengan modul `water` **dan** `traffic` sekaligus (13 kamera di seed; 12 di antaranya berkategori genangan): bandingkan `density_index` saat `road_flood ≥ ringan` dengan baseline jam yang sama.
   - Kamera lalu lintas dalam radius 1 km dari kamera genangan (haversine): rata-rata `density_index` selama kejadian vs baseline.
   - Simpan di `events.traffic_impact` dan kirim sebagai fakta ke insight.
2. **Hujan → keramaian ruang publik:** rata-rata index `persons` kamera `crowd` saat hujan > 1 mm/jam vs tidak hujan, per jam yang sama.
3. **Sampah + hujan:** jika `trash = banyak` di kamera pompa/sungai dan prakiraan hujan 3 jam ≥ 10 mm → peringatan `trash_blockage` level siaga untuk audiens PU.

## Cuaca (`sources/openmeteo.py`)
Setiap 30 menit: untuk tiap titik di `weather_grid`, ambil data Open-Meteo (lihat `03-data-sources.md`), hitung `precip_now_mm`, `next_1h/3h/6h`, `prob_max_3h`, simpan. Hujan ≥ 10 mm dalam 3 jam ke depan → peringatan `heavy_rain` (info/waspada).

- Kesembilan titik diambil dalam **satu permintaan** (lintang dan bujur dipisah koma), dengan `timeformat=unixtime` agar tidak ada tafsir zona waktu. Dijalankan juga sekali saat worker mulai.
- "N jam ke depan" = jumlah N slot per jam pertama yang waktunya setelah saat ini. Potongan 12 jam ke depan disimpan di kolom `hourly`.
- Hasil terbaru disimpan di memori dan dipakai modul air: pemicu hujan memakai nilai terbesar antara hujan saat ini dan 1 jam ke depan di titik grid kamera (`cameras.weather_grid_id`); skor risiko memakai prakiraan 3 jam.
- Jika Open-Meteo gagal dijawab, worker tetap berjalan dengan data cuaca terakhir.

## Insight (`insights.py`)
- **Situasi (15 menit):** kumpulkan fakta ringkas (kamera dengan status ≥ waspada, tren naik, peringatan aktif, anomali lalu lintas, hujan per grid, kamera mati). Jika tidak ada perubahan berarti dari insight terakhir, jangan panggil LLM (hemat).
- **Harian (06.00 WIB):** kejadian 24 jam, durasi surut, titik paling rawan, anomali, ketersediaan kamera.
- **Lintas modul:** dipanggil saat kejadian selesai dan `traffic_impact` tersedia.
- Prompt dan schema: `07-ai-prompts.md`. Simpan `facts` yang dikirim bersama output.

## Peringatan (`alerts.py`)
- `upsert_alert(type, camera_id, level, title, message, audience, data)`: jika ada yang aktif untuk (type, camera) → perbarui; jika tidak → buat.
- `resolve_alert(type, camera_id)`: set `is_active=false`, `resolved_at=now()`.
- Teks peringatan dibuat dari **template** (bukan LLM) agar cepat dan konsisten. LLM dipakai untuk ringkasan di level insight.

## Housekeeping
- Heartbeat: upsert `system_status` key `worker` dengan `last_seen`, durasi siklus, jumlah kamera live/frozen/dead, panggilan AI hari ini.
- Retensi frame lokal: hapus folder > `FRAMES_RETENTION_DAYS`, kecuali file yang direferensikan `labels` atau `events`.

## Skrip
- `scripts/seed_cameras.py <json>`: upsert dari `data/cameras_semarang.json` (alternatif: jalankan `supabase/seed_cameras.sql`).
- `scripts/sync_cameras.py`: jalankan `pantausemar.sync_cameras()` manual.
- `scripts/backfill_baselines.py`: hitung baseline dari data yang ada.
- `scripts/make_synthetic.py`: data sintetis (`source='synthetic'`) untuk pengembangan UI.
- `scripts/export_eval_sample.py`: pilih sampel acak bertingkat (siang/malam, per kamera) untuk dilabeli.

## Pengujian
- Unit test: `quality.assess`, dHash/frozen, `smoothing.confirm_water_status` (kasus naik, turun, keyakinan rendah), `baseline.density_index`, `risk.score`, parser `var cctvs`, validasi Pydantic output AI.
- Uji integrasi: `python -m semarsight_worker.main --once --only-camera <id>` terhadap kamera nyata.
- `--dry-run`: tidak menulis ke database, Storage, maupun disk, dan tidak memanggil AI (cetak hasil ke log; pakai bersama `--verbose` untuk hasil per kamera).
- `--limit <n>`: batasi ke n kamera pertama, untuk uji cepat.
- Catatan kunci Supabase format baru (`sb_secret_...`): server menolaknya jika `User-Agent` mirip browser, jadi `HTTP_USER_AGENT` hanya dipakai untuk ffmpeg ke PANTAUSEMAR, tidak untuk client Supabase.

## Deployment
- **Pengembangan:** laptop, `python -m semarsight_worker.main`. Mulai **secepatnya** agar data historis terkumpul.
- **Produksi:** VPS kecil (Ubuntu, 2 vCPU, 2–4 GB RAM cukup untuk YOLO11n di CPU). Jalankan dengan systemd (`Restart=always`) atau Docker Compose. Contoh unit:
  ```ini
  [Unit]
  Description=SemarSight worker
  After=network-online.target

  [Service]
  WorkingDirectory=/opt/semarsight/worker
  EnvironmentFile=/opt/semarsight/.env
  ExecStart=/opt/semarsight/worker/.venv/bin/python -m semarsight_worker.main
  Restart=always
  RestartSec=10

  [Install]
  WantedBy=multi-user.target
  ```
- Log ke stdout (journald). Tambahkan ringkasan per siklus: jumlah live/frozen/dead, panggilan AI, durasi.

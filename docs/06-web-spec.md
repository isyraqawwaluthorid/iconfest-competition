# 06 — Spesifikasi Web (Next.js)

## Stack dan konvensi

- Next.js App Router + TypeScript (strict) + Tailwind CSS.
- Data: `@supabase/supabase-js`. Dua client:
  - `lib/supabase/browser.ts`: anon key, read-only, untuk Realtime dan query publik.
  - `lib/supabase/server.ts`: service role, **hanya** di route handler/server action (`import "server-only"`).
- Peta: `react-leaflet` + tile OpenStreetMap (atribusi wajib). Komponen peta di-*dynamic import* dengan `ssr: false`.
- Grafik: Recharts. Validasi: Zod. Tanggal: tampilkan dalam `Asia/Jakarta` (WIB).
- Video live (opsional): `hls.js` langsung ke URL stream (CORS PANTAUSEMAR terbuka). Default yang ditampilkan adalah **snapshot**, bukan video.
- Semua teks UI dalam Bahasa Indonesia. Simpan label status dan warna di satu file (`lib/status.ts`) agar konsisten.

## Halaman publik

| Rute | Nama | Isi utama |
|---|---|---|
| `/` | **Denyut Kota** | Ringkasan kondisi saat ini: kartu angka (kamera live, status air ≥ waspada, titik padat, hujan), insight AI terbaru, peringatan aktif, peta mini |
| `/peta` | Peta | Peta penuh semua kamera; filter modul (Air / Lalu Lintas / Ruang Publik / Kesehatan Kamera); klik marker → panel kamera |
| `/air` | Air & Genangan | Daftar kamera air diurutkan risiko; **diagram hulu → hilir** per sistem sungai; hujan per grid; kejadian aktif |
| `/lalu-lintas` | Lalu Lintas | Peta kepadatan; daftar anomali; grafik tren per kamera (hari ini vs baseline) |
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

Middleware sederhana: cookie sesi setelah memasukkan password di `/admin/login`. Semua aksi tulis lewat route handler dengan service role.

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
│   ├── supabase/{browser,server}.ts
│   ├── status.ts              # label, urutan, token warna per status
│   ├── time.ts                # format WIB, "x menit lalu"
│   ├── queries.ts             # semua query baca
│   └── types.ts               # tipe hasil query (atau generate dari Supabase)
└── ...
```

## Desain placeholder

Desainer sedang menyiapkan UI final. Untuk sekarang:

1. **Semua warna, radius, spasi, dan font lewat CSS variables** di `globals.css`, dipetakan ke Tailwind (`theme.extend.colors` memakai `var(--...)`). Komponen tidak boleh memakai kode warna langsung. Desainer nanti cukup mengganti token.
   ```css
   :root {
     --bg: #f7f7f8; --surface: #ffffff; --text: #18181b; --muted: #71717a; --border: #e4e4e7;
     --primary: #2563eb;
     --status-normal: #16a34a; --status-waspada: #ca8a04; --status-siaga: #ea580c; --status-awas: #dc2626;
     --status-unknown: #a1a1aa; --status-offline: #52525b;
     --radius: 8px; --font-sans: system-ui, sans-serif;
   }
   @media (prefers-color-scheme: dark) { :root { --bg: #0b0b0c; --surface: #18181b; --text: #f4f4f5; --muted: #a1a1aa; --border: #27272a; } }
   ```
2. **Komponen UI primitif sederhana** di `components/ui/`, tanpa library desain berat. Desainer nanti mengganti isi komponen ini tanpa menyentuh halaman.
3. **Status tidak boleh hanya dibedakan warna:** selalu ada label teks (dan ikon jika ada). Penting untuk keterbacaan orang awam (rubrik UI/UX).
4. **Mobile-first:** semua halaman bisa dipakai di layar 360 px; peta dan panel kamera berganti menjadi tampilan bertumpuk.
5. **Setiap komponen data wajib punya empat keadaan:** memuat (skeleton), kosong (penjelasan + kenapa), error (pesan + coba lagi), dan data usang/offline (penanda kesegaran).

## Kriteria penerimaan web untuk penyisihan

- Halaman `/`, `/peta`, `/air`, `/lalu-lintas`, `/kamera/[id]`, `/riwayat` berfungsi dengan data nyata.
- Status kamera berubah di browser tanpa refresh saat worker memperbarui `camera_status`.
- Mematikan worker → banner muncul dalam 15 menit; halaman tetap menampilkan data terakhir.
- Kamera mati tampil sebagai "Offline sejak HH:MM" dengan snapshot terakhir.
- `npm run build` sukses tanpa error; deploy Vercel berjalan; tidak ada secret di bundle client (cek `NEXT_PUBLIC_` hanya untuk URL dan anon key).

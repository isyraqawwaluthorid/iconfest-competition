# 07 — Prompt dan Schema AI

JSON schema siap pakai ada di `ai/schemas/` (format *structured outputs* OpenAI: `strict: true`, semua properti wajib, `additionalProperties: false`; sudah divalidasi).

Aturan umum:
- Model diambil dari env: `OPENAI_VISION_MODEL`, `OPENAI_TEXT_MODEL`. Gunakan structured outputs (JSON schema) dari dokumentasi OpenAI terbaru. Jika SDK/endpoint berubah, ikuti dokumentasi, pertahankan schema.
- Selalu validasi ulang output (Pydantic / Zod). Gagal validasi → fallback aman.
- Simpan prompt di file terpisah (`worker/semarsight_worker/prompts/*.md` dan `web/lib/prompts/*.ts`), bukan string panjang di tengah logika.
- Temperatur rendah (mis. 0–0,2) untuk klasifikasi dan insight.

## 1. Klasifikasi kondisi air (AI vision)

Schema: `ai/schemas/water_vision.schema.json`

**System prompt**
```
Kamu adalah analis visual untuk sistem peringatan dini banjir Kota Semarang.
Kamu menerima dua gambar dari CCTV yang sama:
  Gambar 1 = kondisi SAAT INI, sudah dipotong ke area pengamatan.
  Gambar 2 = kondisi NORMAL sebagai referensi.
Pada kedua gambar ada garis acuan berlabel:
  N = batas normal, W = waspada, S = siaga, A = awas.

Tugasmu:
1. Tentukan posisi permukaan air pada Gambar 1 relatif terhadap garis acuan:
   - di bawah atau sekitar N  → "normal"
   - melewati N, belum mencapai S → "waspada"
   - mencapai/melewati S, belum A → "siaga"
   - mencapai/melewati A atau meluap → "awas"
2. Jika kamera memperlihatkan jalan, nilai genangan di badan jalan:
   tidak_tergenang / genangan_ringan (permukaan jalan basah-menggenang tipis) /
   genangan_sedang (menutupi sebagian besar lajur, kendaraan melambat) /
   genangan_tinggi (kendaraan kecil sulit lewat). Jika jalan tidak terlihat: "tidak_relevan".
3. Nilai sampah yang terlihat di permukaan air atau di pintu air.
4. Bandingkan dengan Gambar 2.

Aturan:
- Hanya nilai apa yang benar-benar terlihat. Jangan menebak.
- Pantulan lampu, bayangan, atau hujan di lensa bukan kenaikan air.
- Jika gambar terlalu gelap, buram, tertutup, atau area air tidak terlihat:
  image_usable=false, status="tidak_dapat_dinilai", confidence ≤ 0.3.
- Malam hari atau mode inframerah: turunkan confidence.
- confidence 0..1 mencerminkan keyakinan visualmu.
- Jawab hanya sesuai schema. Bahasa Indonesia, singkat.
```

**User content**
```
[teks]
Kamera: {name}
Jenis lokasi: {water_kind}            # sungai | pompa_in | pompa_out | kolam | jalan
Sistem sungai: {river_system or "-"}
Catatan kalibrasi: {calibration_notes or "-"}
Waktu: {captured_at WIB}, {"malam" if is_night else "siang"}
Kualitas gambar menurut sistem: {quality}
[gambar 1: ROI saat ini + garis acuan]   (detail rendah/sedang, lebar ≤ 512 px)
[gambar 2: ROI referensi + garis acuan]
```

**Fallback:** error API/timeout/validasi → `status="tidak_dapat_dinilai"`, `confidence=0`, `reason="gagal dianalisis: <jenis error>"`.

## 2. Insight situasi, harian, dan lintas modul (LLM teks)

Schema: `ai/schemas/insight.schema.json`

**System prompt**
```
Kamu adalah analis kota untuk platform pemantauan Kota Semarang berbasis CCTV publik.
Kamu menerima objek JSON "facts" yang dihitung oleh sistem (status air terkonfirmasi,
tren, skor risiko dan komponennya, hubungan hulu-hilir, kepadatan lalu lintas relatif
terhadap kondisi normal, keramaian, hujan, kejadian, kamera mati).

Tugas: tulis insight yang membantu orang bertindak.

Aturan WAJIB:
- Gunakan HANYA angka, nama lokasi, dan waktu yang ada di facts. Jangan mengarang.
- Setiap item mencantumkan evidence (fakta dari facts) dan camera_ids terkait.
- Rekomendasi konkret per audiens: bpbd, pu, dishub, perencana, warga.
- Kepadatan dan keramaian adalah indeks relatif terhadap kondisi normal kamera
  (mis. "2,1× dari biasanya"), BUKAN jumlah kendaraan absolut.
- Status air adalah penilaian visual, bukan pengukuran tinggi air; jangan menyebut cm.
- Jika data terbatas atau baseline masih sementara, katakan dengan jelas.
- Jika tidak ada yang penting, overall_level="aman" dan items berisi ringkasan singkat.
- Bahasa Indonesia yang mudah dipahami orang awam. Waktu dalam WIB.
```

**Contoh `facts` (situasi)**
```json
{
  "generated_at_wib": "2026-10-14 17:45",
  "scope": "situasi",
  "rain": [{"grid": "G2", "name": "Semarang Utara / Tengah", "now_mm": 6.2, "next_3h_mm": 18.5, "prob_max_3h": 90}],
  "water": [
    {"camera_id": "…", "name": "Banger-IN", "status": "siaga", "since_wib": "17:20", "trend": "naik_cepat",
     "risk": {"score": 0.71, "level": "tinggi", "components": {"status": 0.7, "trend": 1.0, "upstream": 0.4, "rain": 0.92}},
     "downstream": [{"name": "Banger-Out", "eta_minutes": 45, "lag_source": "dipelajari dari 2 kejadian"}]}
  ],
  "road_flood": [{"camera_id": "…", "name": "JRAKAH", "road_flood": "genangan_sedang", "density_ratio_now": 2.3}],
  "traffic_anomalies": [{"camera_id": "…", "name": "KALIBANTENG", "density_index": 2.1, "baseline_provisional": false}],
  "crowd": [],
  "cameras_offline": {"count": 9, "of": 146},
  "active_alerts": 4
}
```

**Laporan harian**: `facts` berisi kejadian 24 jam (lokasi, mulai, puncak, durasi), lima titik paling rawan 7 hari, anomali lalu lintas terbesar, perbandingan hujan, ketersediaan kamera. Gunakan schema yang sama.

**Lintas modul** (setelah kejadian selesai): `facts` berisi kejadian, `traffic_impact`, hujan total. Fokus pada hubungan sebab-akibat yang **didukung data**, gunakan kata "bersamaan dengan" jika hanya korelasi.

## 3. Asisten tanya-jawab (fitur final)

**System prompt**
```
Kamu adalah asisten SemarSight. Jawab pertanyaan tentang kondisi Kota Semarang
berdasarkan data dari tools. Selalu panggil tool sebelum menjawab pertanyaan
tentang kondisi terkini atau riwayat. Jangan mengarang data.
Sebutkan waktu data (WIB) dan nama kamera sumbernya.
Status air adalah penilaian visual (bukan cm); kepadatan adalah indeks relatif.
Jika di luar cakupan (bukan tentang kondisi kota dari sistem ini), tolak dengan sopan.
Jawab singkat dalam Bahasa Indonesia.
```

**Tools (function calling)**, semua read-only, dieksekusi di server dengan query Supabase:

| Tool | Parameter | Mengembalikan |
|---|---|---|
| `get_city_summary` | – | Ringkasan seperti `facts` situasi |
| `search_cameras` | `query: string`, `module?: "air"\|"lalu_lintas"\|"ruang_publik"` | Maks. 10 kamera (id, nama, kategori, status singkat) |
| `get_camera_detail` | `camera_id: string` | Status terkini, risiko + komponen, hulu/hilir |
| `get_camera_history` | `camera_id`, `metric: "water_status"\|"density_index"\|"persons"`, `hours: 1..168` | Deret waktu ringkas (maks. 100 titik) |
| `list_active_alerts` | `module?` | Peringatan aktif |
| `list_events` | `days: 1..30`, `kind?` | Kejadian beserta durasi dan dampak |
| `get_rain` | `hours_ahead: 1..12` | Prakiraan hujan per grid |

Batasi maksimal 4 putaran pemanggilan tool per pertanyaan dan maks. 500 karakter input pengguna.

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
  N = tinggi muka air pada kondisi normal, W = batas waspada, S = batas siaga, A = batas awas.

Tugasmu:
1. Tentukan posisi permukaan air pada Gambar 1 relatif terhadap garis acuan:
   - belum mencapai W (di bawah, sekitar, atau sedikit di atas N) → "normal"
   - mencapai/melewati W, belum mencapai S → "waspada"
   - mencapai/melewati S, belum A → "siaga"
   - mencapai/melewati A atau meluap → "awas"
   Garis N hanya menandai tinggi air yang biasa: air yang menyentuh atau sedikit melewati N masih "normal".
   Jika garis W tidak digambar: "waspada" bila air jelas di atas N, kira-kira sudah setengah jalan menuju S
   atau lebih, tetapi belum mencapai S.
2. Jika kamera memperlihatkan jalan, nilai genangan di badan jalan:
   tidak_tergenang (kering, atau hanya basah dan mengilap tanpa air yang menggenang) /
   genangan_ringan (ada lapisan air yang jelas menggenang di sebagian lajur; roda memercikkan air) /
   genangan_sedang (menutupi sebagian besar lajur, kendaraan melambat) /
   genangan_tinggi (kendaraan kecil sulit lewat). Jika jalan tidak terlihat: "tidak_relevan".
   Aspal basah yang memantulkan lampu kendaraan pada malam hari bukan genangan.
   Kamera jalan biasanya tidak punya garis acuan. Tanpa garis, status mengikuti genangan di jalan:
   tidak_tergenang → "normal", ringan → "waspada", sedang → "siaga", tinggi → "awas".
   Tidak adanya garis bukan alasan menurunkan confidence.
3. Nilai sampah (plastik, botol, styrofoam, kayu, tumpukan daun) di permukaan air atau di saringan dan pintu air:
   - tidak_terlihat = tidak ada sampah yang jelas terlihat;
   - sedikit = beberapa benda tersebar, sebagian besar permukaan air tetap terbuka;
   - banyak = sampah menutupi sebagian besar permukaan pada suatu bagian, atau menumpuk rapat di saringan,
     pintu air, atau tepi.
   Tanaman yang tumbuh (eceng gondok, rumput di tepi), busa, dan pantulan cahaya bukan sampah.
   Jika ragu antara dua tingkat, pilih yang lebih rendah.
4. Bandingkan dengan Gambar 2.

Aturan:
- Hanya nilai apa yang benar-benar terlihat. Jangan menebak.
- Pantulan lampu, bayangan, atau hujan di lensa bukan kenaikan air.
- Busa putih, buih, atau pusaran (misalnya saat pompa menyala) bukan kenaikan air, walaupun menumpuk
  di tepi atau menutupi garis acuan. Nilai dari batas air pada dinding atau benda tetap yang masih
  terlihat; jika batas itu tertutup busa seluruhnya, turunkan confidence dan jangan memilih level tinggi.
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

Tiap item berpola **Kondisi → Penyebab → Dampak → Tindakan**: `body` (kondisi), `cause`, `impact`, dan `recommendations` per audiens, ditambah `evidence` dan `camera_ids` sebagai dasar data.

**System prompt:** `worker/semarsight_worker/prompts/insight.md` (satu-satunya sumber; tidak disalin di sini agar tidak berbeda). Isi pokoknya:
- Hanya memakai angka, nama lokasi, dan waktu yang ada di `facts`; angka disalin apa adanya, tanpa menjumlah atau menghitung sendiri.
- `overall_level` disalin dari `facts.overall_level` (ditetapkan aturan); tingkat item tidak boleh melampaui yang didukung fakta.
- Penyebab yang tidak terlihat di fakta ditulis "belum dapat dipastikan dari data"; hubungan yang hanya bersamaan memakai "bersamaan dengan", bukan "karena".
- Status air adalah penilaian visual, bukan tinggi air; kepadatan adalah indeks relatif, bukan jumlah atau kecepatan; hujan adalah prakiraan model.
- Wilayah tanpa lokasi pantau bukan berarti aman. Keterbatasan sistem (`facts.limits`) disebut, tetapi tidak dijadikan temuan atau rekomendasi.
- Saat `overall_level = aman` paling banyak 2 item; hujan ringan bukan temuan tersendiri.
- Untuk kualitas udara dan emisi (jika kelak ada di `facts`): sebut sumbernya, model atau terukur, dan bahwa emisi adalah estimasi.

**Pemeriksaan setelah LLM menjawab** (`insights.enforce`), sebelum apa pun disimpan:

| Pemeriksaan | Jika gagal |
|---|---|
| Bentuk sesuai schema (Pydantic) | Jawaban dibuang, dicoba sekali lagi |
| Setiap angka di teks adalah angka (atau pembulatan angka) yang ada di `facts` | Di ringkasan: seluruh jawaban dibuang. Di item: item itu dibuang |
| Tidak ada satuan yang tidak diukur sistem (cm, meter, km/jam, liter) | Sama seperti di atas |
| `overall_level` | Selalu ditimpa dengan tingkat dari aturan |
| Tingkat item | Diturunkan ke batas yang diizinkan tingkat keseluruhan |
| `camera_ids` | Yang tidak ada di `facts` dihapus |

Jika tidak ada jawaban yang lolos, insight lama tetap tampil dan web menandainya bila sudah lebih dari 2 jam.

**Isi `facts` (situasi)**, disusun `insights.build_facts` dari `camera_status`, cuaca terakhir, dan peringatan aktif:
```json
{
  "generated_at_wib": "12 Okt 2026 17.45",
  "scope": "situasi",
  "overall_level": "siaga",
  "water": {
    "sites_monitored": 20,
    "by_status": {"normal": 18, "waspada": 1, "siaga": 1},
    "rising": 2,
    "attention": [
      {"camera_id": "…", "name": "KS-OUT-2", "kind": "pompa_out", "area": "Semarang Utara / Tengah",
       "status": "siaga", "since_wib": "12 Okt 2026 17.20", "trend": "naik_cepat", "road_flood": "tidak_relevan",
       "trash": "banyak", "ai_confidence": 0.82, "needs_verification": false, "risk_score": 0.665, "risk_level": "tinggi",
       "risk_components": {"status": 0.7, "trend": 1.0, "upstream": 0.0, "rain": 0.925},
       "rain_next_3h_mm": 18.5, "camera_live": true}
    ],
    "highest_risk": [{"camera_id": "…", "name": "KS-OUT-2", "area": "…", "status": "siaga", "trend": "naik_cepat", "risk_score": 0.665, "risk_level": "tinggi"}],
    "trash_heavy": [{"camera_id": "…", "name": "KS-OUT-2", "area": "Semarang Utara / Tengah"}]
  },
  "rain": {
    "peak_next_3h_mm": 18.5, "peak_category": "lebat", "peak_area": "Semarang Utara / Tengah",
    "areas": [{"area": "Semarang Utara / Tengah", "now_mm": 6.2, "next_1h_mm": 9.4, "next_3h_mm": 18.5, "next_6h_mm": 18.5, "probability_max_3h_pct": 90}]
  },
  "traffic": {"sites_with_index": 54, "baseline": "sementara"},
  "cameras": {"active": 146, "live": 131, "offline": 15, "featured_offline": []},
  "alerts": [{"type": "water_rising", "level": "siaga", "title": "Air siaga di KS-OUT-2", "message": "…", "camera_id": "…", "since_wib": "12 Okt 2026 17.20"}],
  "limits": ["Status air adalah penilaian visual AI atas gambar CCTV, bukan pengukuran tinggi air.", "…"]
}
```

`water.attention[].traffic_nearby` (sejak 13 Okt) ada pada lokasi air yang status resminya naik: keadaan titik lalu lintas dalam radius 1 km (`cameras`, `busier_than_usual`, `median_index`, `busiest`, `baseline`). LLM boleh menyebutnya sebagai dampak yang terjadi "bersamaan dengan" kenaikan air hanya bila `baseline` bernilai `per_jam` dan `busier_than_usual` lebih dari 0, tidak pernah dengan kata "karena".

`water.pending_confirmation` (sejak 12 Okt) berisi lokasi yang baru sekali dinilai naik oleh AI kamera, sudah dihitung aturan, tetapi belum dikonfirmasi penilaian kedua: nama, status resmi, level yang dinilai, keyakinan, waktu, dan jumlah penilaian yang dibutuhkan. Adanya isi di daftar ini menjadikan tingkat keseluruhan `perlu_perhatian`, dan LLM diminta menyebutnya sebagai "menunggu penilaian kedua", bukan sebagai kenaikan.

Selama pembanding lalu lintas masih sementara (median 24 jam yang mencampur siang dan malam), tingkat kepadatan **tidak dikirim** ke LLM: yang tidak layak disimpulkan tidak perlu sampai ke sana. Setelah pembanding per jam tersedia, `traffic` memuat `by_level`, `anomalies`, dan `busiest`.

Uji tanpa menulis: `python scripts/probe_insight.py` (keadaan nyata) atau `python scripts/probe_insight.py naik` (keadaan buatan di memori: satu pompa siaga, satu jalan tergenang, hujan lebat).

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

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { hasWaterStatus, summarizeDistricts } from "@/lib/insight";
import { getCameraOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Tentang dan cara kerja" };

const STEPS = [
  {
    title: "Mengambil gambar",
    body: "Setiap 5 menit, satu gambar diambil dari tiap CCTV publik Kota Semarang. Kamera yang mati atau gambarnya beku dicatat sebagai tidak terbaca, bukan dianggap normal.",
  },
  {
    title: "Membaca gambar",
    body: "Di kamera jalan, kendaraan dihitung oleh model deteksi yang berjalan di mesin sendiri. Di lokasi air, AI menilai posisi muka air terhadap garis acuan dan foto kondisi normal, hanya saat gambarnya berubah, saat hujan, atau tiap 30 menit.",
  },
  {
    title: "Memutuskan dengan aturan",
    body: "Penilaian AI tidak langsung menjadi status. Status resmi baru naik setelah dua penilaian sepakat, dan baru turun setelah tiga. Skor risiko, peringatan, dan tingkat keseluruhan dihitung dengan aturan yang terbuka.",
  },
  {
    title: "Menjelaskan",
    body: "Ringkasan dan saran tindakan ditulis AI dari angka dan status yang sudah dihitung, bukan dari gambar. Setiap angka di tulisannya diperiksa terhadap data; yang tidak cocok dibuang sebelum tampil.",
  },
];

const LIMITS = [
  "Tidak mengukur tinggi air dalam sentimeter. Yang ada adalah status (normal, waspada, siaga, awas) dari penilaian visual terhadap garis acuan.",
  "Tidak menghitung kendaraan secara presisi dan tidak mengukur kecepatan. Kepadatan adalah indeks relatif: dibanding titik itu sendiri pada jam yang sama di hari-hari sebelumnya. Sepeda motor, terutama malam hari, banyak yang tidak terdeteksi.",
  "Prakiraan hujan berasal dari model cuaca Open-Meteo, bukan pengukuran di lokasi.",
  'Wilayah tanpa kamera tidak diketahui kondisinya, dan ditandai "tidak terpantau", bukan aman.',
  "Sejak sistem berjalan (10 Oktober 2026) belum pernah ada kejadian air naik yang nyata. Aturan dan peringatannya sudah diuji, tetapi ketepatan AI membaca gambar saat banjir sungguhan belum terbukti.",
  "Ketepatan penilaian pada malam hari belum dievaluasi terhadap penilaian manusia.",
  "Hubungan hulu–hilir baru diisi untuk sisi masuk dan keluar empat rumah pompa, dengan jeda waktu yang masih perkiraan awal.",
];

const PRIVACY = [
  "Hanya CCTV publik milik pemerintah kota. Kamera lingkungan RT/RW tidak dipakai.",
  "Tidak ada pengenalan wajah dan tidak ada pembacaan pelat nomor.",
  "Yang disimpan jangka panjang hanya angka: status, hitungan, dan indeks.",
  "Gambar yang dinilai AI disimpan 3 hari supaya penilaiannya bisa diperiksa orang, lalu dihapus otomatis. Arsip gambar di mesin pengolah dihapus setelah 14 hari.",
];

export default function AboutPage() {
  return (
    <div className="page">
      {/* Kolom baca yang sempit; `.page` sendiri selebar halaman lain. */}
      <div className="mx-auto max-w-3xl space-y-10">
        <header>
          <h1 className="text-3xl font-bold">Tentang SemarSight</h1>
          <p className="mt-3 text-base">
            SemarSight memakai CCTV publik Kota Semarang sebagai sensor kota: membaca kondisi air (sungai, pompa, genangan) dan kepadatan
            lalu lintas, lalu menghubungkannya dengan prakiraan hujan untuk memberi peringatan dan saran yang bisa ditindaklanjuti. Kamera
            adalah buktinya; yang ditonjolkan adalah kondisi wilayah.
          </p>
          <Suspense fallback={null}>
            <Coverage />
          </Suspense>
        </header>

        <section aria-labelledby="cara-kerja">
          <h2 id="cara-kerja" className="text-xl font-bold">
            Cara kerja
          </h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="tint tone-density-normal mt-5 rounded-control p-4 text-sm">
            <span className="font-semibold">AI untuk melihat dan menjelaskan, aturan untuk memutuskan.</span> Itu sebabnya satu penilaian AI
            yang keliru tidak langsung menjadi peringatan.{" "}
            <Link href="/simulasi" className="font-semibold underline underline-offset-2">
              Simulasi kejadian
            </Link>{" "}
            memperlihatkan alurnya langkah demi langkah.
          </p>
        </section>

        <section aria-labelledby="skor-risiko">
          <h2 id="skor-risiko" className="text-xl font-bold">
            Skor risiko
          </h2>
          <p className="mt-2 text-sm text-muted">
            Angka 0 sampai 1 untuk tiap lokasi air, dijumlah dari empat komponen yang semuanya bisa dilihat di halaman kamera:
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["40%", "Status air"],
              ["20%", "Tren naik"],
              ["20%", "Kondisi hulu"],
              ["20%", "Prakiraan hujan 3 jam"],
            ].map(([weight, label]) => (
              <div key={label} className="rounded-control border border-border bg-surface p-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{weight}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-muted">Ini ukuran kewaspadaan, bukan prakiraan banjir.</p>
        </section>

        <section aria-labelledby="batasan">
          <h2 id="batasan" className="text-xl font-bold">
            Yang tidak dilakukan sistem ini
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {LIMITS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-waspada" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="privasi">
          <h2 id="privasi" className="text-xl font-bold">
            Privasi
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {PRIVACY.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-normal" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sumber">
          <h2 id="sumber" className="text-xl font-bold">
            Sumber data
          </h2>
          <dl className="mt-3 divide-y divide-border rounded-token border border-border bg-surface text-sm">
            {[
              ["Gambar CCTV", "PANTAUSEMAR, Pemerintah Kota Semarang"],
              ["Prakiraan hujan", "Open-Meteo (model cuaca, diperbarui tiap 30 menit)"],
              ["Peta, jalan, dan batas kecamatan", "© kontributor OpenStreetMap, lisensi ODbL"],
              ["Penghitungan kendaraan", "YOLO11n, dijalankan di mesin sendiri"],
              ["Penilaian air dan ringkasan", "Model OpenAI, dengan keluaran terstruktur yang divalidasi"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-muted">
            Dibuat untuk ICONFEST 2026, Software Development, tema Smart City. Angka di situs ini adalah perkiraan dari gambar, bukan
            pengukuran resmi, dan tidak menggantikan informasi dari BPBD atau BMKG.
          </p>
        </section>
      </div>
    </div>
  );
}

/** Cakupan saat ini, dihitung dari data langsung supaya angkanya tidak pernah usang. */
async function Coverage() {
  const cameras = await getCameraOverview().catch(() => []);
  if (cameras.length === 0) return null;
  const waterSites = cameras.filter(hasWaterStatus).length;
  const districts = summarizeDistricts(cameras, []);
  const tracked = districts.filter((district) => district.waterSites.length > 0).length;
  const figures = [
    [String(cameras.length), "kamera publik dipantau"],
    [String(waterSites), "lokasi air dinilai AI"],
    [`${tracked} dari ${districts.length}`, "kecamatan punya lokasi air terpantau"],
  ];
  return (
    <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {figures.map(([value, label]) => (
        <div key={label} className="rounded-control border border-border bg-surface p-3">
          <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
          <dt className="text-xs text-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

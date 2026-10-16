-- =====================================================================
-- SemarSight — tambahan skema untuk fitur lanjutan
-- Jalankan SETELAH schema.sql. Idempoten (aman dijalankan ulang).
-- Hanya jalankan bagian untuk fitur yang benar-benar dikerjakan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- F-B1  BMKG: kelurahan, prakiraan, peringatan dini (nowcast)
-- ---------------------------------------------------------------------
create table if not exists kelurahan (
  adm4        text primary key,            -- mis. '33.74.01.1001'
  desa        text not null,
  kecamatan   text not null,
  lat         double precision,
  lng         double precision,
  updated_at  timestamptz not null default now()
);

alter table cameras add column if not exists adm4 text references kelurahan(adm4);

create table if not exists bmkg_forecasts (
  id               bigserial primary key,
  adm4             text not null references kelurahan(adm4) on delete cascade,
  analysis_date    timestamptz,               -- waktu analisis BMKG
  valid_at         timestamptz not null,      -- utc_datetime slot prakiraan
  weather_code     integer,
  weather_desc     text,
  precip_mm        real,                      -- field tp
  temp_c           real,
  humidity         real,
  cloud_cover      real,                      -- field tcc
  wind_speed       real,
  wind_dir         text,
  fetched_at       timestamptz not null default now(),
  unique (adm4, valid_at, analysis_date)
);
create index if not exists bmkg_fc_adm4_time_idx on bmkg_forecasts (adm4, valid_at);

create table if not exists bmkg_alerts (
  id            text primary key,             -- kode CAP, mis. 'CJT20261010001'
  title         text not null,
  description   text,
  event         text,
  severity      text,
  urgency       text,
  certainty     text,
  effective_at  timestamptz,
  expires_at    timestamptz,
  area_desc     text,
  polygon       jsonb,                        -- poligon area dari CAP (lon/lat)
  affects_semarang boolean not null default false,
  cap_url       text,
  fetched_at    timestamptz not null default now()
);
create index if not exists bmkg_alerts_active_idx on bmkg_alerts (affects_semarang, expires_at desc);

-- ---------------------------------------------------------------------
-- F-B4  Fasilitas penting dari OpenStreetMap (dampak)
-- ---------------------------------------------------------------------
create table if not exists facilities (
  id          text primary key,               -- 'osm:node/123'
  kind        text not null check (kind in ('school','hospital','clinic','puskesmas','bus_stop','market','other')),
  name        text,
  lat         double precision not null,
  lng         double precision not null,
  tags        jsonb,
  imported_at timestamptz not null default now()
);
create index if not exists facilities_kind_idx on facilities (kind);

-- fasilitas dalam radius tertentu dari tiap kamera (dihitung sekali oleh skrip)
create table if not exists camera_facilities (
  camera_id   uuid not null references cameras(id) on delete cascade,
  facility_id text not null references facilities(id) on delete cascade,
  distance_m  integer not null,
  primary key (camera_id, facility_id)
);

-- ---------------------------------------------------------------------
-- F-A4  Pasangan kamera rumah pompa (IN/OUT)
-- ---------------------------------------------------------------------
create table if not exists pump_pairs (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,             -- mis. 'Banger'
  in_camera_id     uuid not null references cameras(id) on delete cascade,
  out_camera_id    uuid not null references cameras(id) on delete cascade,
  verified         boolean not null default false,  -- sudah dicek manual bahwa ini sisi masuk/keluar pompa yang sama
  notes            text,
  unique (in_camera_id, out_camera_id),
  check (in_camera_id <> out_camera_id)
);

-- ---------------------------------------------------------------------
-- F-A1/A5  Sinyal tambahan per pembacaan (hujan dari kamera, cahaya malam)
-- ---------------------------------------------------------------------
create table if not exists scene_readings (
  id                 bigserial primary key,
  camera_id          uuid not null references cameras(id) on delete cascade,
  captured_at        timestamptz not null,
  is_night           boolean,
  luminance_mean     real,       -- 0..255 (dipengaruhi auto-exposure)
  saturation_mean    real,       -- ~0 = mode inframerah hitam-putih
  bright_px_permille real,       -- jumlah piksel sangat terang per mil (proksi sumber cahaya)
  rain_visible       text check (rain_visible in ('ya','tidak','tidak_dapat_dinilai')),
  wet_road           text check (wet_road in ('ya','tidak','tidak_dapat_dinilai')),
  source             data_source not null default 'live'
);
create index if not exists scene_cam_time_idx on scene_readings (camera_id, captured_at desc);

-- ---------------------------------------------------------------------
-- F-C1  Langganan peringatan Telegram
-- ---------------------------------------------------------------------
create table if not exists telegram_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  chat_id       bigint not null,
  camera_id     uuid references cameras(id) on delete cascade,   -- null = seluruh kota
  kecamatan     text,
  min_level     alert_level not null default 'waspada',
  created_at    timestamptz not null default now(),
  is_active     boolean not null default true,
  unique (chat_id, camera_id, kecamatan)
);

create table if not exists notification_log (
  id          bigserial primary key,
  alert_id    uuid references alerts(id) on delete cascade,
  chat_id     bigint not null,
  sent_at     timestamptz not null default now(),
  ok          boolean not null,
  error       text,
  unique (alert_id, chat_id)
);

-- ---------------------------------------------------------------------
-- F-C2  Validasi dan laporan warga
-- ---------------------------------------------------------------------
create table if not exists citizen_reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  camera_id     uuid references cameras(id) on delete set null,
  alert_id      uuid references alerts(id) on delete set null,
  kind          text not null check (kind in ('konfirmasi','bantah','laporan_baru')),
  road_flood    road_flood_status,
  note          text check (char_length(note) <= 280),
  photo_path    text,
  lat           double precision,
  lng           double precision,
  ip_hash       text,                      -- untuk rate limit, bukan identitas
  status        text not null default 'baru' check (status in ('baru','diterima','ditolak')),
  moderated_at  timestamptz
);
create index if not exists citizen_reports_time_idx on citizen_reports (created_at desc);

-- ---------------------------------------------------------------------
-- F-B3  Data genangan resmi SIGAB (DPU) — hanya jika izin diperoleh
-- ---------------------------------------------------------------------
create table if not exists sigab_records (
  id            text primary key,           -- id dari sumber jika ada, atau hash
  record_date   date not null,
  jenis         text,                       -- genangan | banjir | rob
  judul         text,
  alamat        text,
  tinggi_cm     real,
  luas_m2       real,
  lat           double precision,
  lng           double precision,
  raw           jsonb,
  fetched_at    timestamptz not null default now()
);
create index if not exists sigab_date_idx on sigab_records (record_date desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table kelurahan              enable row level security;
alter table bmkg_forecasts         enable row level security;
alter table bmkg_alerts            enable row level security;
alter table facilities             enable row level security;
alter table camera_facilities      enable row level security;
alter table pump_pairs             enable row level security;
alter table scene_readings         enable row level security;
alter table telegram_subscriptions enable row level security;   -- tanpa akses publik
alter table notification_log       enable row level security;   -- tanpa akses publik
alter table citizen_reports        enable row level security;   -- publik hanya lihat yang diterima
alter table sigab_records          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['kelurahan','bmkg_forecasts','bmkg_alerts','facilities',
                           'camera_facilities','pump_pairs','scene_readings','sigab_records'] loop
    execute format('drop policy if exists public_read on %I', t);
    execute format('create policy public_read on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists public_read_accepted on citizen_reports;
create policy public_read_accepted on citizen_reports
  for select to anon, authenticated using (status = 'diterima');

do $$ begin
  alter publication supabase_realtime add table bmkg_alerts;
exception when duplicate_object then null; when undefined_object then null; end $$;

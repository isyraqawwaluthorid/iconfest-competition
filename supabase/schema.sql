-- =====================================================================
-- SemarSight — skema database Supabase (Postgres)
-- Jalankan di Supabase SQL Editor pada proyek baru.
-- Semua waktu disimpan dalam UTC (timestamptz); tampilkan di WIB.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipe enum
-- ---------------------------------------------------------------------
do $$ begin
  create type health_status as enum ('live', 'frozen', 'dead', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type image_quality as enum ('good', 'fair', 'poor');
exception when duplicate_object then null; end $$;

-- Status air (sungai/pompa) — mengikuti istilah peringatan dini yang umum
do $$ begin
  create type water_status as enum ('normal', 'waspada', 'siaga', 'awas', 'tidak_dapat_dinilai');
exception when duplicate_object then null; end $$;

-- Status genangan di jalan
do $$ begin
  create type road_flood_status as enum ('tidak_tergenang', 'genangan_ringan', 'genangan_sedang', 'genangan_tinggi', 'tidak_dapat_dinilai', 'tidak_relevan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trash_level as enum ('tidak_terlihat', 'sedikit', 'banyak', 'tidak_dapat_dinilai', 'tidak_relevan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type water_trend as enum ('naik_cepat', 'naik', 'stabil', 'turun', 'tidak_diketahui');
exception when duplicate_object then null; end $$;

do $$ begin
  create type density_level as enum ('lancar', 'normal', 'ramai', 'padat', 'tidak_diketahui');
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_level as enum ('rendah', 'sedang', 'tinggi', 'sangat_tinggi', 'tidak_diketahui');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_level as enum ('info', 'waspada', 'siaga', 'awas');
exception when duplicate_object then null; end $$;

do $$ begin
  create type data_source as enum ('live', 'synthetic', 'replay');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Kamera (master)
-- ---------------------------------------------------------------------
create table if not exists cameras (
  id                    uuid primary key default gen_random_uuid(),
  source                text not null default 'pantausemar',
  source_link_id        integer not null,
  name                  text not null,
  categories            text[] not null default '{}',      -- kantor|lalin|pompa|pariwisata|genangan|sungai
  modules               text[] not null default '{}',      -- traffic|crowd|water
  owner                 text,
  lat                   double precision not null,
  lng                   double precision not null,
  stream_url            text not null,
  is_active             boolean not null default true,     -- dipantau worker
  is_featured           boolean not null default false,    -- kamera unggulan (terkalibrasi, tampil menonjol)
  weather_grid_id       text,
  -- kalibrasi modul air (diisi lewat halaman admin)
  water_kind            text check (water_kind in ('sungai', 'pompa_in', 'pompa_out', 'kolam', 'jalan')),
  river_system          text,                              -- mis. 'Banjir Kanal Timur'
  roi                   jsonb,                             -- {"points": [[x,y],...]} koordinat ternormalisasi 0..1
  reference_lines       jsonb,                             -- [{"level":"waspada","points":[[x,y],[x,y]]}, ...]
  reference_image_day   text,                              -- path Storage
  reference_image_night text,
  calibration_notes     text,                              -- keterangan untuk prompt AI, mis. "garis siaga = anak tangga ke-3"
  -- ROI jalan untuk YOLO (opsional)
  traffic_roi           jsonb,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (source, source_link_id)
);

create index if not exists cameras_active_idx on cameras (is_active);
create index if not exists cameras_modules_idx on cameras using gin (modules);

-- ---------------------------------------------------------------------
-- Status terkini per kamera (satu baris per kamera; dipakai Realtime)
-- ---------------------------------------------------------------------
create table if not exists camera_status (
  camera_id               uuid primary key references cameras(id) on delete cascade,
  health                  health_status not null default 'unknown',
  last_checked_at         timestamptz,
  last_live_at            timestamptz,
  consecutive_failures    integer not null default 0,
  latest_snapshot_path    text,
  latest_snapshot_at      timestamptz,
  latest_quality          image_quality,
  is_night                boolean,
  -- modul air (status terkonfirmasi setelah penghalusan)
  water_status            water_status,
  water_status_since      timestamptz,
  water_trend             water_trend,
  road_flood              road_flood_status,
  trash                   trash_level,
  water_confidence        real,
  needs_verification      boolean not null default false,
  risk_score              real,
  risk_level              risk_level,
  risk_components         jsonb,          -- {"status":..,"trend":..,"upstream":..,"rain":..,"weights":{..}}
  -- modul lalu lintas / keramaian
  vehicle_count           integer,
  person_count            integer,
  density_index           real,
  density_level           density_level,
  is_anomaly              boolean not null default false,
  baseline_is_provisional boolean not null default true,
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Log kesehatan (untuk statistik ketersediaan kamera)
-- ---------------------------------------------------------------------
create table if not exists health_checks (
  id          bigserial primary key,
  camera_id   uuid not null references cameras(id) on delete cascade,
  checked_at  timestamptz not null default now(),
  health      health_status not null,
  latency_ms  integer,
  error       text
);
create index if not exists health_checks_cam_time_idx on health_checks (camera_id, checked_at desc);

-- ---------------------------------------------------------------------
-- Pembacaan lalu lintas / keramaian (YOLO)
-- ---------------------------------------------------------------------
create table if not exists traffic_readings (
  id              bigserial primary key,
  camera_id       uuid not null references cameras(id) on delete cascade,
  captured_at     timestamptz not null,
  cars            integer not null default 0,
  motorcycles     integer not null default 0,
  buses           integer not null default 0,
  trucks          integer not null default 0,
  bicycles        integer not null default 0,
  persons         integer not null default 0,
  vehicle_total   integer not null default 0,
  density_index   real,
  density_level   density_level,
  baseline_median real,
  is_anomaly      boolean not null default false,
  quality         image_quality,
  is_night        boolean,
  model           text,
  source          data_source not null default 'live'
);
create index if not exists traffic_cam_time_idx on traffic_readings (camera_id, captured_at desc);
create index if not exists traffic_time_idx on traffic_readings (captured_at desc);

-- ---------------------------------------------------------------------
-- Pembacaan air (AI vision) — satu baris per panggilan AI
-- ---------------------------------------------------------------------
create table if not exists water_readings (
  id               bigserial primary key,
  camera_id        uuid not null references cameras(id) on delete cascade,
  captured_at      timestamptz not null,
  status           water_status not null,
  road_flood       road_flood_status not null default 'tidak_relevan',
  trash            trash_level not null default 'tidak_relevan',
  water_position   text,           -- relatif terhadap garis acuan, dari AI
  confidence       real,
  reason           text,
  trigger          text check (trigger in ('change', 'heartbeat', 'rain', 'manual')),
  change_score     real,           -- skor perubahan lokal (1 - SSIM) yang memicu
  quality          image_quality,
  is_night         boolean,
  snapshot_path    text,           -- path frame lokal/Storage untuk audit dan evaluasi
  model            text,
  raw              jsonb,          -- JSON mentah dari AI
  source           data_source not null default 'live'
);
create index if not exists water_cam_time_idx on water_readings (camera_id, captured_at desc);
create index if not exists water_time_idx on water_readings (captured_at desc);

-- ---------------------------------------------------------------------
-- Baseline per kamera per jam-dalam-minggu (0 = Senin 00.00 WIB ... 167)
-- ---------------------------------------------------------------------
create table if not exists baselines (
  camera_id     uuid not null references cameras(id) on delete cascade,
  metric        text not null check (metric in ('vehicle_total', 'persons')),
  hour_of_week  smallint not null check (hour_of_week between 0 and 167),
  median        real not null,
  p90           real not null,
  n             integer not null,
  updated_at    timestamptz not null default now(),
  primary key (camera_id, metric, hour_of_week)
);

-- ---------------------------------------------------------------------
-- Cuaca (grid)
-- ---------------------------------------------------------------------
create table if not exists weather_grid (
  id    text primary key,          -- mis. 'G1'
  name  text,
  lat   double precision not null,
  lng   double precision not null
);

create table if not exists weather_readings (
  id                bigserial primary key,
  grid_id           text not null references weather_grid(id) on delete cascade,
  fetched_at        timestamptz not null default now(),
  precip_now_mm     real,
  precip_next_1h_mm real,
  precip_next_3h_mm real,
  precip_next_6h_mm real,
  precip_prob_max_3h real,
  hourly            jsonb,          -- potongan data hourly mentah 12 jam ke depan
  source            data_source not null default 'live'
);
create index if not exists weather_grid_time_idx on weather_readings (grid_id, fetched_at desc);

-- ---------------------------------------------------------------------
-- Relasi hulu → hilir antar kamera air
-- ---------------------------------------------------------------------
create table if not exists river_links (
  id                   uuid primary key default gen_random_uuid(),
  river_system         text not null,
  upstream_camera_id   uuid not null references cameras(id) on delete cascade,
  downstream_camera_id uuid not null references cameras(id) on delete cascade,
  default_lag_minutes  integer not null default 60,
  learned_lag_minutes  integer,
  learned_from_events  integer not null default 0,
  created_at           timestamptz not null default now(),
  unique (upstream_camera_id, downstream_camera_id),
  check (upstream_camera_id <> downstream_camera_id)
);

-- ---------------------------------------------------------------------
-- Kejadian genangan/luapan
-- ---------------------------------------------------------------------
create table if not exists events (
  id                 uuid primary key default gen_random_uuid(),
  camera_id          uuid not null references cameras(id) on delete cascade,
  kind               text not null check (kind in ('luapan_sungai', 'genangan_jalan')),
  started_at         timestamptz not null,
  peak_at            timestamptz,
  peak_status        text,
  ended_at           timestamptz,
  duration_minutes   integer,
  rain_total_mm      real,
  traffic_impact     jsonb,       -- {"density_ratio": 2.3, "cameras": [...]} dari analisis lintas modul
  snapshot_paths     text[] not null default '{}',
  source             data_source not null default 'live'
);
create index if not exists events_cam_time_idx on events (camera_id, started_at desc);
create index if not exists events_open_idx on events (ended_at) where ended_at is null;

-- ---------------------------------------------------------------------
-- Peringatan
-- ---------------------------------------------------------------------
create table if not exists alerts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  is_active    boolean not null default true,
  type         text not null check (type in (
                 'water_rising', 'upstream_warning', 'heavy_rain', 'road_flooded',
                 'traffic_anomaly', 'crowd_anomaly', 'trash_blockage',
                 'camera_offline', 'worker_offline')),
  level        alert_level not null,
  camera_id    uuid references cameras(id) on delete cascade,
  title        text not null,
  message      text not null,
  audience     text[] not null default '{}',     -- bpbd|pu|dishub|warga|perencana
  data         jsonb,
  source       data_source not null default 'live'
);
-- satu peringatan aktif per (jenis, kamera)
create unique index if not exists alerts_one_active_idx
  on alerts (type, coalesce(camera_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active;
create index if not exists alerts_active_idx on alerts (is_active, created_at desc);

-- ---------------------------------------------------------------------
-- Insight AI
-- ---------------------------------------------------------------------
create table if not exists insights (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  scope       text not null check (scope in ('situasi', 'harian', 'mingguan', 'lintas_modul', 'kamera')),
  camera_id   uuid references cameras(id) on delete cascade,
  headline    text not null,
  body        jsonb not null,     -- output JSON LLM (lihat docs/07-ai-prompts.md)
  facts       jsonb not null,     -- data yang dikirim ke LLM (untuk jejak audit)
  model       text,
  source      data_source not null default 'live'
);
create index if not exists insights_scope_time_idx on insights (scope, created_at desc);

-- ---------------------------------------------------------------------
-- Label manual untuk evaluasi akurasi
-- ---------------------------------------------------------------------
create table if not exists labels (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  camera_id         uuid not null references cameras(id) on delete cascade,
  water_reading_id  bigint references water_readings(id) on delete set null,
  snapshot_path     text not null,
  captured_at       timestamptz not null,
  is_night          boolean,
  label_status      water_status,
  label_road_flood  road_flood_status,
  label_trash       trash_level,
  labeled_by        text
);

-- ---------------------------------------------------------------------
-- Status sistem (heartbeat worker, dsb.)
-- ---------------------------------------------------------------------
create table if not exists system_status (
  key         text primary key,     -- 'worker'
  value       jsonb not null,       -- {"last_seen": "...", "cycle_ms": 12345, "version": "..."}
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pembatasan laju asisten AI
-- ---------------------------------------------------------------------
create table if not exists assistant_usage (
  ip_hash       text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (ip_hash, window_start)
);

-- ---------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists cameras_updated_at on cameras;
create trigger cameras_updated_at before update on cameras
  for each row execute function set_updated_at();

drop trigger if exists alerts_updated_at on alerts;
create trigger alerts_updated_at before update on alerts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- View untuk web
-- ---------------------------------------------------------------------
create or replace view v_camera_overview as
select
  c.id, c.name, c.categories, c.modules, c.owner, c.lat, c.lng, c.stream_url,
  c.is_featured, c.water_kind, c.river_system, c.weather_grid_id,
  (c.roi is not null) as is_calibrated,
  s.health, s.last_checked_at, s.last_live_at, s.latest_snapshot_path, s.latest_snapshot_at,
  s.latest_quality, s.is_night,
  s.water_status, s.water_status_since, s.water_trend, s.road_flood, s.trash,
  s.water_confidence, s.needs_verification, s.risk_score, s.risk_level, s.risk_components,
  s.vehicle_count, s.person_count, s.density_index, s.density_level, s.is_anomaly,
  s.baseline_is_provisional, s.updated_at as status_updated_at
from cameras c
left join camera_status s on s.camera_id = c.id
where c.is_active;

-- Ringkasan ketersediaan kamera 24 jam terakhir
create or replace view v_camera_uptime_24h as
select
  camera_id,
  count(*)                                         as checks,
  count(*) filter (where health = 'live')          as live_checks,
  round(100.0 * count(*) filter (where health = 'live') / nullif(count(*), 0), 1) as uptime_pct
from health_checks
where checked_at > now() - interval '24 hours'
group by camera_id;

-- ---------------------------------------------------------------------
-- Row Level Security: publik hanya boleh membaca
-- Penulisan dilakukan dengan service role (bypass RLS) dari worker / server.
-- ---------------------------------------------------------------------
alter table cameras          enable row level security;
alter table camera_status    enable row level security;
alter table health_checks    enable row level security;
alter table traffic_readings enable row level security;
alter table water_readings   enable row level security;
alter table baselines        enable row level security;
alter table weather_grid     enable row level security;
alter table weather_readings enable row level security;
alter table river_links      enable row level security;
alter table events           enable row level security;
alter table alerts           enable row level security;
alter table insights         enable row level security;
alter table labels           enable row level security;
alter table system_status    enable row level security;
alter table assistant_usage  enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'cameras','camera_status','health_checks','traffic_readings','water_readings',
    'baselines','weather_grid','weather_readings','river_links','events',
    'alerts','insights','system_status'
  ] loop
    execute format('drop policy if exists public_read on %I', t);
    execute format('create policy public_read on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
-- labels dan assistant_usage: tanpa policy publik (hanya service role).

-- View mengikuti hak akses pemanggil (Postgres 15+)
alter view v_camera_overview set (security_invoker = true);
alter view v_camera_uptime_24h set (security_invoker = true);

-- ---------------------------------------------------------------------
-- Realtime: tabel yang didorong ke browser
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table camera_status;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table alerts;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table insights;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table system_status;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------------------------------------------------------------------
-- Storage bucket untuk snapshot (publik baca)
--   latest/{camera_id}.jpg          snapshot terbaru (ditimpa tiap siklus)
--   reference/{camera_id}/day.jpg   foto referensi kalibrasi
--   events/{event_id}/{ts}.jpg      snapshot kejadian
--   labels/{camera_id}/{ts}.jpg     sampel untuk evaluasi
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('snapshots', 'snapshots', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Grid cuaca awal Kota Semarang (perkiraan; sesuaikan bila perlu)
-- ---------------------------------------------------------------------
insert into weather_grid (id, name, lat, lng) values
  ('G1', 'Semarang Barat / Tugu',          -6.975, 110.360),
  ('G2', 'Semarang Utara / Tengah',        -6.965, 110.420),
  ('G3', 'Genuk / Semarang Timur',         -6.960, 110.470),
  ('G4', 'Ngaliyan / Gajahmungkur',        -7.010, 110.370),
  ('G5', 'Candisari / Gayamsari',          -7.005, 110.430),
  ('G6', 'Pedurungan',                     -7.000, 110.480),
  ('G7', 'Mijen',                          -7.060, 110.320),
  ('G8', 'Banyumanik / Gunungpati',        -7.060, 110.410),
  ('G9', 'Tembalang',                      -7.055, 110.460)
on conflict (id) do nothing;

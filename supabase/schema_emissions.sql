-- =====================================================================
-- SemarSight — modul Emisi & Kualitas Udara
-- Jalankan SETELAH schema.sql (dan seed_cameras.sql). Idempoten.
-- Tidak bergantung pada schema_features.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- E1  Kualitas udara (model & terukur)
-- ---------------------------------------------------------------------
do $$ begin
  create type ispu_category as enum ('baik', 'sedang', 'tidak_sehat', 'sangat_tidak_sehat', 'berbahaya', 'tidak_diketahui');
exception when duplicate_object then null; end $$;

create table if not exists air_quality_readings (
  id             bigserial primary key,
  source         text not null check (source in ('open_meteo', 'bmkg_station', 'waqi', 'openaq', 'manual')),
  is_model       boolean not null,              -- true = hasil model (mis. CAMS via Open-Meteo); false = pengukuran stasiun
  station_name   text,
  lat            double precision,
  lng            double precision,
  measured_at    timestamptz not null,          -- waktu data (bukan waktu ambil)
  pm25           real,                          -- µg/m³
  pm10           real,
  no2            real,
  co             real,
  so2            real,
  o3             real,
  us_aqi         real,
  ispu_pm25      real,                          -- nilai ISPU hasil konversi
  ispu_category  ispu_category not null default 'tidak_diketahui',
  fetched_at     timestamptz not null default now(),
  raw            jsonb,
  data_origin    data_source not null default 'live',
  unique (source, station_name, measured_at)
);
create index if not exists aq_time_idx on air_quality_readings (measured_at desc);

-- ---------------------------------------------------------------------
-- E2  Arus kendaraan dari klip video (YOLO + tracking + garis hitung)
-- ---------------------------------------------------------------------
alter table cameras add column if not exists counting_line jsonb;
-- {"points": [[x1,y1],[x2,y2]], "direction_labels": {"positive": "ke utara", "negative": "ke selatan"}}  (koordinat ternormalisasi 0..1)
alter table cameras add column if not exists flow_enabled boolean not null default false;

create table if not exists traffic_flows (
  id                bigserial primary key,
  camera_id         uuid not null references cameras(id) on delete cascade,
  window_start      timestamptz not null,
  window_seconds    integer not null,           -- durasi klip yang dianalisis
  motorcycles       integer not null default 0,
  cars              integer not null default 0,
  buses             integer not null default 0,
  trucks            integer not null default 0,
  vehicles_total    integer not null default 0,
  by_direction      jsonb,                      -- {"positive": {...}, "negative": {...}}
  flow_per_hour     real,                       -- vehicles_total * 3600 / window_seconds
  mean_track_speed  real,                       -- kecepatan relatif (px/detik ternormalisasi), proksi kemacetan
  stopped_share     real,                       -- proporsi track yang hampir diam (0..1)
  quality           image_quality,
  is_night          boolean,
  model             text,
  data_origin       data_source not null default 'live'
);
create index if not exists flows_cam_time_idx on traffic_flows (camera_id, window_start desc);

-- ---------------------------------------------------------------------
-- E3  Ruas jalan representatif per kamera
-- ---------------------------------------------------------------------
create table if not exists road_segments (
  camera_id     uuid primary key references cameras(id) on delete cascade,
  road_name     text,
  road_class    text,                           -- tag highway OSM: primary, secondary, ...
  osm_way_ids   bigint[] not null default '{}',
  length_km     real not null default 1.0,      -- panjang segmen yang diwakili kamera
  lanes         smallint,
  notes         text,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- E3  Faktor emisi dan asumsi kendaraan (dapat diubah tanpa ubah kode)
-- ---------------------------------------------------------------------
create table if not exists emission_factors (
  vehicle_type  text not null check (vehicle_type in ('sepeda_motor', 'mobil_bensin', 'mobil_solar', 'bus', 'truk')),
  pollutant     text not null check (pollutant in ('co', 'hc', 'nox', 'pm10', 'so2', 'co2')),
  value         real not null,
  unit          text not null check (unit in ('g/km', 'g/kg_bbm')),
  source        text not null,
  primary key (vehicle_type, pollutant)
);

insert into emission_factors (vehicle_type, pollutant, value, unit, source) values
  ('sepeda_motor','co',14,'g/km','Permen LH 12/2010'), ('sepeda_motor','hc',5.9,'g/km','Permen LH 12/2010'),
  ('sepeda_motor','nox',0.29,'g/km','Permen LH 12/2010'), ('sepeda_motor','pm10',0.24,'g/km','Permen LH 12/2010'),
  ('sepeda_motor','so2',0.008,'g/km','Permen LH 12/2010'), ('sepeda_motor','co2',3180,'g/kg_bbm','Permen LH 12/2010'),
  ('mobil_bensin','co',40,'g/km','Permen LH 12/2010'), ('mobil_bensin','hc',4,'g/km','Permen LH 12/2010'),
  ('mobil_bensin','nox',2,'g/km','Permen LH 12/2010'), ('mobil_bensin','pm10',0.01,'g/km','Permen LH 12/2010'),
  ('mobil_bensin','so2',0.026,'g/km','Permen LH 12/2010'), ('mobil_bensin','co2',3180,'g/kg_bbm','Permen LH 12/2010'),
  ('mobil_solar','co',2.8,'g/km','Permen LH 12/2010'), ('mobil_solar','hc',0.2,'g/km','Permen LH 12/2010'),
  ('mobil_solar','nox',3.5,'g/km','Permen LH 12/2010'), ('mobil_solar','pm10',0.53,'g/km','Permen LH 12/2010'),
  ('mobil_solar','so2',0.44,'g/km','Permen LH 12/2010'), ('mobil_solar','co2',3172,'g/kg_bbm','Permen LH 12/2010'),
  ('bus','co',11,'g/km','Permen LH 12/2010'), ('bus','hc',1.3,'g/km','Permen LH 12/2010'),
  ('bus','nox',11.9,'g/km','Permen LH 12/2010'), ('bus','pm10',1.4,'g/km','Permen LH 12/2010'),
  ('bus','so2',0.93,'g/km','Permen LH 12/2010'), ('bus','co2',3172,'g/kg_bbm','Permen LH 12/2010'),
  ('truk','co',8.4,'g/km','Permen LH 12/2010'), ('truk','hc',1.8,'g/km','Permen LH 12/2010'),
  ('truk','nox',17.7,'g/km','Permen LH 12/2010'), ('truk','pm10',1.4,'g/km','Permen LH 12/2010'),
  ('truk','so2',0.82,'g/km','Permen LH 12/2010'), ('truk','co2',3172,'g/kg_bbm','Permen LH 12/2010')
on conflict (vehicle_type, pollutant) do nothing;

create table if not exists vehicle_assumptions (
  vehicle_type        text primary key check (vehicle_type in ('sepeda_motor', 'mobil_bensin', 'mobil_solar', 'bus', 'truk')),
  yolo_class          text not null check (yolo_class in ('motorcycle', 'car', 'bus', 'truck')),
  share_of_yolo_class real not null check (share_of_yolo_class between 0 and 1),  -- mis. mobil: 0.88 bensin, 0.12 solar
  km_per_liter        real not null,
  fuel_density_kg_l   real not null,
  idle_liter_per_hour real,                     -- untuk estimasi tambahan saat antre (E4), opsional
  source_note         text not null
);

insert into vehicle_assumptions values
  ('sepeda_motor','motorcycle',1.00,40,0.74,0.15,'ASUMSI: konsumsi BBM tipikal; ganti bila ada data resmi'),
  ('mobil_bensin','car',0.88,12,0.74,0.6,'Proporsi bensin/solar dari sampel TRUE Jakarta (ICCT/ITB 2021, mobil penumpang 88% bensin). Konsumsi BBM: ASUMSI'),
  ('mobil_solar','car',0.12,12,0.84,0.6,'Proporsi dari sampel TRUE Jakarta (12% solar). Konsumsi BBM: ASUMSI'),
  ('bus','bus',1.00,4,0.84,1.5,'ASUMSI: konsumsi BBM tipikal bus'),
  ('truk','truck',1.00,5,0.84,1.2,'ASUMSI: konsumsi BBM tipikal truk')
on conflict (vehicle_type) do nothing;

-- ---------------------------------------------------------------------
-- E3  Hasil estimasi emisi per kamera/ruas per periode
-- ---------------------------------------------------------------------
create table if not exists emission_estimates (
  id               bigserial primary key,
  camera_id        uuid not null references cameras(id) on delete cascade,
  period_start     timestamptz not null,
  period_minutes   integer not null,           -- mis. 60
  vehicle_km       real not null,              -- total kendaraan-km pada periode
  co_g             real, hc_g real, nox_g real, pm10_g real, so2_g real, co2_g real,
  idle_co2_g       real,                       -- tambahan dari antrean (E4), null jika tidak dihitung
  method           text not null default 'tier2_permenlh12_2010',
  assumptions      jsonb not null,             -- salinan faktor & asumsi yang dipakai (jejak audit)
  data_origin      data_source not null default 'live',
  unique (camera_id, period_start, period_minutes)
);
create index if not exists emis_cam_time_idx on emission_estimates (camera_id, period_start desc);

-- izinkan baseline untuk metrik arus & emisi
alter table baselines drop constraint if exists baselines_metric_check;
alter table baselines add constraint baselines_metric_check
  check (metric in ('vehicle_total', 'persons', 'flow_per_hour', 'nox_g_per_hour', 'co2_g_per_hour'));

-- ---------------------------------------------------------------------
-- View: ringkasan emisi 24 jam per kamera
-- ---------------------------------------------------------------------
create or replace view v_emissions_24h as
select
  e.camera_id, c.name, c.lat, c.lng,
  sum(e.vehicle_km)  as vehicle_km,
  sum(e.co_g)/1000   as co_kg,
  sum(e.hc_g)/1000   as hc_kg,
  sum(e.nox_g)/1000  as nox_kg,
  sum(e.pm10_g)/1000 as pm10_kg,
  sum(e.so2_g)/1000  as so2_kg,
  sum(e.co2_g)/1000  as co2_kg,
  count(*)           as periods
from emission_estimates e
join cameras c on c.id = e.camera_id
where e.period_start > now() - interval '24 hours' and e.data_origin = 'live'
group by e.camera_id, c.name, c.lat, c.lng;
alter view v_emissions_24h set (security_invoker = true);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table air_quality_readings enable row level security;
alter table traffic_flows        enable row level security;
alter table road_segments        enable row level security;
alter table emission_factors     enable row level security;
alter table vehicle_assumptions  enable row level security;
alter table emission_estimates   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['air_quality_readings','traffic_flows','road_segments',
                           'emission_factors','vehicle_assumptions','emission_estimates'] loop
    execute format('drop policy if exists public_read on %I', t);
    execute format('create policy public_read on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

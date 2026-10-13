"use client";

import { useEffect, useId, useState } from "react";
import type { Insight } from "./ai-insight";
import type { ClassCounts } from "./emission";
import {
  getActiveAlerts,
  getCalibration,
  getLatestInsight,
  getRecentClassCounts,
  getSiteReadings,
  getTrafficSeries,
  type Calibration,
} from "./queries";
import { getSupabase } from "./supabase/public";
import type { Alert, CameraOverview, CameraStatusRow, SiteReading, TrafficPoint, WorkerHeartbeat } from "./types";

/**
 * Waktu sekarang yang diperbarui berkala. `null` sampai komponen terpasang di browser,
 * supaya HTML dari server tidak memuat waktu yang langsung usang.
 */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function mergeStatus(camera: CameraOverview, row: CameraStatusRow): CameraOverview {
  const { updated_at, ...status } = row;
  return { ...camera, ...status, status_updated_at: updated_at ?? camera.status_updated_at };
}

/** Daftar kamera yang ikut berubah saat worker memperbarui `camera_status` (Supabase Realtime). */
export function useLiveCameras(initial: CameraOverview[]): CameraOverview[] {
  const [cameras, setCameras] = useState(initial);
  const channelId = useId();

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`camera-status-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "camera_status" }, (payload) => {
        const row = payload.new as CameraStatusRow;
        if (!row?.camera_id) return;
        setCameras((current) => current.map((cam) => (cam.id === row.camera_id ? mergeStatus(cam, row) : cam)));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId]);

  return cameras;
}

/** Peringatan aktif; daftar dimuat ulang setiap kali worker membuat, mengubah, atau menutup peringatan. */
export function useLiveAlerts(initial: Alert[]): Alert[] {
  const [alerts, setAlerts] = useState(initial);
  const channelId = useId();

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`alerts-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        // Jika gagal dimuat ulang, daftar terakhir tetap ditampilkan.
        getActiveAlerts().then(setAlerts, () => undefined);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId]);

  return alerts;
}

/** Insight situasi terbaru; dimuat ulang setiap kali worker menulis insight baru. */
export function useLiveInsight(initial: Insight | null): Insight | null {
  const [insight, setInsight] = useState(initial);
  const channelId = useId();

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`insights-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "insights" }, () => {
        // Jika gagal dimuat ulang, insight terakhir tetap ditampilkan.
        getLatestInsight().then(setInsight, () => undefined);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId]);

  return insight;
}

/**
 * Penilaian AI terbaru per lokasi air, untuk linimasa perkembangan. Tabelnya tidak ikut Realtime,
 * jadi dimuat ulang tiap menit; penilaian baru paling cepat datang tiap siklus worker (5 menit).
 */
export function useLiveReadings(initial: SiteReading[], intervalMs = 60_000): SiteReading[] {
  const [readings, setReadings] = useState(initial);
  useEffect(() => {
    // Jika gagal dimuat ulang, penilaian terakhir tetap ditampilkan.
    const timer = setInterval(() => getSiteReadings().then(setReadings, () => undefined), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return readings;
}

/**
 * Riwayat hitungan satu kamera lalu lintas, dimuat di browser saat ruasnya dipilih.
 * `points` kosong selama memuat; `error` terisi bila gagal, supaya panel bisa mengatakannya.
 */
export function useTrafficSeries(cameraId: string, hours = 24): { points: TrafficPoint[] | null; error: boolean } {
  const [loaded, setLoaded] = useState<{ id: string; points: TrafficPoint[] | null }>({ id: "", points: null });
  useEffect(() => {
    let current = true;
    getTrafficSeries(cameraId, hours).then(
      (points) => current && setLoaded({ id: cameraId, points }),
      () => current && setLoaded({ id: cameraId, points: null }),
    );
    return () => {
      current = false;
    };
  }, [cameraId, hours]);
  const ready = loaded.id === cameraId;
  return { points: ready ? loaded.points : null, error: ready && loaded.points === null };
}

/**
 * Hitungan per jenis kendaraan semua kamera dalam 30 menit terakhir, untuk lapisan beban emisi. Dimuat hanya
 * saat `enabled`, lalu diperbarui tiap siklus worker (5 menit). `rows` kosong selama memuat.
 */
export function useClassCounts(enabled: boolean, intervalMs = 300_000): { rows: ClassCounts[] | null; error: boolean } {
  const [state, setState] = useState<{ rows: ClassCounts[] | null; error: boolean }>({ rows: null, error: false });
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const load = () =>
      getRecentClassCounts().then(
        (rows) => current && setState({ rows, error: false }),
        // Jika gagal dimuat ulang, hitungan terakhir tetap dipakai.
        () => current && setState((previous) => ({ rows: previous.rows, error: previous.rows === null })),
      );
    void load();
    const timer = setInterval(load, intervalMs);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [enabled, intervalMs]);
  return state;
}

/** Kalibrasi satu kamera air (garis acuan), dimuat di browser saat lokasinya dipilih. `null` selama memuat atau bila gagal. */
export function useCalibration(cameraId: string): Calibration | null {
  const [loaded, setLoaded] = useState<{ id: string; calibration: Calibration | null }>({ id: "", calibration: null });
  useEffect(() => {
    let current = true;
    getCalibration(cameraId).then(
      (calibration) => current && setLoaded({ id: cameraId, calibration }),
      // Tanpa garis acuan, gambar kamera tetap tampil.
      () => current && setLoaded({ id: cameraId, calibration: null }),
    );
    return () => {
      current = false;
    };
  }, [cameraId]);
  return loaded.id === cameraId ? loaded.calibration : null;
}

/** Heartbeat worker terbaru, diperbarui lewat Realtime. */
export function useWorkerHeartbeat(initial: WorkerHeartbeat | null): WorkerHeartbeat | null {
  const [heartbeat, setHeartbeat] = useState(initial);
  // Nama kanal harus unik per pemakai: Supabase menolak langganan kedua pada kanal bernama sama.
  const channelId = useId();

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`system-status-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "system_status" }, (payload) => {
        const row = payload.new as { key?: string; value?: WorkerHeartbeat };
        if (row?.key === "worker" && row.value) setHeartbeat(row.value);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId]);

  return heartbeat;
}

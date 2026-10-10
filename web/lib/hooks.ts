"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "./supabase/public";
import type { CameraOverview, CameraStatusRow, WorkerHeartbeat } from "./types";

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

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel("camera-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "camera_status" }, (payload) => {
        const row = payload.new as CameraStatusRow;
        if (!row?.camera_id) return;
        setCameras((current) => current.map((cam) => (cam.id === row.camera_id ? mergeStatus(cam, row) : cam)));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return cameras;
}

/** Heartbeat worker terbaru, diperbarui lewat Realtime. */
export function useWorkerHeartbeat(initial: WorkerHeartbeat | null): WorkerHeartbeat | null {
  const [heartbeat, setHeartbeat] = useState(initial);

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel("system-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_status" }, (payload) => {
        const row = payload.new as { key?: string; value?: WorkerHeartbeat };
        if (row?.key === "worker" && row.value) setHeartbeat(row.value);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return heartbeat;
}

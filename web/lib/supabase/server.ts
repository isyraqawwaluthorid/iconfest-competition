import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase dengan service role: melewati RLS dan boleh menulis.
 * Hanya untuk route handler dan komponen server admin; tidak pernah dikirim ke browser.
 */
let client: SupabaseClient | undefined;

export function getServiceSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi di lingkungan server.");
    }
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

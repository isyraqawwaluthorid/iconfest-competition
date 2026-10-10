import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase dengan kunci publik (anon). Aman dipakai di browser maupun server:
 * RLS hanya mengizinkan baca. Penulisan memakai service role di server, bukan client ini.
 */
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

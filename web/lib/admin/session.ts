import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./token";

/** Apakah permintaan ini membawa sesi admin yang sah. Dipanggil di setiap route handler dan halaman admin. */
export async function isAdminRequest(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, process.env.ADMIN_SESSION_SECRET, Date.now());
}

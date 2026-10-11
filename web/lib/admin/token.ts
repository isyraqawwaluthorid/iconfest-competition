/**
 * Token sesi admin: `<kedaluwarsa>.<tanda tangan HMAC-SHA256>`.
 * Fungsi murni tanpa akses cookie, supaya bisa dipakai di proxy maupun route handler.
 */

export const SESSION_COOKIE = "ss_admin";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Perbandingan yang waktunya tidak bergantung pada posisi karakter pertama yang berbeda. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string, nowMs: number): Promise<string> {
  const expires = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS;
  return `${expires}.${await sign(secret, `session:${expires}`)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  nowMs: number,
): Promise<boolean> {
  if (!token || !secret) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  if (Number(expires) * 1000 <= nowMs) return false;
  return sameText(signature, await sign(secret, `session:${expires}`));
}

/** Cocokkan password tanpa membocorkan panjang atau isi lewat waktu respons. */
export async function passwordMatches(input: string, expected: string | undefined, secret: string | undefined) {
  if (!expected || !secret) return false;
  return sameText(await sign(secret, `password:${input}`), await sign(secret, `password:${expected}`));
}

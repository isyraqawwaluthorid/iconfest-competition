import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/admin/token";

const bodySchema = z.object({ password: z.string().min(1).max(200) });
const FAILURE_DELAY_MS = 800; // memperlambat tebak-tebakan password

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const secret = process.env.ADMIN_SESSION_SECRET;
  const ok = parsed.success && (await passwordMatches(parsed.data.password, process.env.ADMIN_PASSWORD, secret));
  if (!ok || !secret) {
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    return NextResponse.json({ error: "Password salah." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(secret, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

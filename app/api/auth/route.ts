import { rateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import {
  apiError,
  checkOrigin,
  HttpError,
  localMode,
  signToken,
} from "@/lib/auth";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit(req, "auth", 20);
    const body = await req.json(),
      jar = await cookies();
    const options = {
      httpOnly: true,
      sameSite: "strict" as const,
      secure: !localMode(),
      path: "/",
      maxAge: 3600,
    };
    if (
      body.local === true &&
      localMode() &&
      ["127.0.0.1", "localhost", "[::1]"].includes(new URL(req.url).hostname)
    ) {
      jar.set(
        "hq_local",
        signToken({ role: "local", exp: Date.now() + 8 * 3600000 }),
        { ...options, maxAge: 8 * 3600 },
      );
      return Response.json({ ok: true });
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)
      throw new HttpError(503, "Connect Supabase to enable account sign-in.");
    if (typeof body.email !== "string" || typeof body.password !== "string")
      throw new HttpError(400, "Enter your email and password.");
    const res = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: body.email, password: body.password }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok)
      throw new HttpError(
        401,
        "Sign-in failed. Check your email and password.",
      );
    const data: { access_token: string; expires_in: number } = await res.json();
    jar.set("hq_access", data.access_token, {
      ...options,
      maxAge: data.expires_in,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    const jar = await cookies();
    jar.delete("hq_access");
    jar.delete("hq_local");
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

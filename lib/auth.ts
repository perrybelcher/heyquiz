import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export const localMode = () => process.env.HEYQUIZ_LOCAL_MODE === "1" && process.env.VERCEL !== "1";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function secret() {
  const v = process.env.SESSION_SECRET;
  if (!v || v.length < 32)
    throw new HttpError(503, "Set a SESSION_SECRET of at least 32 characters.");
  return v;
}
export function signToken(data: Record<string, unknown>) {
  const p = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${p}.${createHmac("sha256", secret()).update(p).digest("base64url")}`;
}
export function verifyToken(token: string): Record<string, unknown> | null {
  const [p, s] = token.split(".");
  if (!p || !s) return null;
  const expected = createHmac("sha256", secret()).update(p).digest(),
    actual = Buffer.from(s, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;
  try {
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return typeof d.exp === "number" && d.exp > Date.now() ? d : null;
  } catch {
    return null;
  }
}
export async function currentUser(): Promise<{ id: string } | null> {
  const jar = await cookies(),
    local = jar.get("hq_local")?.value;
  if (localMode() && local && verifyToken(local)?.role === "local")
    return { id: "local" };
  const access = jar.get("hq_access")?.value;
  if (!access || !process.env.SUPABASE_URL || !(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY))
    return null;
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)!,
      Authorization: `Bearer ${access}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const user: { id?: string } = await res.json();
  return user.id ? { id: user.id } : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to manage your quizzes.");
  return user;
}
export async function requirePageUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !== (req.headers.get("host") || new URL(req.url).host)
  )
    throw new HttpError(403, "This request came from another site.");
}
export function apiError(e: unknown) {
  const message = e instanceof Error ? e.message : "Request failed.";
  const status =
    e instanceof HttpError
      ? e.status
      : e instanceof Error && e.name === "ZodError"
        ? 400
        : message.includes("another tab")
          ? 409
          : 400;
  return Response.json({ error: message }, { status });
}

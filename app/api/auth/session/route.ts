import { cookies } from "next/headers";
import { apiError, checkOrigin, currentUser } from "@/lib/auth";
import { ACCOUNT_SESSION_COOKIE, resolveAccountSession } from "@/lib/account-session";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

/** Only foreground clients call this mutation; ordinary server reads do not slide expiry. */
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit(req, "session", 120);
    const jar = await cookies();
    const user = jar.get(ACCOUNT_SESSION_COOKIE)
      ? await resolveAccountSession({ touch: true })
      : await currentUser();
    if (!user) return Response.json({ state: "reauth_required", error: "Sign in to sync your changes." }, { status: 401, headers });
    return Response.json({ state: "authenticated", accountKey: user.accountKey, expiresAt: user.expiresAt ?? Date.now() + 60000 }, { headers });
  } catch (error) {
    const response = apiError(error), body = await response.json();
    response.headers.set("Cache-Control", headers["Cache-Control"]);
    return Response.json({ ...body, state: response.status === 401 ? "reauth_required" : "unavailable" }, { status: response.status, headers: response.headers });
  }
}

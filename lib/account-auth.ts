import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { HttpError, localMode, signToken, verifyToken } from "./auth";

export const authCookies = () => ({
  httpOnly: true,
  secure: !localMode(),
  sameSite: "lax" as const,
  path: "/",
});
export function emailAddress(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw new HttpError(400, "Enter a valid email address.");
  return value.trim().toLowerCase();
}
export function newPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new HttpError(400, "Use a password between 12 and 128 characters.");
  return value;
}
export async function authRequest(
  path: string,
  body?: unknown,
  access?: string,
  method = "POST",
) {
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key)
    throw new HttpError(
      503,
      "Account service is not configured. Please contact support.",
    );
  let res: Response;
  try {
    res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(
      503,
      "Account service is temporarily unavailable. Please try again.",
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data.error_code || data.code;
    if (res.status === 429)
      throw new HttpError(
        429,
        "Too many attempts. Please wait a few minutes and try again.",
      );
    if (
      code === "email_address_not_authorized" ||
      code === "unexpected_failure" ||
      res.status >= 500
    )
      throw new HttpError(
        503,
        "We couldn’t send your email. Please contact support or try again later.",
      );
    if (code === "invalid_credentials")
      throw new HttpError(
        401,
        "Sign-in failed. Check your email and password.",
      );
    if (code === "email_not_confirmed")
      throw new HttpError(
        401,
        "Confirm your email before signing in. Use ‘Resend confirmation’ if you need a new link.",
      );
    if (code === "weak_password")
      throw new HttpError(
        400,
        "Choose a stronger password with at least 12 characters.",
      );
    if (code === "signup_disabled")
      throw new HttpError(
        503,
        "Registration is temporarily unavailable. Please contact support.",
      );
    throw new HttpError(
      400,
      "This request could not be completed. Check your details or request a new email link.",
    );
  }
  return data;
}
export async function setAccountSession(data: {
  access_token?: string;
  expires_in?: number;
}) {
  if (!data.access_token || typeof data.expires_in !== "number")
    throw new HttpError(502, "Account service returned an invalid session.");
  (await cookies()).set("hq_access", data.access_token, {
    ...authCookies(),
    maxAge: Math.min(data.expires_in, 3600),
  });
}
// The verifier stays HttpOnly. A stolen email authorization code alone cannot create a session.
export async function beginEmailFlow(kind: "signup" | "recovery") {
  const verifier = randomBytes(32).toString("base64url");
  const signed = signToken({
    role: "email-flow",
    kind,
    verifier,
    exp: Date.now() + 3600000,
  });
  return {
    challenge: {
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "s256",
    },
    // A failed resend must not invalidate the link already in the user's inbox.
    persist: async () =>
      (await cookies()).set("hq_email_flow", signed, {
        ...authCookies(),
        maxAge: 3600,
      }),
  };
}

export async function emailFlow() {
  const raw = (await cookies()).get("hq_email_flow")?.value;
  const flow = raw ? verifyToken(raw) : null;
  if (
    !flow ||
    flow.role !== "email-flow" ||
    typeof flow.verifier !== "string" ||
    !["signup", "recovery"].includes(String(flow.kind))
  )
    throw new HttpError(
      400,
      "Open the email link in the same browser where you requested it. If it has expired, request a new link.",
    );
  return flow;
}
export function callbackUrl() {
  // Never derive email destinations from an untrusted Host / forwarded header.
  const origin = process.env.APP_URL || "https://heyquiz-fawn.vercel.app";
  return new URL("/auth/callback", origin).toString();
}

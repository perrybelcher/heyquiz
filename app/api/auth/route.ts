import {
  authRequest,
  emailAddress,
  setAccountSession,
} from "@/lib/account-auth";
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
    const email = emailAddress(body.email);
    if (
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 128
    )
      throw new HttpError(400, "Enter your email and password.");
    const data = await authRequest("token?grant_type=password", {
      email,
      password: body.password,
    });
    await setAccountSession(data);
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
    jar.delete("hq_email_flow");
    jar.delete("hq_recovery");
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

import { cookies } from "next/headers";
import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  authCookies,
  authRequest,
  beginEmailFlow,
  callbackUrl,
  emailAddress,
  emailFlow,
  newPassword,
  setAccountSession,
} from "@/lib/account-auth";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit(req, "account", 10);
    const body = await req.json();
    const jar = await cookies();
    if (body.action === "signup") {
      const email = emailAddress(body.email),
        password = newPassword(body.password);
      const challenge = await beginEmailFlow("signup");
      const data = await authRequest(
        `signup?redirect_to=${encodeURIComponent(callbackUrl(req.url))}`,
        { email, password, ...challenge.challenge },
      );
      await challenge.persist();
      if (data.access_token) {
        await setAccountSession(data);
        jar.delete("hq_email_flow");
        return Response.json({ next: "/" });
      }
      return Response.json({
        message:
          "Check your inbox to confirm your email, then open the link in this browser. If you already have an account, sign in or reset your password.",
      });
    }
    if (body.action === "recover" || body.action === "resend") {
      const email = emailAddress(body.email);
      // Resend confirmation through signup's PKCE flow requires the original password.
      // Existing users may safely restart signup; Supabase returns an enumeration-safe response.
      if (body.action === "resend") {
        const password = newPassword(body.password);
        const challenge = await beginEmailFlow("signup");
        await authRequest(
          `signup?redirect_to=${encodeURIComponent(callbackUrl(req.url))}`,
          { email, password, ...challenge.challenge },
        );
        await challenge.persist();
      } else {
        const challenge = await beginEmailFlow("recovery");
        await authRequest(
          `recover?redirect_to=${encodeURIComponent(callbackUrl(req.url))}`,
          { email, ...challenge.challenge },
        );
        await challenge.persist();
      }
      return Response.json({
        message:
          "If this address is eligible, an email is on its way. Open the link in this browser. Check spam too, and wait a minute before requesting another.",
      });
    }
    if (body.action === "exchange") {
      const flow = await emailFlow();
      if (
        typeof body.code !== "string" ||
        body.code.length < 8 ||
        body.code.length > 2048
      )
        throw new HttpError(
          400,
          "Invalid email link. Please request a new one.",
        );
      const data = await authRequest("token?grant_type=pkce", {
        auth_code: body.code,
        code_verifier: flow.verifier,
      });
      if (!data.access_token)
        throw new HttpError(
          400,
          "This email link has expired. Request a new one.",
        );
      jar.delete("hq_email_flow");
      if (flow.kind === "recovery") {
        // Recovery has its own short-lived cookie; it never silently signs into a workspace.
        jar.set("hq_recovery", data.access_token, {
          ...authCookies(),
          maxAge: 600,
        });
        return Response.json({ next: "/reset-password" });
      }
      await setAccountSession(data);
      return Response.json({ next: "/" });
    }
    if (body.action === "reset") {
      const password = newPassword(body.password),
        token = jar.get("hq_recovery")?.value;
      if (!token)
        throw new HttpError(
          401,
          "Your reset link has expired. Request a new one.",
        );
      await authRequest("user", { password }, token, "PUT");
      jar.delete("hq_recovery");
      jar.delete("hq_access");
      return Response.json({ next: "/login?reset=success" });
    }
    throw new HttpError(400, "Unknown account action.");
  } catch (error) {
    return apiError(error);
  }
}

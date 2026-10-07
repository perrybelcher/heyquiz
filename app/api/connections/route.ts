import { apiError, requireUser, localMode } from "@/lib/auth";
import { cloudEnabled } from "@/lib/records";
export async function GET() {
  try {
    await requireUser();
    return Response.json({
      ai: Boolean(process.env.GEMINI_API_KEY),
      cloud: cloudEnabled(),
      auth: !localMode() && Boolean(process.env.SUPABASE_ANON_KEY),
      captcha: Boolean(
        process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY,
      ),
    });
  } catch (e) {
    return apiError(e);
  }
}

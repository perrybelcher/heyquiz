export async function GET() {
  return Response.json({
    turnstileConfigured: Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY),
    aiAvailable: Boolean(process.env.GEMINI_API_KEY),
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
  });
}

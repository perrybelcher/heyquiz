export async function GET() {
  return Response.json({
    aiAvailable: Boolean(process.env.GEMINI_API_KEY),
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
  });
}

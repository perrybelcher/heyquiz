import { HttpError } from "./auth";
/** Never return provider bodies: they may echo submitted content or credentials. */
export async function aiProviderError(response: Response): Promise<HttpError> {
  const body = await response.json().catch(() => null);
  const message = typeof body?.error?.message === "string" ? body.error.message : "";
  const reasons: string[] = Array.isArray(body?.error?.details)
    ? body.error.details.map((d: { reason?: string }) => d.reason || "") : [];
  let category = "provider";
  let advice = "The AI service could not create this draft. Please try again.";
  if (reasons.includes("API_KEY_INVALID") || /API key not valid|API_KEY_INVALID/i.test(message)) {
    category = "invalid_key"; advice = "The AI connection key is invalid. The workspace administrator needs to update the Gemini API key.";
  } else if (response.status === 401 || response.status === 403) {
    category = "access"; advice = "The AI connection was denied. The workspace administrator needs to check the Gemini key permissions and project access.";
  } else if (response.status === 429) {
    category = "quota"; advice = "The AI provider's usage limit has been reached. Try later, or ask the workspace administrator to check Gemini quota and billing.";
  } else if (response.status === 404) {
    category = "model"; advice = "The configured AI model is unavailable. The workspace administrator needs to update the model configuration.";
  } else if (response.status === 400) {
    category = /schema|generation_config|generationConfig/i.test(message) ? "request_schema" : "request";
    advice = category === "request_schema" ? "The AI provider rejected the quiz format. The application needs a generation-format update." : "The AI provider rejected the request configuration. The workspace administrator needs to check the AI setup.";
  }
  console.error("AI provider rejection", { status: response.status, category });
  return new HttpError(response.status === 429 ? 503 : 502, `${advice} Your brief is safe; you can create a starter without AI.`);
}

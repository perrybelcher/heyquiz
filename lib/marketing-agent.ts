import { aiProviderError } from "./ai-provider-error";
import { z } from "zod";
import { HttpError } from "./auth";
import { MarketingBriefSchema, MarketingDraftSchema, compileMarketingDraft, marketingSystemPrompt } from "./marketing-brief";

// One fresh retry for malformed/invalid drafts; never retry configuration or quota errors.
// Both attempts share a deadline below the route's 90-second execution limit.
export async function generateMarketingQuiz(input: unknown) {
  const brief = MarketingBriefSchema.parse(input);
  if (!process.env.GEMINI_API_KEY) throw new HttpError(503, "AI creation is not connected yet. Your brief is still here. You can use a quiz starter while the AI connection is configured.");
  const schema = z.toJSONSchema(MarketingDraftSchema);
  const deadline = Date.now() + 75000;
  let repair = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || "gemini-3.5-flash-lite")}:generateContent`, {
        method: "POST",
        headers: {"Content-Type":"application/json", "x-goog-api-key":process.env.GEMINI_API_KEY},
        body: JSON.stringify({
          systemInstruction:{parts:[{text:marketingSystemPrompt + "\nReturn one JSON object matching this schema exactly: " + JSON.stringify(schema) + repair}]},
          contents:[{role:"user",parts:[{text:JSON.stringify(brief)}]}],
          generationConfig:{responseMimeType:"application/json",temperature:0.4,maxOutputTokens:16384},
        }),
        signal: AbortSignal.timeout(Math.max(1, Math.min(40000, deadline - Date.now()))),
      });
    } catch (error) {
      if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
        throw new HttpError(504, "The AI service took too long. Your brief is still here. Try again or create a starter without AI.");
      throw new HttpError(502, "We could not reach the AI service. Your brief is still here. Try again or create a starter without AI.");
    }
    if (!res.ok) throw await aiProviderError(res);
    try {
      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (data.promptFeedback?.blockReason || (candidate?.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)))
        throw new HttpError(422, "The AI service could not respond to this brief. Review its wording or create a starter without AI. Your brief is still here.");
      const raw = candidate?.content?.parts?.filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text || "").join("") || "";
      const json = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      return compileMarketingDraft(brief, JSON.parse(json));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // Log classifications only: no brief, model output, or provider body.
      const category = error instanceof SyntaxError ? "invalid_json" : "invalid_draft";
      const issues = error instanceof z.ZodError
        ? error.issues.map(i=>({code:i.code,path:i.path})).slice(0,12)
        : error instanceof Error && error.message.startsWith("The draft") ? error.message : category;
      console.warn("AI draft rejected", {attempt:attempt + 1,category,issues});
      repair = "\nValidation errors to correct: " + JSON.stringify(issues) + "\nA previous attempt failed validation. Generate a fresh complete draft. Return valid JSON only, with all required fields. Recheck exact question/result counts, unique answers, neutral options with empty weights, and zero-based target indexes. Every result must have a clear answer path that selects it; avoid scoring every option equally across results. Scorecard questions must measure one category each with a zero and a positive score.";
      if (attempt === 1 || Date.now() >= deadline)
        throw new HttpError(502, "The AI draft still did not pass our scoring and structure checks after one automatic retry. Nothing was saved. Your brief is still here. Try again or create a starter without AI.");
    }
  }
  throw new HttpError(502, "Could not generate a validated draft. Your brief is still here.");
}

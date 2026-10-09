import { aiProviderError } from "./ai-provider-error";
import { z } from "zod";
import { HttpError } from "./auth";
import { MarketingBriefSchema, MarketingDraftSchema, compileMarketingDraft, marketingSystemPrompt } from "./marketing-brief";

export async function generateMarketingQuiz(input: unknown) {
  const brief = MarketingBriefSchema.parse(input);
  if (!process.env.GEMINI_API_KEY) throw new HttpError(503, "AI creation is not connected yet. Your brief is still here. You can use a quiz starter while the AI connection is configured.");
  const schema = z.toJSONSchema(MarketingDraftSchema);
  let res: Response;
  try { res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || "gemini-3.5-flash-lite")}:generateContent`, {
    method: "POST", headers: {"Content-Type":"application/json", "x-goog-api-key":process.env.GEMINI_API_KEY},
    body: JSON.stringify({systemInstruction:{parts:[{text:marketingSystemPrompt + "\nReturn one JSON object matching this schema exactly: " + JSON.stringify(schema)}]},contents:[{role:"user",parts:[{text:JSON.stringify(brief)}]}],generationConfig:{responseMimeType:"application/json",temperature:0.4}}),
    signal: AbortSignal.timeout(60000),
  }); } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
      throw new HttpError(504, "The AI service took too long. Your brief is still here. Try again or create a starter without AI.");
    throw new HttpError(502, "We could not reach the AI service. Your brief is still here. Try again or create a starter without AI.");
  }
  if (!res.ok) throw await aiProviderError(res);
  try {
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text || "").join("");
    console.info("AI response shape", {finishReason:data.candidates?.[0]?.finishReason, blockReason:data.promptFeedback?.blockReason, textLength:raw?.length || 0, fenced:raw?.trim().startsWith("```"), parts:data.candidates?.[0]?.content?.parts?.map((p:Record<string,unknown>)=>Object.keys(p))});
    const json = (raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return compileMarketingDraft(brief, JSON.parse(json));
  }
  catch (error) {
    console.error("AI draft validation", error instanceof z.ZodError ? error.issues.map(issue => ({code:issue.code,path:issue.path})) : error instanceof SyntaxError ? "invalid_json" : error instanceof Error ? error.message : "unknown");
    throw new HttpError(502, "The AI draft did not pass our scoring and structure checks. Nothing was saved. Please try again or simplify your brief."); }
}

import { z } from "zod";
import { HttpError } from "./auth";
import { MarketingBriefSchema, MarketingDraftSchema, compileMarketingDraft, marketingSystemPrompt } from "./marketing-brief";

export async function generateMarketingQuiz(input: unknown) {
  const brief = MarketingBriefSchema.parse(input);
  if (!process.env.GEMINI_API_KEY) throw new HttpError(503, "AI creation is not connected yet. Your brief is still here. You can use a quiz starter while the AI connection is configured.");
  const schema = z.toJSONSchema(MarketingDraftSchema);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || "gemini-2.5-flash")}:generateContent`, {
    method: "POST", headers: {"Content-Type":"application/json", "x-goog-api-key":process.env.GEMINI_API_KEY},
    body: JSON.stringify({systemInstruction:{parts:[{text:marketingSystemPrompt}]},contents:[{role:"user",parts:[{text:JSON.stringify(brief)}]}],generationConfig:{responseMimeType:"application/json",responseJsonSchema:schema,temperature:0.4}}),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new HttpError(502, "The AI service could not create this draft. Your brief is safe; please try again.");
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text || "").join("");
  try { return compileMarketingDraft(brief, JSON.parse(raw || "")); }
  catch { throw new HttpError(502, "The AI draft did not pass our scoring and structure checks. Nothing was saved. Please try again or simplify your brief."); }
}

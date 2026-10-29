import { createHash } from "node:crypto";
import { z } from "zod";
import { QuizTypeSchema } from "./quiz-types";
import { previewQuizConversion } from "./quiz-conversion";
import { ownedForm, saveForm } from "./storage";
import { readRecord, writeRecord } from "./records";
import { ConflictError, HttpError } from "./errors";
import type { FormSchemaType } from "./schema";
export const ConversionRequestSchema = z.object({ action: z.enum(["preview", "create"]), targetType: QuizTypeSchema, sourceRevision: z.number().int().positive(), idempotencyKey: z.string().min(8).max(200).optional() }).superRefine((v,ctx) => { if(v.action === "create" && !v.idempotencyKey) ctx.addIssue({code:"custom",path:["idempotencyKey"],message:"Supply an idempotency key when creating a copy."}); });
type Reservation = { sourceId:string; sourceRevision:number; targetType:z.infer<typeof QuizTypeSchema>; form:FormSchemaType };
export async function convertOwnedQuiz(owner: string, sourceId: string, input: unknown) {
  const request = ConversionRequestSchema.parse(input);
  // Check source ownership even on retries; the idempotency record is never an access grant.
  const source = await ownedForm(sourceId, owner);
  if (!source) throw new HttpError(404,"Quiz not found.");
  if (request.action === "preview") {
    if(source.revision !== request.sourceRevision) throw new ConflictError();
    return {changes:previewQuizConversion(source,request.targetType).changes};
  }
  const key = createHash("sha256").update(JSON.stringify([owner,sourceId,request.idempotencyKey])).digest("hex");
  let reservation = await readRecord<Reservation>("quiz_conversions",key);
  if (!reservation) {
    if(source.revision !== request.sourceRevision) throw new ConflictError();
    const {form} = previewQuizConversion(source,request.targetType);
    form.id = `quiz-converted-${key.slice(0,40)}`;
    const payload:Reservation={sourceId,sourceRevision:request.sourceRevision,targetType:request.targetType,form};
    try { reservation = await writeRecord("quiz_conversions",key,owner,payload,0); }
    catch(error) { reservation=await readRecord<Reservation>("quiz_conversions",key); if(!reservation) throw error; }
  }
  if(reservation.owner_id !== owner) throw new HttpError(404,"Quiz not found.");
  const savedRequest=reservation.payload;
  if(savedRequest.sourceId !== sourceId || savedRequest.sourceRevision !== request.sourceRevision || savedRequest.targetType !== request.targetType) throw new HttpError(409,"This conversion key belongs to a different request. Start a new conversion.");
  const existing = await ownedForm(savedRequest.form.id,owner);
  if(existing) return {form:existing};
  try { return {form:await saveForm(savedRequest.form,owner)}; }
  catch(error) { const concurrent=await ownedForm(savedRequest.form.id,owner); if(concurrent) return {form:concurrent}; throw error; }
}

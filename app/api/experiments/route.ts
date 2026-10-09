import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { listRecords, readRecord, writeRecord } from "@/lib/records";
import { experimentStats, type Experiment } from "@/lib/experiments";
import type { Attempt } from "@/lib/attempts";
import type { FormSchemaType, QuizSubmissionResult } from "@/lib/schema";
const input = z.object({ name: z.string().trim().min(1).max(120), a: z.string().regex(/^[\w-]{1,128}$/), b: z.string().regex(/^[\w-]{1,128}$/) });
export async function GET() {
  try {
    const user = await requireUser();
    const [experiments, forms, attempts, submissions] = await Promise.all([listRecords<Experiment>("experiments", user.id), listRecords<FormSchemaType>("published", user.id), listRecords<Attempt>("attempts", user.id), listRecords<QuizSubmissionResult>("submissions", user.id)]);
    const saved = new Map(submissions.map(s => [s.id, s.payload]));
    const measured = attempts.map(a => ({ ...a.payload, completed: Boolean(a.payload.completed || saved.has(a.id)), result: saved.get(a.id) }));
    return Response.json({ forms: forms.map(r => ({ id: r.id, title: r.payload.title })), experiments: experiments.map(r => ({ id: r.id, name: r.payload.name, active: r.payload.active, createdAt: r.payload.createdAt, titles: r.payload.variants.map(f => f.title), stats: experimentStats(r.id, measured) })).sort((a,b) => b.createdAt-a.createdAt) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return apiError(e); }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await requireUser(), body = input.parse(await req.json());
    if (body.a === body.b) throw new HttpError(400, "Choose two different published quizzes.");
    const forms = await Promise.all([body.a, body.b].map(id => readRecord<FormSchemaType>("published", id)));
    if (forms.some(f => !f || f.owner_id !== user.id)) throw new HttpError(404, "Publish both of your quizzes before creating a test.");
    const id = randomUUID();
    await writeRecord<Experiment>("experiments", id, user.id, { name: body.name, createdAt: Date.now(), active: true, variants: [forms[0]!.payload, forms[1]!.payload] }, 0);
    return Response.json({ id }, { status: 201 });
  } catch (e) { return apiError(e); }
}

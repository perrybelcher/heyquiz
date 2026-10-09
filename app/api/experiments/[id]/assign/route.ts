import { randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, checkOrigin, HttpError, signToken, verifyToken } from "@/lib/auth";
import { readRecord } from "@/lib/records";
import { publicForm } from "@/lib/engine";
import type { Experiment } from "@/lib/experiments";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(req: Request, { params }: { params: Promise<{ id:string }> }) {
  try {
    checkOrigin(req); rateLimit(req, "experiment-assign", 60);
    const { id } = await params, row = await readRecord<Experiment>("experiments", id);
    if (!row?.payload.active) throw new HttpError(410, "This experiment is paused or unavailable.");
    const cookieName = `hq_experiment_${id}`, existing = (await cookies()).get(cookieName)?.value;
    const old = existing ? verifyToken(existing) : null;
    const valid = old?.purpose === "experiment" && old.experimentId === id && typeof old.visitor === "string" && (old.variant === 0 || old.variant === 1);
    const variant = valid ? old.variant as 0 | 1 : randomInt(2) as 0 | 1;
    const token = valid ? existing! : signToken({ purpose: "experiment", experimentId: id, visitor: randomUUID(), variant, exp: Date.now() + 90 * 86400000 });
    const response = NextResponse.json({ token, form: publicForm(row.payload.variants[variant]) }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(cookieName, token, { httpOnly:true, secure: new URL(req.url).protocol === "https:", sameSite:"lax", path:"/", maxAge:90*86400 });
    return response;
  } catch (e) { return apiError(e); }
}

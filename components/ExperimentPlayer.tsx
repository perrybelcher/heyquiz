"use client";
import { useEffect, useState } from "react";
import QuizPlayer from "./QuizPlayer";
import type { FormSchemaType } from "@/lib/schema";
export default function ExperimentPlayer({ id }: { id:string }) {
  const [data, setData] = useState<{ token:string; form:FormSchemaType } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/experiments/${id}/assign`, { method:"POST" }).then(async r => {
      const body = await r.json(); if (!r.ok) throw new Error(body.error);
      if (!cancelled) setData(body);
    }).catch(e => { if (!cancelled) setError(e.message || "Unable to load this quiz."); });
    return () => { cancelled = true; };
  }, [id]);
  if (error) return <main className="max-w-xl mx-auto p-12"><h1 className="text-2xl font-semibold">Quiz unavailable</h1><p role="alert" className="mt-4">{error}</p><button className="hq-primary mt-6" onClick={() => location.reload()}>Try again</button></main>;
  if (!data) return <p role="status" className="p-12 text-center">Loading your quiz…</p>;
  return <QuizPlayer form={data.form} experimentToken={data.token} experimentId={id}/>;
}

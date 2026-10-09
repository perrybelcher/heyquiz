"use client";
import { useState } from "react";
import { Play } from "lucide-react";
import { resultVideoEmbed } from "@/lib/result-video";

export default function ResultVideo({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const src = resultVideoEmbed(url);
  if (!src) return null;
  // Do not contact the video provider until the visitor chooses to load it.
  return loaded === src ? <iframe className="aspect-video w-full rounded-xl border-0" src={src} title={title || "Result video"} allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> :
    <button type="button" onClick={() => setLoaded(src)} className="w-full aspect-video rounded-xl bg-slate-950 text-white flex flex-col items-center justify-center gap-3 p-5">
      <Play size={32} aria-hidden="true"/><span className="font-semibold">Watch {title || "your video"}</span><span className="text-xs text-slate-300">Loads {src.includes("youtube") ? "YouTube" : "Vimeo"} when selected</span>
    </button>;
}

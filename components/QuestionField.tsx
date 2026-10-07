"use client";
import {
  ArrowUp,
  ArrowDown,
  Check,
  Star,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import type { Question } from "@/lib/schema";
import {
  record,
  strings,
  text,
  singleTypes,
  multiTypes,
  type Answers,
} from "@/lib/engine";
import { calculate } from "@/lib/calculation";
import AttachmentField from "./AttachmentField";
import Challenge from "./Challenge";
export default function QuestionField({
  q,
  value,
  onChange,
  answers,
  token,
}: {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  answers: Answers;
  token: string;
}) {
  const obj = record(value),
    str = text(value),
    selected = strings(value);
  const input = (type = "text", placeholder = q.placeholder) => (
    <input
      id={`field-${q.id}`}
      aria-label={q.title}
      className="hq-input"
      type={type}
      placeholder={placeholder}
      value={str}
      min={q.minVal}
      max={q.maxVal}
      step={q.stepVal || "any"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  const group = (keys: { key: string; label: string; type?: string }[]) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {keys.map((k) => (
        <label key={k.key} className="text-sm text-slate-600">
          {k.label}
          <input
            className="hq-input mt-2"
            type={k.type || "text"}
            value={text(obj[k.key])}
            onChange={(e) => onChange({ ...obj, [k.key]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
  if (q.type === "dropdown")
    return (
      <select
        id={`field-${q.id}`}
        aria-label={q.title}
        className="hq-input"
        value={str}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose an option</option>
        {q.options?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  if (singleTypes.has(q.type) || multiTypes.has(q.type)) {
    const multi = multiTypes.has(q.type),
      picture = ["picture_choice", "image_multiselect"].includes(q.type);
    return (
      <div
        className={
          picture ? "grid grid-cols-2 sm:grid-cols-3 gap-3" : "grid gap-3"
        }
        role="group"
        aria-label={q.title}
      >
        {q.options?.map((o) => {
          const active = multi ? selected.includes(o.id) : str === o.id;
          return (
            <label
              key={o.id}
              className={`cursor-pointer rounded-xl border-2 transition overflow-hidden ${active ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300"}`}
            >
              {picture && o.imageUrl && (
                <img
                  src={o.imageUrl}
                  alt={o.label}
                  className={`w-full object-cover ${q.pictureAspectRatio === "portrait" ? "aspect-[3/4]" : q.pictureAspectRatio === "landscape" ? "aspect-video" : "aspect-square"}`}
                />
              )}
              <span className="flex items-center gap-3 p-4">
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={q.id}
                  checked={active}
                  className="w-4 h-4 accent-indigo-600"
                  onChange={() =>
                    onChange(
                      multi
                        ? active
                          ? selected.filter((id) => id !== o.id)
                          : [...selected, o.id]
                        : o.id,
                    )
                  }
                />
                <span>{o.label}</span>
                {active && (
                  <Check className="ml-auto text-indigo-600" size={18} />
                )}
              </span>
            </label>
          );
        })}
      </div>
    );
  }
  switch (q.type) {
    case "short_answer":
      return input();
    case "email":
      return input("email");
    case "phone":
      return input("tel");
    case "website":
      return input("url", "https://example.com");
    case "number":
    case "currency":
      return input("number");
    case "password":
      return input("password");
    case "paragraph":
      return (
        <textarea
          id={`field-${q.id}`}
          aria-label={q.title}
          className="hq-input min-h-36 resize-y"
          placeholder={q.placeholder || "Share your thoughts…"}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "full_name":
      return group([
        { key: "firstName", label: "First name" },
        { key: "lastName", label: "Last name" },
      ]);
    case "address":
      return group([
        { key: "street", label: "Street address" },
        { key: "city", label: "City" },
        { key: "state", label: "State / region" },
        { key: "zip", label: "Postal code" },
      ]);
    case "checkbox":
    case "terms":
      return (
        <label className="flex gap-3 items-start p-5 border border-slate-200 rounded-xl">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-1 h-5 w-5 accent-indigo-600"
          />
          <span>
            {q.termsText || q.placeholder || "I confirm and acknowledge"}
            {q.termsUrl && /^https?:\/\//.test(q.termsUrl) && (
              <a
                href={q.termsUrl}
                target="_blank"
                rel="noreferrer"
                className="block mt-2 text-indigo-600 underline"
              >
                Read the terms
              </a>
            )}
          </span>
        </label>
      );
    case "choice_matrix":
    case "matrix_multiselect":
      return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-4 text-left">Statement</th>
                {q.columns?.map((c) => (
                  <th key={c} className="p-4 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.rows?.map((row) => (
                <tr key={row} className="border-t border-slate-100">
                  <th scope="row" className="p-4 text-left font-medium">
                    {row}
                  </th>
                  {q.columns?.map((col) => (
                    <td key={col} className="p-4 text-center">
                      <input
                        aria-label={`${row}: ${col}`}
                        type={q.type === "choice_matrix" ? "radio" : "checkbox"}
                        name={`${q.id}-${row}`}
                        checked={
                          q.type === "choice_matrix"
                            ? obj[row] === col
                            : strings(obj[row]).includes(col)
                        }
                        onChange={() =>
                          onChange({
                            ...obj,
                            [row]:
                              q.type === "choice_matrix"
                                ? col
                                : strings(obj[row]).includes(col)
                                  ? strings(obj[row]).filter((x) => x !== col)
                                  : [...strings(obj[row]), col],
                          })
                        }
                        className="h-4 w-4 accent-indigo-600"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "ranking": {
      const items = selected.length ? selected : q.items || [];
      return (
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
            >
              <span className="text-indigo-600 font-mono w-6">{i + 1}</span>
              <span className="flex-1">{item}</span>
              {[-1, 1].map((d) => (
                <button
                  key={d}
                  aria-label={`Move ${item} ${d < 0 ? "up" : "down"}`}
                  disabled={i + d < 0 || i + d >= items.length}
                  className="hq-icon disabled:opacity-20"
                  onClick={() => {
                    const next = [...items];
                    [next[i], next[i + d]] = [next[i + d], next[i]];
                    onChange(next);
                  }}
                >
                  {d < 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                </button>
              ))}
            </li>
          ))}
        </ol>
      );
    }
    case "rating":
    case "opinion_scale":
    case "nps":
    case "emoji_rating": {
      const min = q.minRating ?? (q.type === "nps" ? 0 : 1),
        max = Math.min(q.maxRating ?? (q.type === "nps" ? 10 : 5), 20);
      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {Array.from(
              { length: Math.max(1, max - min + 1) },
              (_, i) => i + min,
            ).map((n) => (
              <button
                key={n}
                aria-label={`${n} ${q.type === "rating" ? "stars" : "out of " + max}`}
                aria-pressed={Number(value) === n && value !== undefined}
                onClick={() => onChange(n)}
                className={`h-12 min-w-12 px-3 rounded-xl border transition ${Number(value) === n && value !== undefined ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 hover:border-indigo-400"}`}
              >
                {q.type === "rating" ? (
                  <span className="flex items-center gap-1">
                    <Star size={17} />
                    {n}
                  </span>
                ) : q.type === "emoji_rating" ? (
                  ["😞", "🙁", "😐", "🙂", "😍"][n - 1] || n
                ) : (
                  n
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-3">
            <span>{q.ratingLabels?.low}</span>
            <span>{q.ratingLabels?.high}</span>
          </div>
        </div>
      );
    }
    case "slider":
      return (
        <div className="space-y-4">
          <output className="text-4xl font-semibold text-indigo-600">
            {str || q.minVal || 0}
          </output>
          <input
            aria-label={q.title}
            type="range"
            className="w-full accent-indigo-600"
            min={q.minVal ?? 0}
            max={q.maxVal ?? 100}
            step={q.stepVal ?? 1}
            value={str || q.minVal || 0}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>{q.minVal ?? 0}</span>
            <span>{q.maxVal ?? 100}</span>
          </div>
        </div>
      );
    case "date":
      return input("date");
    case "time":
      return input("time");
    case "datetime":
      return group([
        { key: "date", label: "Date", type: "date" },
        { key: "time", label: "Time", type: "time" },
      ]);
    case "date_range":
      return group([
        { key: "start", label: "Start date", type: "date" },
        { key: "end", label: "End date", type: "date" },
      ]);
    case "scheduler":
      return (
        <div>
          <p className="text-sm text-slate-500 mb-3">
            Select a preferred time. Your response is a request, not a confirmed
            booking.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {q.timeSlots?.map((slot) => (
              <button
                key={slot}
                onClick={() => onChange(slot)}
                className={str === slot ? "hq-primary" : "hq-secondary"}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      );
    case "file_upload":
    case "image_upload":
    case "audio_recorder":
      return (
        <AttachmentField
          value={value}
          onChange={onChange}
          token={token}
          imageOnly={q.type === "image_upload"}
          audio={q.type === "audio_recorder"}
          limit={q.maxFileSizeMB}
        />
      );
    case "signature":
      return (
        <div>
          {input("text", "Type your full name")}
          <p className="text-xs text-slate-500 mt-3">
            Your typed name will be saved with this response.
          </p>
        </div>
      );
    case "color_picker":
      return (
        <div className="flex items-center gap-4">
          <input
            aria-label={q.title}
            type="color"
            value={str || "#4f46e5"}
            onChange={(e) => onChange(e.target.value)}
            className="w-16 h-14"
          />
          <output className="font-mono">{str || "#4f46e5"}</output>
        </div>
      );
    case "divider":
      return <hr className="border-slate-200" />;
    case "heading":
    case "banner":
      return <p className="text-slate-500">{q.description}</p>;
    case "subheading":
      return <p className="text-lg text-slate-600">{q.subheadingText}</p>;
    case "rich_text":
      return (
        <div className="space-y-3 leading-relaxed text-slate-600">
          {q.richTextContent?.split("\n").map((line, i) =>
            line.startsWith("#") ? (
              <h3 key={i} className="text-xl font-semibold text-slate-900">
                {line.replace(/^#+\s*/, "")}
              </h3>
            ) : (
              <p key={i}>{line}</p>
            ),
          )}
        </div>
      );
    case "image_display":
      return q.mediaUrl ? (
        <img
          src={q.mediaUrl}
          alt={q.title}
          className="w-full max-h-96 object-contain rounded-2xl"
        />
      ) : (
        <p className="text-slate-500">No image selected.</p>
      );
    case "video_embed": {
      let url = "";
      try {
        const u = new URL(q.videoUrl || "");
        if (["www.youtube.com", "youtube.com"].includes(u.hostname))
          url = `https://www.youtube.com/embed/${u.searchParams.get("v") || u.pathname.split("/").pop()}`;
        if (u.hostname === "youtu.be")
          url = `https://www.youtube.com/embed${u.pathname}`;
        if (["vimeo.com", "player.vimeo.com"].includes(u.hostname))
          url = `https://player.vimeo.com/video/${u.pathname.split("/").pop()}`;
      } catch {}
      return url ? (
        <iframe
          src={url}
          title={q.title}
          className="aspect-video w-full rounded-2xl"
          allowFullScreen
        />
      ) : (
        <p className="text-slate-500">
          Add a YouTube or Vimeo video in the editor.
        </p>
      );
    }
    case "accordion":
      return (
        <div className="space-y-2">
          {q.accordionItems?.map((item) => (
            <details
              key={item.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <summary className="font-medium cursor-pointer">
                {item.title}
              </summary>
              <p className="text-slate-600 mt-3 whitespace-pre-wrap">
                {item.content}
              </p>
            </details>
          ))}
        </div>
      );
    case "calculation": {
      const result = calculate(q.calculationFormula || "", answers);
      return (
        <div className="rounded-2xl bg-indigo-50 p-6">
          <p className="text-xs uppercase tracking-wider text-indigo-600 mb-2">
            Calculated result
          </p>
          <output className="text-3xl font-semibold">
            {result ?? "Formula needs configuration"}
          </output>
        </div>
      );
    }
    case "hidden":
      return null;
    case "captcha":
      return <Challenge onChange={onChange} />;
    default:
      return (
        <div className="flex gap-3">
          {["up", "down"].map((v) => (
            <button
              key={v}
              aria-label={v === "up" ? "Thumbs up" : "Thumbs down"}
              className={str === v ? "hq-primary" : "hq-secondary"}
              onClick={() => onChange(v)}
            >
              {v === "up" ? <ThumbsUp /> : <ThumbsDown />}
            </button>
          ))}
        </div>
      );
  }
}

"use client";
import { useRef, useState, useEffect } from "react";
import { UploadCloud, Mic, Square, FileCheck, Trash2 } from "lucide-react";
import { record, text } from "@/lib/engine";
export default function AttachmentField({
  value,
  onChange,
  token,
  imageOnly = false,
  audio = false,
  limit = 10,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  token: string;
  imageOnly?: boolean;
  audio?: boolean;
  limit?: number;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    parts = useRef<Blob[]>([]),
    input = useRef<HTMLInputElement>(null);
  const file = record(value);
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function upload(blob: File) {
    setError("");
    if (blob.size > Math.min(limit, 10) * 1024 * 1024) {
      setError(`Choose a file up to ${Math.min(limit, 10)} MB.`);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", blob);
      body.set("token", token);
      const res = await fetch("/api/media", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    try {
      setError("");
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mime = ["audio/webm", "audio/ogg", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      recorder.current = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      parts.current = [];
      recorder.current.ondataavailable = (e) => {
        if (e.data.size) parts.current.push(e.data);
      };
      recorder.current.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const type = recorder.current?.mimeType || "audio/webm";
        void upload(
          new File(
            parts.current,
            `voice-response.${type.includes("ogg") ? "ogg" : type.includes("mp4") ? "mp4" : "webm"}`,
            { type },
          ),
        );
      };
      recorder.current.start();
      setRecording(true);
    } catch {
      setError(
        "Microphone access is unavailable. Allow access or upload an audio file.",
      );
    }
  }
  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label={
          audio ? "Upload audio" : imageOnly ? "Upload image" : "Upload file"
        }
        accept={
          audio
            ? "audio/*"
            : imageOnly
              ? "image/jpeg,image/png,image/webp,image/gif"
              : ".pdf,.txt,.csv,.docx,image/jpeg,image/png,image/webp,image/gif"
        }
        onChange={(e) => {
          if (e.target.files?.[0]) void upload(e.target.files[0]);
        }}
      />
      {file.id ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex gap-3 items-center">
            <FileCheck className="text-emerald-600" />
            <div className="flex-1">
              <p className="font-medium">{text(file.name)}</p>
              <p className="text-xs text-slate-500">
                Uploaded · {Math.ceil(Number(file.size) / 1024)} KB
              </p>
            </div>
            <button
              aria-label="Remove attachment"
              className="hq-icon"
              onClick={() => onChange(undefined)}
            >
              <Trash2 size={18} />
            </button>
          </div>
          {audio && (
            <audio controls src={text(file.url)} className="mt-4 w-full" />
          )}
          {imageOnly && (
            <img
              alt="Your uploaded image"
              src={text(file.url)}
              className="mt-4 max-h-52 rounded-xl"
            />
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) void upload(e.dataTransfer.files[0]);
          }}
          className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50"
        >
          <UploadCloud className="mx-auto mb-3 text-indigo-500" />
          <p className="font-medium">
            {busy
              ? "Uploading your file…"
              : audio
                ? "Record a voice response"
                : imageOnly
                  ? "Drop your image here"
                  : "Drop a file here"}
          </p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Up to {Math.min(limit, 10)} MB
          </p>
          {audio && (
            <button
              disabled={busy}
              className="hq-primary mr-3"
              onClick={() =>
                recording ? recorder.current?.stop() : void start()
              }
            >
              {recording ? <Square size={16} /> : <Mic size={16} />}{" "}
              {recording ? "Stop & upload" : "Start recording"}
            </button>
          )}
          <button
            disabled={busy || recording}
            onClick={() => input.current?.click()}
            className="hq-secondary"
          >
            Browse files
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="hq-error">
          {error}
        </p>
      )}
    </div>
  );
}

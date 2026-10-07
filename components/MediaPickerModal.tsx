"use client";
import { useState } from "react";
import {
  X,
  Image as ImageIcon,
  UploadCloud,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import AttachmentField from "./AttachmentField";
import { record, text } from "@/lib/engine";
const photos = [
  ["Beach ocean sunset", "photo-1507525428034-b723cf961d3e"],
  ["Mountain sunrise nature", "photo-1464822759023-fed622ff2c3b"],
  ["Forest trees nature", "photo-1448375240586-882707db888b"],
  ["Lake mountain landscape", "photo-1493246507139-91e8fad9978e"],
  ["Office meeting teamwork", "photo-1517245386807-bb43f82c33c4"],
  ["Data analytics computer", "photo-1551288049-bebda4e38f71"],
  ["Team people office", "photo-1522071820081-009f0129c71c"],
  ["Earth space planet", "photo-1451187580459-43490279c0fa"],
  ["Technology servers", "photo-1558494949-ef010cbdcc31"],
];
export default function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  initialUrl?: string;
}) {
  const [tab, setTab] = useState<"library" | "upload" | "url">("library"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(initialUrl || ""),
    [url, setUrl] = useState(initialUrl || ""),
    [file, setFile] = useState<unknown>();
  if (!isOpen) return null;
  const valid =
    tab === "url" ? /^https:\/\/[^\s]+$/.test(url) : Boolean(selected);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-title"
      className="fixed inset-0 z-[9999] bg-slate-950/40 backdrop-blur-sm grid place-items-center p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <header className="flex items-center justify-between border-b p-5">
          <h2 id="media-title" className="font-semibold text-lg">
            Choose an image
          </h2>
          <button
            onClick={onClose}
            aria-label="Close image picker"
            className="hq-icon"
          >
            <X size={20} />
          </button>
        </header>
        <nav className="flex gap-3 px-5 pt-4">
          {[
            { id: "library" as const, name: "Photo library", icon: ImageIcon },
            { id: "upload" as const, name: "Upload", icon: UploadCloud },
            { id: "url" as const, name: "Image link", icon: LinkIcon },
          ].map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "hq-primary" : "hq-secondary"}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={16} />
              {t.name}
            </button>
          ))}
        </nav>
        <div className="p-5 max-h-[55vh] overflow-auto">
          {tab === "library" && (
            <>
              <input
                aria-label="Search photo library"
                className="hq-input mb-4"
                placeholder="Search curated photos: nature, team, office…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos
                  .filter(([tags]) =>
                    tags.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map(([tags, id]) => {
                    const src = `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
                    return (
                      <button
                        key={id}
                        aria-label={`Select ${tags}`}
                        aria-pressed={selected === src}
                        className={`relative rounded-xl overflow-hidden border-2 ${selected === src ? "border-indigo-500" : "border-transparent"}`}
                        onClick={() => setSelected(src)}
                      >
                        <img
                          src={src}
                          alt={tags}
                          className="aspect-video w-full object-cover"
                        />
                        {selected === src && (
                          <Check className="absolute right-2 top-2 text-white bg-indigo-600 rounded-full p-1" />
                        )}
                        <span className="block text-xs text-left p-2 capitalize">
                          {tags}
                        </span>
                      </button>
                    );
                  })}
              </div>
              <p className="text-xs text-slate-400 mt-4">
                Curated photography from Unsplash.
              </p>
            </>
          )}
          {tab === "upload" && (
            <AttachmentField
              value={file}
              onChange={(v) => {
                setFile(v);
                setSelected(text(record(v).url));
              }}
              token=""
              imageOnly
            />
          )}
          {tab === "url" && (
            <label className="block text-sm">
              Secure image URL
              <input
                className="hq-input mt-2"
                type="url"
                value={url}
                placeholder="https://…"
                onChange={(e) => setUrl(e.target.value)}
              />
              {valid && (
                <img
                  src={url}
                  alt="Image preview"
                  className="max-h-52 mx-auto mt-5 rounded-xl"
                />
              )}
            </label>
          )}
        </div>
        <footer className="border-t p-5 flex justify-end gap-3">
          <button className="hq-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="hq-primary"
            disabled={!valid}
            onClick={() => {
              onSelect(tab === "url" ? url : selected);
              onClose();
            }}
          >
            Insert image
          </button>
        </footer>
      </section>
    </div>
  );
}

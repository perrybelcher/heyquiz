import { Fragment, useRef, type ReactNode } from "react";

function inline(text: string, allowLinks = true): ReactNode[] {
  const pattern = /\[([^\]\n]+)\]\(([^()\s]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  const nodes: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const [token, label, href, bold, italic] = match;
    const start = match.index;
    nodes.push(text.slice(end, start));
    let link: URL | undefined;
    if (allowLinks && href && /^https?:\/\//i.test(href)) {
      try { link = new URL(href); } catch { /* Keep malformed links as text. */ }
    }
    nodes.push(<Fragment key={start}>
      {link ? <a className="underline" href={link.href}>{inline(label, false)}</a>
        : bold ? <strong>{bold}</strong>
        : italic ? <em>{italic}</em>
        : token}
    </Fragment>);
    end = start + token.length;
  }
  nodes.push(text.slice(end));
  return nodes;
}

export function RichText({ value }: { value: string }) {
  const blocks: ReactNode[] = [];
  const lines = value.split(/\r?\n/);
  const bullet = /^\s*[-*+]\s+/;
  for (let i = 0; i < lines.length;) {
    const start = i;
    const line = lines[i++];
    if (bullet.test(line)) {
      const items = [line];
      while (i < lines.length && bullet.test(lines[i])) items.push(lines[i++]);
      blocks.push(<ul key={start} className="list-disc pl-6">
        {items.map((item, index) => <li key={index}>{inline(item.replace(bullet, ""))}</li>)}
      </ul>);
    } else if (line.startsWith("#")) {
      blocks.push(<h3 key={start} className="text-xl font-semibold text-slate-900">{inline(line.replace(/^#+\s*/, ""))}</h3>);
    } else if (line) {
      blocks.push(<p key={start}>{inline(line)}</p>);
    }
  }
  return <div className="space-y-3 break-words leading-relaxed text-slate-600">{blocks}</div>;
}

const formats = ["Bold", "Italic", "Heading", "Bulleted list", "Link"] as const;

export function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null);
  function format(style: typeof formats[number]) {
    const field = input.current;
    if (!field) return;
    let { selectionStart: start, selectionEnd: end } = field;
    if (style === "Heading" || style === "Bulleted list") {
      start = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
      const nextBreak = value.indexOf("\n", end);
      end = nextBreak < 0 ? value.length : nextBreak;
    }
    const selection = value.slice(start, end);
    const selected = selection || "text";
    const url = "https://example.com";
    const replacement = {
      Bold: "**" + selected + "**",
      Italic: "*" + selected + "*",
      Heading: "# " + selected,
      "Bulleted list": selected.split("\n").map(line => "- " + line).join("\n"),
      Link: "[" + selected + "](" + url + ")",
    }[style];
    onChange(value.slice(0, start) + replacement + value.slice(end));
    requestAnimationFrame(() => {
      field.focus();
      if (style === "Link") {
        const urlEnd = start + replacement.length - 1;
        field.setSelectionRange(urlEnd - url.length, urlEnd);
      } else if (!selection) {
        const textStart = start + replacement.indexOf(selected);
        field.setSelectionRange(textStart, textStart + selected.length);
      } else {
        field.setSelectionRange(start, start + replacement.length);
      }
    });
  }
  return <div className="space-y-2">
    <div role="group" aria-label="Text formatting" className="flex flex-wrap gap-1">
      {formats.map(style => <button key={style} type="button" className="hq-secondary text-xs" onClick={() => format(style)}>{style}</button>)}
    </div>
    <label className="block text-xs font-medium">Rich text content
      <textarea ref={input} rows={4} value={value} onChange={event => onChange(event.target.value)}
        placeholder="Write your content here…" className="hq-input mt-1 w-full" />
    </label>
    <p className="text-xs text-slate-600">Select text to format it. Links must start with http:// or https://.</p>
  </div>;
}

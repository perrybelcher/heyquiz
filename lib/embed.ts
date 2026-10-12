/** Dimensions only: this protocol never carries quiz answers or contact data. */
export const EMBED_VERSION = 1;
export const EMBED_MIN_HEIGHT = 200;
export const EMBED_MAX_HEIGHT = 30000;
export const EMBED_FALLBACK_HEIGHT = 700;

export function validEmbedChannel(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

export function validEmbedHeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= EMBED_MIN_HEIGHT && value <= EMBED_MAX_HEIGHT;
}

export function embedOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

const attribute = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function quizEmbedCode(origin: string, formId: string, title: string, responsive = true): string {
  const safeOrigin = embedOrigin(origin);
  if (!safeOrigin) return "";
  const direct = `${safeOrigin}/play/${encodeURIComponent(formId)}`;
  const frame = `<iframe${responsive ? ' data-pippi-embed' : ''} src="${attribute(direct)}?embed=1" title="${attribute(title.trim() || "Quiz")}" width="100%" height="${EMBED_FALLBACK_HEIGHT}" style="width:100%;height:${EMBED_FALLBACK_HEIGHT}px;border:0;display:block;" loading="lazy" allow="fullscreen"></iframe>`;
  return [frame, ...(responsive ? [`<script src="${attribute(safeOrigin)}/pippi-embed.js" async></script>`] : []), `<p><a href="${attribute(direct)}" target="_blank" rel="noopener">Open this quiz in a new tab</a></p>`].join("\n");
}

/** A real link remains usable before enhancement and if scripts/styles fail. */
export function quizPopupCode(origin: string, formId: string, title: string, triggerLabel = "Take the quiz"): string {
  const safeOrigin = embedOrigin(origin);
  if (!safeOrigin) return "";
  const direct = `${safeOrigin}/play/${encodeURIComponent(formId)}`;
  return [
    `<a data-pippi-popup data-pippi-title="${attribute(title.trim() || "Quiz")}" href="${attribute(direct)}" target="_blank" rel="noopener">${attribute(triggerLabel.trim() || "Take the quiz")}</a>`,
    `<link data-pippi-popup-style rel="stylesheet" href="${attribute(safeOrigin)}/pippi-popup.css">`,
    `<script src="${attribute(safeOrigin)}/pippi-embed.js" async></script>`,
  ].join("\n");
}

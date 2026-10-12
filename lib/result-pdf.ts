// Node-only document generation. The renderer never opens URLs or reads user-selected paths.
import { readableReportAccent } from "./report-design";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setImmediate as yieldImmediate } from "node:timers/promises";
import PDFDocument from "pdfkit";
import { create as createFont } from "fontkit";
import type { ResultReport } from "./result-reports";
import { buildResultPdfModel, type ResultPdfBlock } from "./result-pdf-model";
import { PdfRenderError } from "./result-pdf-errors";

export { PdfRenderError } from "./result-pdf-errors";

const MAX_PAGES = 50;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_LAYOUT_MS = 10_000;
const MARGIN = 48;
const FOOTER_SPACE = 54;
const INK = "#17202D";
const MUTED = "#526174";
const FONT_REGULAR = "ReportRegular";
const FONT_BOLD = "ReportBold";
const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
let fontBytes: Promise<readonly [Buffer, Buffer]> | undefined;

function loadFontBytes() {
  // Only immutable asset bytes are shared. Each document gets its own font/subset state.
  fontBytes ??= Promise.all([
    readFile(path.join(process.cwd(), "assets/pdf-fonts/NotoSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "assets/pdf-fonts/NotoSans-Bold.ttf")),
  ]).catch(() => {
    fontBytes = undefined;
    throw new PdfRenderError("render_unavailable", 503, "PDF downloads are temporarily unavailable. Please use Print / Save as PDF.");
  });
  return fontBytes;
}

function printable(text: string) {
  // Canonical composition preserves meaning; tabs become visual spacing, never hidden text.
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
}

function unsupportedText(): never {
  throw new PdfRenderError("unsupported_text", 422, "This report contains text that the PDF download cannot display yet. Please use Print / Save as PDF.");
}

function checkGlyphs(texts: string[], regular: Buffer, bold: Buffer) {
  const fonts = [createFont(regular), createFont(bold)];
  const seen = new Set<number>();
  for (const text of texts) for (const character of printable(text)) {
    if (character === "\n" || character === " ") continue;
    const codePoint = character.codePointAt(0)!;
    if (seen.has(codePoint)) continue;
    seen.add(codePoint);
    // Font coverage alone is not proof of shaping/bidi support. Explicitly limit v1 scripts.
    if (!/^(?:\p{Script=Latin}|\p{Script=Greek}|\p{Script=Cyrillic}|\p{Script=Common}|\p{Script=Inherited})$/u.test(character)
      || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(character)
      || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
      || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)) unsupportedText();
    for (const font of fonts) {
      if (!("hasGlyphForCodePoint" in font) || !font.hasGlyphForCodePoint(codePoint)) unsupportedText();
    }
  }
}


/** Native, bounded PDF for an already-authorized frozen result; access checks belong to the route. */
export async function renderResultPdf(report: ResultReport, options: { signal?: AbortSignal } = {}): Promise<Buffer> {
  const { signal } = options;
  const aborted = () => new PdfRenderError("render_aborted", 499, "PDF download cancelled. Please try again.");
  if (signal?.aborted) throw aborted();
  const model = buildResultPdfModel(report);
  const [regular, bold] = await loadFontBytes();
  if (signal?.aborted) throw aborted();
  try {
    checkGlyphs([model.title, model.brandName, ...(model.design ? [model.design.quizTitle, model.design.subtitle, model.design.introduction, model.design.footer] : []), ...model.blocks.flatMap(block => {
      if (block.kind === "rule") return [];
      if (block.kind === "score") return [block.label, block.coverage || ""];
      if (block.kind === "link") return [block.label];
      return [block.text];
    })], regular, bold);
  } catch (error) {
    if (error instanceof PdfRenderError) throw error;
    throw new PdfRenderError("render_unavailable", 503, "PDF fonts are temporarily unavailable. Please use Print / Save as PDF.");
  }

  let doc: PDFKit.PDFDocument;
  try {
    doc = new PDFDocument({
      autoFirstPage: false, size: "A4", margin: 0, bufferPages: true,
      font: path.join(process.cwd(), "assets/pdf-fonts/NotoSans-Regular.ttf"), tagged: true, displayTitle: true, lang: "en",
      info: { Title: model.title, Author: model.brandName || (model.hideBranding ? "" : "Pippi"), CreationDate: new Date(model.createdAt) },
    });
  } catch {
    throw new PdfRenderError("render_unavailable", 503, "PDF fonts are temporarily unavailable. Please use Print / Save as PDF.");
  }
  doc.registerFont(FONT_REGULAR, regular).registerFont(FONT_BOLD, bold);
  let failure: Error | undefined;
  let bytes = 0;
  let pages = 0;
  let y = MARGIN;
  let linesDrawn = 0;
  let continuationTitle: string | undefined;
  const started = performance.now();
  const chunks: Buffer[] = [];
  const accent = readableReportAccent(model.accent);
  const designed = !!model.design, executive = model.design?.style === "executive";
  const tooLarge = () => new PdfRenderError("report_too_large", 422, "This report is too large for a PDF download. Please use Print / Save as PDF.");
  const finish = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        failure ??= tooLarge();
        chunks.length = 0;
        doc.destroy(failure);
      } else if (!failure) chunks.push(chunk);
    });
    doc.once("error", error => { failure ??= error; reject(failure); });
    doc.once("end", () => failure ? reject(failure) : resolve(Buffer.concat(chunks, bytes)));
    doc.once("close", () => { if (failure) reject(failure); });
  });
  // Errors can arrive during cooperative layout yields, before the final await.
  void finish.catch(() => undefined);
  const onAbort = () => { failure ??= aborted(); doc.destroy(failure); };
  signal?.addEventListener("abort", onAbort, { once: true });

  function check() {
    if (signal?.aborted) throw aborted();
    if (failure) throw failure;
    if (performance.now() - started > MAX_LAYOUT_MS) throw tooLarge();
  }
  function width() { return doc.page.width - MARGIN * 2; }
  function bottom() { return doc.page.height - FOOTER_SPACE; }
  function setFont(boldText: boolean, size: number) {
    doc.font(boldText ? FONT_BOLD : FONT_REGULAR).fontSize(size);
  }
  function artifact(draw: () => void) {
    doc.markContent("Artifact"); draw(); doc.endMarkedContent();
  }
  function newPage() {
    check();
    if (pages >= MAX_PAGES) throw tooLarge();
    doc.addPage(); pages++; y = MARGIN;
    if (designed) artifact(() => {
      if (executive) doc.rect(0, 0, doc.page.width, 9).fill(INK);
      else doc.rect(MARGIN, 16, 44, 3).fill(accent);
    });
    if (pages > 1) {
      artifact(() => {
        setFont(false, 8.5);
        let header = continuationTitle ? `${printable(continuationTitle).replace(/\n/g, " ")} (continued)` : "Saved result - continued";
        // Only repeated page furniture is abbreviated; the original section heading is complete.
        if (header.length > 300 || doc.widthOfString(header) > width()) {
          let short = "";
          for (const { segment } of graphemes.segment(header)) {
            if (doc.widthOfString(short + segment + "...") > width()) break;
            short += segment;
          }
          header = short + "...";
        }
        doc.fillColor(MUTED).text(header, MARGIN, 28, { lineBreak: false });
      });
    }
  }
  function ensureSpace(height: number) {
    if (y + Math.min(height, bottom() - MARGIN) > bottom()) newPage();
  }
  function wrap(text: string, maxWidth = width()) {
    const lines: string[] = [];
    for (const paragraph of printable(text).split("\n")) {
      check();
      let line = "";
      const tokens = paragraph.match(/\S+\s*|\s+/gu) || [];
      for (let token of tokens) {
        check();
        // Avoid asking the shaping engine to measure a huge unbroken word all at once.
        if (line.length + token.length < 400 && doc.widthOfString(line + token) <= maxWidth) {
          line += token; continue;
        }
        if (line) { lines.push(line.trimEnd()); line = ""; token = token.trimStart(); }
        if (token.length < 400 && doc.widthOfString(token) <= maxWidth) { line = token; continue; }
        for (const { segment } of graphemes.segment(token)) {
          if (line && doc.widthOfString(line + segment) > maxWidth) { lines.push(line.trimEnd()); line = ""; }
          if (doc.widthOfString(segment) > maxWidth) throw tooLarge();
          line += segment;
        }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }
  function textEntryHeight(lineCount: number, lineHeight: number, keepNext = 0) {
    // Long text keeps flowing; only its opening lines and an explicitly requested
    // following block are reserved. A group cannot occupy more than one page.
    return Math.min(Math.min(lineCount, 3) * lineHeight + keepNext, bottom() - MARGIN);
  }
  async function drawText(text: string, size: number, lineHeight: number, settings: { bold?: boolean; color?: string; tag?: string; gap?: number; keepNext?: number; link?: string } = {}) {
    setFont(Boolean(settings.bold), size);
    const lines = wrap(text);
    const keepNext = Math.min(settings.keepNext || 0, Math.max(0, bottom() - MARGIN - Math.min(lines.length, 3) * lineHeight));
    ensureSpace(textEntryHeight(lines.length, lineHeight, keepNext));
    const structure = doc.struct(settings.tag || "P");
    doc.addStructure(structure);
    for (const [index, line] of lines.entries()) {
      // Carry the end of a long quotation/paragraph together with its short attribution.
      const remaining = lines.length - index;
      check(); ensureSpace(remaining <= 2 ? lineHeight * remaining + keepNext : lineHeight);
      // A page header changes the current font; restore before every content line.
      setFont(Boolean(settings.bold), size);
      doc.fillColor(settings.color || INK);
      const content = doc.markStructureContent(settings.tag || "P");
      // Include spaces in tagged text so extraction and assistive readers retain word boundaries.
      doc.text(`${line} `, MARGIN, y, { lineBreak: false, link: settings.link, underline: Boolean(settings.link) });
      doc.endMarkedContent(); structure.add(content);
      y += lineHeight;
      if (++linesDrawn % 32 === 0) { await yieldImmediate(); check(); }
    }
    structure.end(); y += settings.gap ?? 9;
  }
  async function drawScore(block: Extract<ResultPdfBlock, { kind: "score" }>) {
    ensureSpace(scoreHeight(block));
    if (executive && scoreHeight(block) < bottom() - MARGIN) artifact(() => {
      doc.roundedRect(MARGIN - 10, y - 5, width() + 20, scoreHeight(block) - 4, 6).fill("#F0F3F6");
    });
    await drawText(block.label, 11, 16, { bold: true, tag: "H3", gap: 4 });
    await drawText(block.value === null ? "Not enough information" : `${block.value}%`, block.value === null ? 14 : 25, 32, { bold: true, color: accent, gap: 4 });
    if (block.value !== null) {
      const value = block.value;
      artifact(() => {
        doc.rect(MARGIN, y, width(), 5).fill("#E5E9EE");
        if (value > 0) doc.rect(MARGIN, y, width() * value / 100, 5).fill(accent);
      });
      y += 13;
    }
    if (block.coverage) await drawText(block.coverage, 9, 13, { color: MUTED, gap: 4 });
    y += 12;
  }
  function scoreHeight(block: Extract<ResultPdfBlock, { kind: "score" }>) {
    setFont(true, 11);
    const labelHeight = wrap(block.label).length * 16;
    setFont(false, 9);
    const coverageHeight = block.coverage ? wrap(block.coverage).length * 13 + 4 : 0;
    return labelHeight + 4 + 32 + 4 + (block.value === null ? 0 : 13) + coverageHeight + 12;
  }
  function labelHeight(block: ResultPdfBlock | undefined) {
    if (block?.kind !== "label") return 0;
    setFont(false, 9);
    return Math.min(wrap(block.text).length, 3) * 13 + 8 + 9;
  }
  const headingSizes = { 1: [25, 32], 2: [15.5, 22], 3: [12, 18] } as const;
  const entryHeights = new Map<number, number>();
  function blockEntryHeight(index: number): number {
    const cached = entryHeights.get(index);
    if (cached !== undefined) return cached;
    const block = model.blocks[index];
    if (!block || block.kind === "rule") return 0;
    let height: number;
    if (block.kind === "score") height = scoreHeight(block);
    else {
      const [size, lineHeight] = block.kind === "heading" ? headingSizes[block.level]
        : block.kind === "paragraph" ? [10.5, 16] : block.kind === "label" ? [9, 13] : [11, 16];
      setFont(block.kind === "heading" || block.kind === "link", size);
      const lines = wrap(block.kind === "link" ? block.label : block.text).length;
      // Mirror the next block's own entry check, including paragraph/attribution
      // carry. Measuring just two body lines can strand a heading when that
      // paragraph subsequently moves to keep its coverage or attribution.
      const following = block.kind === "heading" ? 9 + blockEntryHeight(index + 1)
        : block.kind === "paragraph" ? labelHeight(model.blocks[index + 1]) : 0;
      height = textEntryHeight(lines, lineHeight, following);
    }
    const bounded = Math.min(height, bottom() - MARGIN);
    entryHeights.set(index, bounded);
    return bounded;
  }

  try {
    newPage();
    const completed = new Date(model.createdAt).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
    if (model.design) {
      if (executive) {
        artifact(() => doc.rect(MARGIN - 10, y - 10, width() + 20, 42).fill(INK));
        await drawText("PERSONAL REPORT", 10, 16, { bold: true, color: "#FFFFFF", gap: 0 });
        y += 34;
      }
      if (model.brandName || !model.hideBranding) await drawText(model.brandName || "Pippi", 11, 16, { bold: true, color: accent, gap: 18 });
      if (model.design.cover) y = Math.max(y, executive ? 190 : 165);
      await drawText(model.title, model.design.cover ? 34 : 28, model.design.cover ? 43 : 36, { bold: true, tag: "H1", gap: 16 });
      if (model.design.subtitle) await drawText(model.design.subtitle, 14, 21, { color: MUTED, gap: 18 });
      if (model.design.quizTitle !== model.title) await drawText(model.design.quizTitle, 10, 16, { color: MUTED, gap: 8 });
      await drawText(`Saved result - ${completed}`, 9, 13, { color: MUTED, gap: 20 });
      artifact(() => doc.moveTo(MARGIN, y).lineTo(executive ? doc.page.width - MARGIN : MARGIN + 76, y).lineWidth(executive ? 1 : 3).stroke(accent));
      y += 24;
      if (model.design.cover) newPage();
      if (model.design.introduction) {
        await drawText("About this report", 11, 17, { bold: true, color: accent, tag: "H2", keepNext: 48 });
        await drawText(model.design.introduction, 10.5, 17, { gap: 22 });
      }
    } else {
      if (model.brandName || !model.hideBranding) await drawText(model.brandName || "Pippi", 11, 16, { bold: true, color: accent, gap: 8 });
      await drawText(model.title, 13, 18, { bold: true, gap: 5 });
      await drawText(`Saved result - ${completed}`, 9, 13, { color: MUTED, gap: 14 });
      artifact(() => doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).lineWidth(1).stroke(accent));
      y += 18;
    }
    for (const [index, block] of model.blocks.entries()) {
      await yieldImmediate(); check();
      const next = model.blocks[index + 1];
      if (block.kind === "heading") {
        if (block.level < 3) continuationTitle = undefined;
        const [size, lineHeight] = headingSizes[block.level];
        const keepNext = 9 + blockEntryHeight(index + 1);
        if (designed && block.level === 2) {
          ensureSpace(22 + keepNext);
          y += 6;
          artifact(() => doc.moveTo(MARGIN, y - 3).lineTo(executive ? MARGIN + 28 : doc.page.width - MARGIN, y - 3).lineWidth(executive ? 3 : 0.5).stroke(executive ? accent : "#DCE1E7"));
          y += 5;
        }
        await drawText(block.text, size, lineHeight, { bold: true, tag: `H${block.level}`, gap: 9, keepNext });
        if (block.level === 2 && next?.kind === "score" && next.label === "Score") continuationTitle = block.text;
      } else if (block.kind === "paragraph") await drawText(block.text, 10.5, 16, { keepNext: labelHeight(next) });
      else if (block.kind === "label") await drawText(block.text, 9, 13, { color: MUTED, gap: 8 });
      else if (block.kind === "score") await drawScore(block);
      else if (block.kind === "link") await drawText(block.label, 11, 16, { bold: true, color: accent, tag: "Link", link: block.url, gap: 14 });
      else { continuationTitle = undefined; ensureSpace(20); artifact(() => doc.moveTo(MARGIN, y + 5).lineTo(doc.page.width - MARGIN, y + 5).lineWidth(0.5).stroke("#DCE1E7")); y += 20; }
    }
    if (model.design?.footer) {
      ensureSpace(50); y += 10;
      artifact(() => doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).lineWidth(0.5).stroke("#DCE1E7"));
      y += 12;
      await drawText(model.design.footer, 9, 14, { color: MUTED });
    }
    for (let page = 0; page < pages; page++) {
      check(); doc.switchToPage(page);
      artifact(() => {
        setFont(false, 8.5); doc.fillColor(MUTED);
        doc.text(model.hideBranding ? "Saved copy" : "Made with Pippi", MARGIN, doc.page.height - 32, { lineBreak: false });
        const label = `Page ${page + 1} of ${pages}`;
        doc.text(label, doc.page.width - MARGIN - doc.widthOfString(label), doc.page.height - 32, { lineBreak: false });
      });
    }
    check(); doc.end();
    const output = await finish;
    check(); return output;
  } catch (error) {
    failure = error instanceof Error ? error : new Error("PDF render failure");
    doc.destroy(failure);
    if (error instanceof PdfRenderError) throw error;
    throw new PdfRenderError("render_failed", 503, "PDF downloads are temporarily unavailable. Please use Print / Save as PDF.");
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

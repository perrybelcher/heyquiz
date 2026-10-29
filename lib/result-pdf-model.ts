import { outcomePresentation } from "./result-presentation";
import { ReportDesignSchema, safeReportUrl, type ReportDesign } from "./report-design";
import { PdfRenderError } from "./result-pdf-errors";
export { PdfRenderError } from "./result-pdf-errors";

export type ResultPdfLayout = "stacked" | "score_overview" | "action_plan";
export type ResultPdfBlock =
    | { kind: "heading"; text: string; level: 1 | 2 | 3 }
    | { kind: "paragraph" | "label"; text: string }
    | { kind: "score"; label: string; value: number | null; coverage?: string }
    | { kind: "link"; label: string; url: string }
    | { kind: "rule" };
export type ResultPdfModel = {
    title: string; brandName: string; hideBranding: boolean; createdAt: string;
    layout: ResultPdfLayout; accent: string; blocks: ResultPdfBlock[];
    design?: Pick<ReportDesign, "style" | "cover" | "subtitle" | "introduction" | "footer"> & { quizTitle: string };
};
export const RESULT_PDF_TEXT_LIMIT = 200 * 1024;
export const RESULT_PDF_BLOCK_LIMIT = 2000;

function invalid(): never { throw new PdfRenderError("invalid_report", 422, "This saved result cannot be downloaded as a PDF. Please use the web report or browser print."); }
function tooLarge(): never { throw new PdfRenderError("report_too_large", 422, "This saved result is too large for a native PDF. Please use the web report or browser print."); }
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
    return value as Record<string, unknown>;
}
function text(value: unknown, optional = false): string {
    if (value === undefined && optional) return "";
    if (typeof value !== "string") return invalid();
    if (value.length > RESULT_PDF_TEXT_LIMIT) return tooLarge();
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) return invalid();
    // Iteration yields full Unicode scalars for valid pairs, leaving lone UTF-16
    // surrogates detectable. Font/script support is checked by the renderer.
    for (const scalar of value) {
        const code = scalar.codePointAt(0)!;
        if (code >= 0xd800 && code <= 0xdfff) return invalid();
    }
    return value;
}
function list(value: unknown, maximum: number, optional = false): unknown[] {
    if (value === undefined && optional) return [];
    if (!Array.isArray(value)) return invalid();
    if (value.length > maximum) return tooLarge();
    return value;
}
function number(value: unknown, maximum = 1e12): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) return invalid();
    return value;
}
function score(value: unknown): number | null { return value === null ? null : number(value, 100); }
function count(value: unknown, minimum = 0): number {
    const parsed = number(value, 200);
    if (!Number.isInteger(parsed) || parsed < minimum) return invalid();
    return parsed;
}
function completionDate(value: unknown): string {
    const saved = text(value);
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(saved);
    if (!parts) return invalid();
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, zoneHour = "0", zoneMinute = "0"] = parts;
    const year = Number(yearText), month = Number(monthText), day = Number(dayText);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59 || Number(zoneHour) > 23 || Number(zoneMinute) > 59) return invalid();
    const timestamp = Date.parse(saved);
    if (!Number.isFinite(timestamp)) return invalid();
    return new Date(timestamp).toISOString();
}

/** Ordinary annotations only. Never fetch a URL or carry a report capability. */
export const safeResultPdfLink = safeReportUrl;

type Category = { title: string; description: string; score: number | null; answered: number; applicable: number; minAnswers: number; bandTitle: string; advice: string };
function category(value: unknown): Category {
    const row = object(value);
    const answered = count(row.answered), applicable = count(row.applicable);
    if (answered > applicable) return invalid();
    return { title: text(row.title), description: text(row.description), score: score(row.score), answered, applicable, minAnswers: count(row.minAnswers, 1), bandTitle: text(row.bandTitle, true), advice: text(row.advice, true) };
}
function coverage(row: Category) {
    return row.answered + " of " + row.applicable + " applicable questions scored" + (row.score === null ? " · " + row.minAnswers + " needed" : "");
}

/** Builds only the frozen, visible result. It never reads today's quiz or inputs. */
export function buildResultPdfModel(input: unknown): ResultPdfModel {
    const report = object(input), theme = object(report.theme), result = object(report.result);
    const quizTitle = text(report.quizTitle), createdAt = completionDate(report.createdAt);
    let design: ReportDesign | undefined;
    if (report.reportDesign !== undefined) {
        const parsed = ReportDesignSchema.safeParse(report.reportDesign);
        if (!parsed.success) return invalid();
        design = parsed.data;
    }
    const title = design?.title.trim() || quizTitle;
    if (theme.hidePippiBranding !== undefined && typeof theme.hidePippiBranding !== "boolean") return invalid();
    const hideBranding = theme.hidePippiBranding === true;
    const brandName = text(theme.brandName, true) || (text(theme.logoUrl, true) ? text(theme.logoAlt, true) || title : "");
    const accent = typeof theme.primaryColor === "string" && /^#[0-9a-f]{6}$/i.test(theme.primaryColor) ? theme.primaryColor : "#922c3b";
    const blocks: ResultPdfBlock[] = [];
    let bytes = new TextEncoder().encode(title + brandName + createdAt + (design ? quizTitle + design.subtitle + design.introduction + design.footer : "")).length;
    function add(block: ResultPdfBlock) {
        const content = block.kind === "rule" ? "" : "text" in block ? block.text : block.kind === "link" ? block.label + block.url : block.label + (block.value === null ? "Not enough information" : block.value + "%") + (block.coverage || "");
        bytes += new TextEncoder().encode(content).length;
        if (bytes > RESULT_PDF_TEXT_LIMIT || blocks.length >= RESULT_PDF_BLOCK_LIMIT) return tooLarge();
        blocks.push(block);
    }
    function heading(value: string, level: 1 | 2 | 3 = 2) { if (value) add({ kind: "heading", text: value, level }); }
    function paragraph(value: string) { if (value) add({ kind: "paragraph", text: value }); }
    function label(value: string) { if (value) add({ kind: "label", text: value }); }
    function link(urlValue: unknown, labelValue: string, fallback: string) {
        const raw = text(urlValue, true);
        if (!raw) return;
        const url = safeResultPdfLink(raw);
        // Preserve a visible explanation for an unusable destination without
        // printing an unsafe URL or dropping its surrounding section.
        if (url) add({ kind: "link", label: labelValue || fallback, url });
        else label((labelValue || fallback) + " — link unavailable in this PDF.");
    }
    let layout: ResultPdfLayout = "stacked";
    if (result.marketing === undefined) {
        heading(text(report.heading), 1); paragraph(text(report.message));
        const possible = number(result.totalPointsPossible), earned = number(result.totalPointsEarned), percentage = number(result.percentageScore, 100);
        if (possible > 0) { add({ kind: "score", label: "Score", value: percentage }); label(earned + " of " + possible + " points"); }
        if (!design || design.sections.includes("action")) {
            const ctaValue = design?.cta ?? report.cta;
            if (ctaValue !== undefined) { const cta = object(ctaValue); link(cta.url, text(cta.label), "Continue"); }
        }
    } else {
        const marketing = object(result.marketing);
        if (typeof marketing.kind !== "string" || !["product_finder", "segmentation", "scorecard", "qualification"].includes(marketing.kind)) return invalid();
        if (marketing.presentation !== undefined) {
            const savedLayout = object(marketing.presentation).layout;
            if (typeof savedLayout !== "string" || !["stacked", "score_overview", "action_plan"].includes(savedLayout)) return invalid();
            layout = savedLayout as ResultPdfLayout;
        }
        const presentation = outcomePresentation(marketing);
        const categories = list(marketing.categories, 20).map(category);
        const reasons = list(marketing.reasons, 1000).map(value => text(value));
        const priorities = list(marketing.priorities, 20, true).map(value => { const row = object(value); return { title: text(row.title), action: text(row.action) }; });
        const advice = text(marketing.advice, true);
        const overall = marketing.overallScore === undefined ? undefined : score(marketing.overallScore);
        const sections = list(marketing.resultSections, 12, true).map(value => {
            const section = object(value);
            if (typeof section.type !== "string" || !["text", "image", "testimonial", "faq", "cta", "video"].includes(section.type)) return invalid();
            return { type: section.type as string, title: text(section.title), body: text(section.body), label: text(section.label), url: text(section.url) };
        });
        label(presentation?.heading || (marketing.kind === "product_finder" ? "Your recommendation" : marketing.kind === "segmentation" ? "Your next step" : "Your assessment"));
        heading(text(marketing.title), 1); paragraph(text(marketing.message));
        const addOverall = () => {
            if (presentation || overall === undefined) return;
            add({ kind: "score", label: "Overall score", value: overall });
            paragraph(overall === null ? "Every category needs enough scored answers before an overall recommendation is available." : "Each category contributes equally to this score.");
        };
        const addPriorities = () => {
            if (presentation || !priorities.length) return;
            heading("Your next priorities"); paragraph("Starting with your lowest scored areas.");
            priorities.forEach((priority, index) => { heading((index + 1) + ". " + priority.title, 3); paragraph(priority.action); });
        };
        const addReasons = () => { if (reasons.length) { heading(presentation?.reasons || "Why this fits"); reasons.forEach(paragraph); } };
        const addAdvice = () => { if (advice) { heading(presentation?.advice || "A useful first step"); paragraph(advice); } };
        const addCategories = () => (presentation ? [] : categories).forEach(row => {
            heading(row.title); add({ kind: "score", label: "Score", value: row.score });
            paragraph(row.description); heading(row.bandTitle, 3); paragraph(row.advice); label(coverage(row));
        });
        const addAction = () => link(design?.cta?.url ?? marketing.ctaUrl, design?.cta?.label ?? text(marketing.ctaLabel, true), "Explore this option");
        const addSections = () => sections.forEach(section => {
            add({ kind: "rule" });
            if (section.type === "testimonial") { paragraph(section.body); label(section.title); return; }
            heading(section.title || (section.type === "faq" ? "Learn more" : ""));
            if (section.type === "image" || section.type === "video") {
                link(section.url, section.label || section.title, section.type === "image" ? "View image online" : "Watch video online");
                label(section.type === "image" ? "Image available online." : "Video available online.");
            }
            paragraph(section.body);
            if (section.type === "cta") link(section.url, section.label, "Learn more");
        });
        if (design) {
            // Saved facts always remain complete. Supporting prose can be composed
            // without concealing score/null states, coverage or category guidance.
            addOverall(); addCategories();
            const addGroup = { priorities: addPriorities, reasons: addReasons, advice: addAdvice, details: addSections, action: addAction };
            for (const section of design.sections) addGroup[section]();
        } else if (presentation) {
            if (layout === "action_plan") { addAdvice(); addAction(); addReasons(); addSections(); }
            else { addReasons(); addAdvice(); addSections(); addAction(); }
        } else if (layout === "action_plan") {
            addAdvice(); addPriorities(); addAction();
            if (overall !== undefined || categories.length || reasons.length) {
                add({ kind: "rule" }); heading("How your answers shaped this");
                paragraph("Review the supporting details, including any areas that need more information.");
                addOverall(); addReasons(); addCategories();
            }
            addSections();
        } else if (layout === "score_overview") {
            addOverall();
            if (categories.length) {
                heading("Your scores at a glance");
                paragraph(categories.filter(row => row.score !== null).length + " of " + categories.length + " categories have enough scored answers.");
                categories.forEach(row => add({ kind: "score", label: row.title, value: row.score, coverage: coverage(row) }));
            }
            addReasons(); addPriorities(); addAdvice();
            if (categories.length) { add({ kind: "rule" }); heading("A closer look at each area"); addCategories(); }
            addSections(); addAction();
        } else { addOverall(); addPriorities(); addReasons(); addAdvice(); addCategories(); addSections(); addAction(); }
    }
    if (bytes > RESULT_PDF_TEXT_LIMIT) return tooLarge();
    return { title, brandName, hideBranding, createdAt, layout, accent, blocks, ...(design ? { design: { style: design.style, cover: design.cover, subtitle: design.subtitle, introduction: design.introduction, footer: design.footer, quizTitle } } : {}) };
}

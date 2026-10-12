"use client";
import { Download, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ResultReport } from "@/lib/result-reports";
import { quizThemeStyle } from "@/lib/theme-style";
import { buildResultPdfModel } from "@/lib/result-pdf-model";
import ReportDesignPreview from "./ReportDesignPreview";
import MarketingResultCard from "./MarketingResultCard";
export default function ResultReportView({ report, token }: {
    report: ResultReport;
    token: string;
}) {
    const designedModel = useMemo(() => {
      if (!report.reportDesign) return null;
      try { return buildResultPdfModel(report); } catch { return null; }
    }, [report]);
    const downloadController = useRef<AbortController | null>(null);
    const [downloading, setDownloading] = useState(false), [downloadError, setDownloadError] = useState("");
    useEffect(() => () => { downloadController.current?.abort(); downloadController.current = null; }, []);
    async function downloadPdf() {
        if (downloadController.current) return;
        const controller = new AbortController();
        downloadController.current = controller;
        setDownloading(true); setDownloadError("");
        const deadline = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(`/api/result/${encodeURIComponent(token)}/pdf`, { cache: "no-store", signal: controller.signal });
            if (!response.ok) {
                const messages: Record<number, string> = {
                    404: "This result link is no longer available. It may have expired or been revoked.",
                    422: "This report needs your browser's print layout. Choose Print / Save as PDF instead.",
                    429: "Please wait a minute before downloading again. You can also use Print / Save as PDF.",
                    503: "The download is temporarily unavailable. Try again, or use Print / Save as PDF.",
                };
                throw Error(messages[response.status] || "We couldn't prepare the download. Try again, or use Print / Save as PDF.");
            }
            if (!response.headers.get("content-type")?.startsWith("application/pdf")) throw Error("The PDF could not be read. Please use Print / Save as PDF.");
            const pdf = await response.blob();
            if (!pdf.size || pdf.size > 3 * 1024 * 1024) throw Error("The PDF could not be read. Please use Print / Save as PDF.");
            if (controller.signal.aborted) return;
            const url = URL.createObjectURL(pdf), anchor = document.createElement("a");
            anchor.href = url; anchor.download = "pippi-result.pdf";
            document.body.appendChild(anchor); anchor.click(); anchor.remove();
            // Keep the object URL alive while the browser starts its download.
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (error) {
            if (downloadController.current === controller) setDownloadError(controller.signal.aborted ? "The download took too long. Try again, or use Print / Save as PDF." : error instanceof Error ? error.message : "The download failed. Please use Print / Save as PDF.");
        } finally {
            clearTimeout(deadline);
            if (downloadController.current === controller) { downloadController.current = null; setDownloading(false); }
        }
    }
    function print() {
        // Include FAQ answers in the printable copy and restore the reader's state afterward.
        const closed = [...document.querySelectorAll<HTMLDetailsElement>('.result-report details:not([open])')];
        closed.forEach(detail => { detail.open = true; });
        const restore = () => closed.forEach(detail => { detail.open = false; });
        window.addEventListener('afterprint', restore, { once: true });
        window.print();
    }
    return <main className="hq-player result-report min-h-screen px-5 py-10" style={quizThemeStyle(report.theme)}>
    <div className="mx-auto max-w-3xl">
      <div className="result-report-actions flex flex-wrap items-center justify-between gap-4 mb-6">
        <p className="text-sm opacity-75">Saved result · {new Date(report.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void downloadPdf()} disabled={downloading} className="hq-primary">{downloading ? <Loader2 size={16} className="animate-spin" aria-hidden="true"/> : <Download size={16} aria-hidden="true"/>}{downloading ? "Preparing PDF…" : "Download PDF"}</button><button type="button" onClick={print} className="hq-secondary"><Printer size={16} aria-hidden="true"/>Print / Save as PDF</button></div>
        <p className="w-full text-xs opacity-75">Download a print-friendly report. Images and videos remain online. A downloaded copy stays on your device after this link expires.</p>
        {downloadError && <p role="alert" className="w-full rounded-xl bg-white border border-red-200 px-4 py-3 text-sm text-red-800">{downloadError}</p>}
        <p className="w-full text-xs opacity-75">Anyone with this private link can view this result until {new Date(report.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}. Keep it somewhere safe. This is a saved copy; later quiz edits do not change it.</p>
      </div>
      {report.reportDesign && !designedModel && <p role="alert" className="mb-4 rounded-lg bg-white p-4 text-red-900">The custom report layout could not be read. Your saved result is shown below.</p>}
      {designedModel ? <ReportDesignPreview model={designedModel}/> : <article className="rounded-3xl border border-black/10 p-7 sm:p-12 shadow-sm" style={{ backgroundColor: report.theme.cardColor || '#fff' }}>
        <header className="mb-8 border-b border-black/10 pb-6">
          {report.theme.logoUrl ? <img src={report.theme.logoUrl} alt={report.theme.logoAlt || report.theme.brandName || 'Quiz logo'} className="max-w-full object-contain object-left" style={{ height: report.theme.logoHeight || 40 }} referrerPolicy="no-referrer"/> : report.theme.brandName ? <p className="text-xl font-semibold">{report.theme.brandName}</p> : !report.theme.hidePippiBranding ? <img src="/pippi-logo.svg" alt="pippi" className="h-7"/> : null}
          <p className="text-sm mt-4 opacity-70">{report.quizTitle}</p>
        </header>
        {report.result.marketing ? <MarketingResultCard result={report.result.marketing}/> : <div className="space-y-5">
          <h1 className="text-3xl font-semibold">{report.heading}</h1><p className="whitespace-pre-line">{report.message}</p>
          {report.result.totalPointsPossible > 0 && <div><p className="text-3xl font-semibold">{report.result.percentageScore}%</p><p className="text-sm mt-2">{report.result.totalPointsEarned} of {report.result.totalPointsPossible} points</p></div>}
          {report.cta && <a href={report.cta.url} className="hq-primary" rel="noreferrer">{report.cta.label} →</a>}
        </div>}
      </article>}
      {!designedModel && !report.theme.hidePippiBranding && <p className="text-center text-xs opacity-60 mt-8">Made with Pippi</p>}
    </div>
  </main>;
}

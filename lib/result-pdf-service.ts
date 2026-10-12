import { readResultReport, type ResultReport } from "./result-reports";
import { renderResultPdf } from "./result-pdf";

export class ResultPdfAccessError extends Error {
  constructor(public readonly reason: "unavailable" | "busy" | "interrupted") {
    super("The private PDF could not be prepared.");
    this.name = "ResultPdfAccessError";
  }
}

type Dependencies = {
  readReport: (token: string) => Promise<ResultReport | null>;
  render: (report: ResultReport, options: { signal: AbortSignal }) => Promise<Buffer>;
  /** Trusted construction only, never derived from a request. */
  timeoutMs?: number;
};

/** Each server instance permits two active jobs, with no waiting queue or cache. */
export function createResultPdfService({ readReport, render, timeoutMs = 15_000 }: Dependencies) {
  let active = 0;
  return async function privateResultPdf(token: string, requestSignal?: AbortSignal): Promise<Buffer> {
    const controller = new AbortController();
    const interrupt = () => controller.abort();
    let rejectInterrupted: (() => void) | undefined;
    const interrupted = new Promise<never>((_, reject) => {
      rejectInterrupted = () => reject(new ResultPdfAccessError("interrupted"));
      controller.signal.addEventListener("abort", rejectInterrupted, { once: true });
    });
    if (requestSignal?.aborted) controller.abort();
    else requestSignal?.addEventListener("abort", interrupt, { once: true });
    const timer = setTimeout(interrupt, timeoutMs);
    const checkActive = () => {
      if (controller.signal.aborted) throw new ResultPdfAccessError("interrupted");
    };
    const work = (async () => {
      checkActive();
      const report = await readReport(token);
      checkActive();
      if (!report) throw new ResultPdfAccessError("unavailable");
      if (active >= 2) throw new ResultPdfAccessError("busy");
      active++;
      try {
        const pdf = await render(report, { signal: controller.signal });
        checkActive();
        // Rendering can overlap expiry, response deletion or owner revocation.
        // Reuse the exact original capability; never issue or refresh a link here.
        const stillAvailable = await readReport(token);
        checkActive();
        if (!stillAvailable) throw new ResultPdfAccessError("unavailable");
        return pdf;
      } finally {
        // An aborted caller may already have returned. Hold the slot until the
        // actual renderer/storage work settles so slow work cannot oversubscribe.
        active--;
      }
    })();
    try {
      return await Promise.race([work, interrupted]);
    } finally {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", interrupt);
      if (rejectInterrupted) controller.signal.removeEventListener("abort", rejectInterrupted);
    }
  };
}

export const privateResultPdf = createResultPdfService({ readReport: readResultReport, render: renderResultPdf });

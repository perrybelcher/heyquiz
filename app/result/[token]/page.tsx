import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { readResultReport } from "@/lib/result-reports";
import ResultReportView from "@/components/ResultReportView";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Your private quiz result",
    description: "A saved copy of your quiz result.",
    robots: { index: false, follow: false, noarchive: true },
    referrer: "no-referrer",
    icons: { icon: "/quiz-icon.svg" },
};
export default async function ResultPage({ params }: {
    params: Promise<{
        token: string;
    }>;
}) {
    const { token } = await params;
    const report = await readResultReport(token);
    if (!report)
        notFound();
    return <ResultReportView report={report} token={token}/>;
}

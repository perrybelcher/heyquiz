import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { ownedForm, getSubmissionsByFormId } from "@/lib/storage";
import { privateMetadata } from "@/lib/seo";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import ResultsChart from "@/components/ResultsChart";
import ReportResponses from "@/components/ReportResponses";

export const dynamic = "force-dynamic";
export const metadata = { ...privateMetadata, title: "Quiz report | Pippi" };

export default async function QuizReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/reports/${encodeURIComponent(id)}`);
  const form = await ownedForm(id, user.id);
  if (!form) notFound();
  const submissions = await getSubmissionsByFormId(id, user.id);
  return <div className="pippi-app min-h-screen bg-[#f8f9f5] text-slate-900">
    <WorkspaceHeader active="reports" />
    <main className="mx-auto max-w-7xl px-5 py-7 sm:px-10 sm:py-10">
      <Link href="/reports" className="text-sm text-[#922c3b]">← All reports</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1"><p className="pippi-eyebrow">QUIZ REPORT</p><h1 className="mt-2 text-3xl font-semibold [overflow-wrap:anywhere]">{form.title}</h1><p className="mt-2 text-sm text-slate-500">Read your results here. Quiz changes are made in the editor.</p></div>
        <Link href={`/editor/${encodeURIComponent(id)}`} className="hq-secondary">Edit quiz</Link>
      </div>
      <ResultsChart formId={id} />
      <ReportResponses submissions={submissions} formId={id} />
    </main>
  </div>;
}

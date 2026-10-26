import { requirePageUser } from "@/lib/auth";
import { getAllForms } from "@/lib/storage";
import { privateMetadata } from "@/lib/seo";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import ReportsOverview from "@/components/ReportsOverview";
import { listRecords } from "@/lib/records";
import type { QuizSubmissionResult } from "@/lib/schema";
import { reportActivity } from "@/lib/report-activity";

export const dynamic = "force-dynamic";
export const metadata = { ...privateMetadata, title: "Reports | Pippi" };

export default async function ReportsPage() {
  const user = await requirePageUser("/reports");
  const [forms, responses] = await Promise.all([getAllForms(user.id), listRecords<QuizSubmissionResult>("submissions", user.id)]);
  const activity = reportActivity(responses.map(record => record.payload));
  const quizzes = forms.map(({ id, title, updatedAt, publishedAt }) => ({ id, title, updatedAt, publishedAt, responseCount: 0, ...activity.get(id) }));
  return <div className="pippi-app min-h-screen bg-[#f8f9f5] text-slate-900"><WorkspaceHeader active="reports" /><ReportsOverview quizzes={quizzes} /></div>;
}

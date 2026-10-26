import { requirePageUser } from "@/lib/auth";
import { getAllForms } from "@/lib/storage";
import { privateMetadata } from "@/lib/seo";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import ReportsOverview from "@/components/ReportsOverview";

export const dynamic = "force-dynamic";
export const metadata = { ...privateMetadata, title: "Reports | Pippi" };

export default async function ReportsPage() {
  const user = await requirePageUser("/reports");
  const forms = await getAllForms(user.id);
  const quizzes = forms.map(({ id, title, updatedAt, publishedAt }) => ({ id, title, updatedAt, publishedAt }));
  return <div className="pippi-app min-h-screen bg-[#f8f9f5] text-slate-900"><WorkspaceHeader active="reports" /><ReportsOverview quizzes={quizzes} /></div>;
}

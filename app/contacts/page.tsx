import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getAllForms } from "@/lib/storage";
import { listRecords } from "@/lib/records";
import type { QuizSubmissionResult } from "@/lib/schema";
import { privateMetadata } from "@/lib/seo";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import ContactsOverview from "@/components/ContactsOverview";

export const dynamic = "force-dynamic";
export const metadata = { ...privateMetadata, title: "Contacts | Pippi" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ quiz?: string | string[] }> }) {
  const user = await requirePageUser("/contacts");
  const [forms, records, params] = await Promise.all([getAllForms(user.id), listRecords<QuizSubmissionResult>("submissions", user.id), searchParams]);
  const ids = new Set(forms.map(form => form.id));
  const selected = typeof params.quiz === "string" ? params.quiz : "";
  if (selected && !ids.has(selected)) notFound();
  const contacts = records.filter(record => record.owner_id === user.id && ids.has(record.payload.formId) && record.payload.contact).map(record => {
    // The overview needs identity and saved outcome/score, not private answers.
    const summary = { ...record.payload, id: record.id, grading: [] };
    delete summary.answers;
    return summary;
  }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.id.localeCompare(b.id));
  return <div className="pippi-app min-h-screen bg-[#f8f9f5] text-slate-900"><WorkspaceHeader active="contacts" /><ContactsOverview contacts={contacts} quizzes={forms.map(({ id, title }) => ({ id, title }))} initialQuiz={selected} /></div>;
}

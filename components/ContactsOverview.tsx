"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import type { QuizSubmissionResult } from "@/lib/schema";
import { contactPage, contactResultTitle, contactScore, emptyContactFilters, filterContacts, type ContactFilters } from "@/lib/contact-filters";
import { reportIdentity } from "@/lib/submission-reporting";

type Quiz = { id: string; title: string };
function date(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
}

export default function ContactsOverview({ contacts, quizzes, initialQuiz = "" }: { contacts: QuizSubmissionResult[]; quizzes: Quiz[]; initialQuiz?: string }) {
  const [query, setQuery] = useState(""), [quizId, setQuizId] = useState(initialQuiz), [consent, setConsent] = useState<ContactFilters["consent"]>("all"), [requestedPage, setRequestedPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const quizTitles = new Map(quizzes.map(quiz => [quiz.id, quiz.title]));
  const matching = filterContacts(contacts.filter(contact => !quizId || contact.formId === quizId), { ...emptyContactFilters, query, consent });
  const page = contactPage(matching, requestedPage);
  const clear = () => { setQuery(""); setQuizId(""); setConsent("all"); setRequestedPage(1); };
  return <main className="mx-auto max-w-6xl px-5 py-7 sm:px-10 sm:py-10">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">Contacts</h1><p className="mt-2 text-sm text-slate-500">Find collected details across your quizzes. One contact per response; separate attempts stay separate.</p></div><button className="hq-secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Refreshing…" : "Refresh contacts"}</button></div>
    <section aria-label="Find contacts" className="mt-7 grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-3">
      <label className="block text-sm font-medium">Search contacts<input type="search" className="hq-input mt-2 w-full" placeholder="Name, email, phone or result…" value={query} onChange={event => { setQuery(event.target.value); setRequestedPage(1); }} /></label>
      <label className="block text-sm font-medium">Quiz<select className="hq-input mt-2 w-full" value={quizId} onChange={event => { setQuizId(event.target.value); setRequestedPage(1); }}><option value="">All quizzes</option>{quizzes.map(quiz => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}</select></label>
      <label className="block text-sm font-medium">Marketing consent<select className="hq-input mt-2 w-full" value={consent} onChange={event => { setConsent(event.target.value as ContactFilters["consent"]); setRequestedPage(1); }}><option value="all">All contacts</option><option value="yes">Opted in</option><option value="no">Not opted in</option></select></label>
    </section>
    <div className="my-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500" role="status">Showing {page.start}–{page.end} of {matching.length} matching contacts · {contacts.length} total · Dates in UTC</p>{(query || quizId || consent !== "all") && <button className="text-sm font-medium text-[#922c3b] underline" onClick={clear}>Clear filters</button>}</div>
    <section aria-label="Contact directory" className="rounded-2xl border border-stone-200 bg-white">
      {page.rows.length ? <ul className="divide-y divide-stone-100">{page.rows.map(contact => {
        const identity = reportIdentity(contact), score = contactScore(contact);
        return <li key={contact.id} className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0"><h2 className="font-semibold [overflow-wrap:anywhere]">{identity.label}</h2>{identity.email && identity.email !== identity.label && <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">{identity.email}</p>}<p className="mt-2 text-sm text-slate-600 [overflow-wrap:anywhere]">{quizTitles.get(contact.formId)} · {contactResultTitle(contact)}</p><p className="mt-2 text-xs text-slate-500">{date(contact.submittedAt)} · {contact.contact?.marketingConsent === true ? "Marketing opted in" : "No marketing consent"}{score.value === null ? "" : ` · ${score.value}% ${score.label.toLowerCase()}`}</p>{contact.contact?.phone && <p className="mt-2 text-sm text-slate-600 [overflow-wrap:anywhere]">Phone: {contact.contact.phone}</p>}</div>
          <div className="flex shrink-0 flex-wrap gap-3"><Link href={`/reports/${encodeURIComponent(contact.formId)}`} className="hq-secondary">View report</Link><Link href={`/editor/${encodeURIComponent(contact.formId)}?section=contacts`} className="hq-secondary">Manage quiz contacts</Link></div>
        </div></li>;
      })}</ul> : <div className="p-8 text-center"><Users className="mx-auto mb-3 text-slate-400" size={28} aria-hidden="true" /><h2 className="font-semibold">{contacts.length ? "No contacts match these filters" : "No contacts yet"}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{contacts.length ? "Try another search or clear the filters." : "Contacts appear when visitors complete a published quiz and share their details. Enable lead collection in Basic mode under Publish. Preview runs do not create contacts."}</p>{!contacts.length && <Link href="/" className="hq-secondary mt-5 inline-flex">Go to my quizzes</Link>}</div>}
      {matching.length > 0 && <nav aria-label="Contact pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 p-5"><p className="text-xs text-slate-500">Page {page.page} of {page.pages} · 25 per page</p><div className="flex gap-3"><button className="hq-secondary disabled:opacity-40" disabled={page.page <= 1} onClick={() => setRequestedPage(page.page - 1)}>Previous</button><button className="hq-secondary disabled:opacity-40" disabled={page.page >= page.pages} onClick={() => setRequestedPage(page.page + 1)}>Next</button></div></nav>}
    </section>
  </main>;
}

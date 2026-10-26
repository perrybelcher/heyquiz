import Link from "next/link";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import MarketingBriefBuilder from "@/components/MarketingBriefBuilder";
import { AIAccountGate } from "@/components/AIQuizBuilder";
import { currentUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata;
export const dynamic = "force-dynamic";

export default async function MarketingCreatePage() {
  const user = await currentUser();
  if (!user) return (
    <><WorkspaceHeader guest />
    <main className="pippi-app min-h-screen bg-[#faf8f5] px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/create" className="text-sm font-semibold text-stone-600 underline underline-offset-4">All creation options</Link>
        <h1 className="mb-7 mt-9 text-3xl font-semibold tracking-tight text-stone-900">Create a marketing quiz</h1>
        <AIAccountGate returnTo="/create/marketing" />
      </div>
    </main></>
  );
  return <MarketingBriefBuilder aiAvailable={Boolean(process.env.GEMINI_API_KEY)} />;
}

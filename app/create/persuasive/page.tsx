import { requirePageUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";
import MarketingBriefBuilder from "@/components/MarketingBriefBuilder";

export const metadata = privateMetadata;
export const dynamic = "force-dynamic";

export default async function PersuasiveCreatePage() {
  await requirePageUser("/create/persuasive");
  return <MarketingBriefBuilder initialQuizType="diagnostic" persuasive aiAvailable={Boolean(process.env.GEMINI_API_KEY)} />;
}

import MarketingBriefBuilder from "@/components/MarketingBriefBuilder";
import { requirePageUser } from "@/lib/auth";
export default async function MarketingCreatePage() {
  await requirePageUser();
  return <MarketingBriefBuilder aiAvailable={Boolean(process.env.GEMINI_API_KEY)} />;
}

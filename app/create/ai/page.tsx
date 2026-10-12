import AIQuizBuilder from "@/components/AIQuizBuilder";
import { currentUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata;
export const dynamic = "force-dynamic";

export default async function AICreatePage() {
  const user = await currentUser();
  return <AIQuizBuilder signedIn={Boolean(user)} aiAvailable={Boolean(process.env.GEMINI_API_KEY)} />;
}

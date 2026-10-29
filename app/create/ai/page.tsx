import { redirect } from "next/navigation";
import { creationQuizType, creationTypeHref } from "@/lib/creation-quiz-type";
import AIQuizBuilder from "@/components/AIQuizBuilder";
import { currentUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata;
export const dynamic = "force-dynamic";

export default async function AICreatePage({searchParams}:{searchParams:Promise<{quizType?:string}>}) {
  const quizType=creationQuizType((await searchParams).quizType);
  if(quizType && quizType!=="knowledge")redirect(creationTypeHref("/create/marketing",quizType));
  const user = await currentUser();
  return <AIQuizBuilder initialQuizType={quizType} signedIn={Boolean(user)} aiAvailable={Boolean(process.env.GEMINI_API_KEY)} />;
}

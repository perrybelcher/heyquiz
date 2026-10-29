import CreationStart from "@/components/CreationStart";
import { creationQuizType } from "@/lib/creation-quiz-type";
export default async function CreatePage({ searchParams }: { searchParams: Promise<{ quizType?: string }> }) {
  return <CreationStart initialQuizType={creationQuizType((await searchParams).quizType)} />;
}

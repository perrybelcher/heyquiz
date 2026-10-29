import { creationQuizType } from "@/lib/creation-quiz-type";
import TemplateLibrary from "@/components/TemplateLibrary";
export const metadata = { title: "Quiz templates | Pippi", description: "Explore personality, product matching, diagnostic, qualification, knowledge and scorecard quizzes. Complete 8-question and 30-question examples, plus the existing template collection." };
export default async function TemplatesPage({searchParams}:{searchParams:Promise<{quizType?:string}>}) { return <TemplateLibrary initialQuizType={creationQuizType((await searchParams).quizType)} />; }

import { creationQuizType } from "@/lib/creation-quiz-type";
import TemplateLibrary from "@/components/TemplateLibrary";
export const metadata = { title: "Marketing quiz templates | Pippi", description: "Browse 43 free, editable quiz templates for retail, home services, education, travel, nonprofits, and more. Product finders, service matchers, and scorecards." };
export default async function TemplatesPage({searchParams}:{searchParams:Promise<{quizType?:string}>}) { return <TemplateLibrary initialQuizType={creationQuizType((await searchParams).quizType)} />; }

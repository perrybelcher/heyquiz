import BlankQuizBuilder from "@/components/BlankQuizBuilder";
import { creationQuizType } from "@/lib/creation-quiz-type";
export default async function Page({searchParams}:{searchParams:Promise<{quizType?:string}>}) {
 return <BlankQuizBuilder initialQuizType={creationQuizType((await searchParams).quizType)}/>;
}

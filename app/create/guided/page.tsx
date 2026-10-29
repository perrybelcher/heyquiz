import GuestBuilder from "@/components/GuestBuilder";
import { creationQuizType } from "@/lib/creation-quiz-type";
export default async function Page({searchParams}:{searchParams:Promise<{quizType?:string}>}) {
 return <GuestBuilder initialQuizType={creationQuizType((await searchParams).quizType)}/>;
}

"use client";
import { outcomeCreationEnabled } from "@/lib/outcome-availability";
import { quizTypes, quizTypeDefinitions, type QuizType } from "@/lib/quiz-types";
const descriptions: Record<QuizType,string> = {personality:"Personality profiles and audience segments.",product_finder:"Products, services and packages that fit.",diagnostic:"One primary challenge and an action plan.",qualification:"An appropriate route and explicit next step.",knowledge:"Correct answers, grades and explanations.",scorecard:"Scores by category and practical advice."};
export default function QuizTypeChooser({onSelect,selected}:{onSelect:(type:QuizType)=>void;selected?:QuizType}) {
  return <section aria-label="Choose quiz outcome" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{quizTypes.filter(type=>outcomeCreationEnabled || quizTypeDefinitions[type].scored).map(type=><button type="button" key={type} aria-pressed={selected===type} onClick={()=>onSelect(type)} className={`rounded-2xl border bg-white p-6 text-left hover:border-red-800 focus-visible:outline-2 focus-visible:outline-red-800 ${selected===type?"border-red-800 ring-1 ring-red-800":"border-stone-200"}`}><span className="block text-lg font-semibold">{quizTypeDefinitions[type].label}</span><span className="mt-2 block text-sm text-slate-600">{descriptions[type]}</span></button>)}</section>;
}

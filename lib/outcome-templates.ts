import { blankQuiz } from "./blank-quiz";
import { launchTemplate } from "./launch-templates";
import { FormSchema } from "./schema";
import type { QuizType } from "./quiz-types";
/** Explicit starter fixtures, editable through the same form model as every template. */
export function outcomeTemplate(type:QuizType,id:string) {
  if(type==='product_finder'||type==='scorecard')return {...launchTemplate(type,id),quizType:type};
  const form=blankQuiz(id,type);
  if(type==='knowledge')return FormSchema.parse({...form,title:'Everyday knowledge',questions:[{id:'capital',type:'multiple_choice',title:'Which city is the capital of France?',required:true,points:1,options:[{id:'paris',label:'Paris',isCorrect:true},{id:'rome',label:'Rome',isCorrect:false}]}]});
  const titles=type==='personality'?['The planner','The explorer']:type==='diagnostic'?['Unclear priorities','Inconsistent follow-up']:['Book a consultation','Start with a guide'];
  const qTitle=type==='personality'?'How do you prefer to start a new project?':type==='diagnostic'?'What most often slows your progress?':'What support are you looking for?';
  const labels=type==='personality'?['Make a clear plan','Explore different possibilities']:type==='diagnostic'?['Not knowing what matters most','Losing track of the next step']:['Personal advice for an active project','Ideas I can explore on my own'];
  return FormSchema.parse({...form,title:type==='personality'?'Discover your working style':type==='diagnostic'?'Find your biggest process challenge':'Find your next step',description:'Fictional example. Review the results and replace this wording with your own.',questions:[{id:'preference',type:'multiple_choice',title:qTitle,required:true,points:0,options:labels.map((label,i)=>({id:`answer-${i}`,label}))}],marketing:{...form.marketing,outcomes:titles.map((title,i)=>({id:`result-${i}`,title,description:labels[i],advice:type==='diagnostic'?(i===0?'Write down your top priority and choose one action for this week.':'Assign an owner and a dated next action to each open inquiry.'):'Review this suggested next step and adapt it to your situation.',ctaLabel:i===0?'Explore my next step':'Read the guide',ctaUrl:'',minPoints:1})),rules:type==='qualification'?[]:titles.map((_,i)=>({id:`match-${i}`,questionId:'preference',answerId:`answer-${i}`,targetId:`result-${i}`,effect:'add',points:1,reason:labels[i]})),...(type==='qualification'?{qualificationRules:titles.map((_,i)=>({id:`route-${i}`,outcomeId:`result-${i}`,match:'all',conditions:[{questionId:'preference',operator:'equals',value:`answer-${i}`}]}))}:{})}});
}

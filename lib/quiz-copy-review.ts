import type { FormSchemaType } from "./schema";
export type CopyFinding = {questionId:string;message:string};
// Editorial hints, not a scientific persuasion score. Never change scoring or
// respondent answers automatically; creators decide whether a suggestion fits.
export function reviewQuizCopy(form: FormSchemaType): CopyFinding[] {
  const findings:CopyFinding[]=[];
  const seen=new Set<string>();
  for(const q of form.questions){
    const title=q.title.trim();
    const normalized=title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const add=(message:string)=>findings.push({questionId:q.id,message});
    if(!title) add("Give this question a clear title before saving.");
    if(seen.has(normalized))add("This repeats an earlier question. Ask for new information or remove it in the editor.");
    seen.add(normalized);
    if(title.split(/\s+/).length>24)add("Shorten this question so someone can understand it in one reading.");
    if(/don't you agree|wouldn't you|surely you|obviously|you must agree/i.test(title))add("Ask for their view without suggesting which answer you want.");
    const copy=[title,...(q.options||[]).map(o=>o.label)].join(" ");
    if(/guaranteed|100% guaranteed|risk.free|double your|triple your|cure\b/i.test(copy))add("Check this claim against evidence. Avoid promising a result the quiz cannot establish.");
    if(/lazy|stupid|loser|stay broke|don't care|do not care|keep failing/i.test(copy))add("Give every answer equal dignity. Replace language that shames someone for choosing differently.");
    if((q.options?.length||0)>1){
      const labels=q.options!.map(o=>o.label.trim().toLowerCase());
      if(labels.some(l=>!l))add("Fill in every answer label before saving.");
      if(new Set(labels).size<labels.length)add("Make the answer choices distinct; duplicate labels are confusing.");
      if(!labels.some(l=>/not sure|unsure|none|something else|not applicable|prefer not|doesn.t apply/.test(l)))add("Consider a genuine unsure or none-of-these option so visitors are not forced into a fit.");
    }
  }
  return findings;
}

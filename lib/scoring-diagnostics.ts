import type { FormSchemaType } from './schema';
import { evaluateMarketing } from './marketing';

/** Bounded exhaustive checks, never a claim of proof for branching or multi-select quizzes. */
export function scoringDiagnostics(form: FormSchemaType) {
  const m = form.marketing;
  const warnings: string[] = [];
  if (!m) return {warnings, checkedPaths:0, exhaustive:false};
  const targets = m.kind === 'scorecard' ? m.categories : m.outcomes;
  for (const target of targets) {
    const rules = m.rules.filter(r=>r.targetId===target.id);
    if (!rules.some(r=>r.effect==='add' && r.points>0)) warnings.push(`${target.title}: no positive answer points are mapped.`);
    for (const r of rules.filter(r=>r.effect==='exclude')) if(rules.some(x=>x.effect==='add'&&x.questionId===r.questionId&&x.answerId===r.answerId)) {
      warnings.push(`${target.title}: an answer both adds points and excludes this result. Exclusion wins.`);break;
    }
  }
  const choices=form.questions.filter(q=>q.options?.length);
  const unmapped=choices.reduce((n,q)=>n+(q.options||[]).filter(o=>!m.rules.some(r=>r.questionId===q.id&&r.answerId===o.id)).length,0);
  if(unmapped)warnings.push(`${unmapped} answer choices have no scoring rules. Confirm these are intentional neutral answers.`);
  const exhaustive = choices.length>0 && m.kind!=='scorecard' && !(form.logicRules?.length) && choices.length===form.questions.length && choices.every(q=>['multiple_choice','dropdown','picture_choice','segmented'].includes(q.type)) && choices.reduce((n,q)=>n*((q.options?.length||0)+(q.required?0:1)),1)<=4096;
  let checkedPaths=0,ties=0,fallbacks=0;
  const reached=new Set<string>();
  if(exhaustive) {
    const visit=(i:number,answers:Record<string,string>)=>{
      if(i<choices.length){const q=choices[i];for(const o of q.options||[])visit(i+1,{...answers,[q.id]:o.id});if(!q.required)visit(i+1,answers);return;}
      checkedPaths++;
      const result=evaluateMarketing(form,answers);
      if(result?.outcomeId)reached.add(result.outcomeId);else fallbacks++;
      const scores=m.outcomes.map(t=>({id:t.id,points:m.rules.filter(r=>r.targetId===t.id&&r.effect==='add'&&answers[r.questionId]===r.answerId).reduce((n,r)=>n+r.points,0),min:t.minPoints,excluded:m.rules.some(r=>r.targetId===t.id&&r.effect==='exclude'&&answers[r.questionId]===r.answerId)})).filter(t=>!t.excluded&&t.points>0&&t.points>=t.min).sort((a,b)=>b.points-a.points);
      if(scores.length>1&&scores[0].points===scores[1].points)ties++;
    };
    visit(0,{});
    for(const t of m.outcomes)if(!reached.has(t.id))warnings.push(`${t.title}: unreachable across all ${checkedPaths} checked answer paths.`);
    if(ties)warnings.push(`${ties} answer paths tie for first place. The first result in your list wins.`);
    if(fallbacks)warnings.push(`${fallbacks} answer paths show the fallback instead of a recommendation.`);
  }
  return {warnings,checkedPaths,exhaustive};
}

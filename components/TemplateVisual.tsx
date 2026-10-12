import { ArrowUpRight, Check } from 'lucide-react';
import type { FormSchemaType } from '@/lib/schema';

/** A miniature, noninteractive cover preview derived from the real quiz theme. */
export default function TemplateVisual({form,large=false}:{form:FormSchemaType;large?:boolean}){
 const theme=form.theme;
 const scorecard=form.marketing?.kind==='scorecard';
 const title=form.coverPage?.title||form.title;
 return <div role="group" aria-label="Quiz design preview" className={`relative overflow-hidden ${large?'rounded-xl p-7 sm:p-10':'rounded-xl p-5'}`} style={{background:theme.backgroundColor,color:theme.textColor,minHeight:large?260:220}}>
  <>{form.coverPage?.imageUrl&&<img src={form.coverPage.imageUrl} alt="" loading="lazy" decoding="async" className={`mb-5 w-full rounded-lg object-cover ${large?'max-h-72':'h-36'}`} width={1280} height={720}/>}</>
  <div className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[.18em] opacity-70"><span>{scorecard?'A little clarity goes a long way':'Find what feels right for you'}</span><span>01 / {String(form.questions.length).padStart(2,'0')}</span></div>
  <div className={`relative z-10 mt-7 max-w-[78%] font-semibold leading-[1.12] tracking-tight ${large?'text-3xl sm:text-4xl':'text-2xl'}`} style={{fontFamily:theme.font==='serif'?'Georgia, serif':undefined}}>{title}</div>
  {large&&<p className="relative z-10 mt-4 max-w-md text-sm leading-relaxed opacity-80">{form.coverPage?.subtitle}</p>}
  <div className="relative z-10 mt-6 inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-[10px] font-semibold text-white" style={{background:theme.primaryColor}}>{form.coverPage?.buttonText}<ArrowUpRight size={13}/></div>
  <div aria-hidden="true" className="absolute -bottom-9 -right-9 h-40 w-40 rounded-full border-[20px] opacity-10" style={{borderColor:theme.primaryColor}}/>
  <div aria-hidden="true" className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80" style={{color:theme.primaryColor}}>{scorecard?<span className="text-xl font-semibold">↗</span>:<Check size={24}/>}</div>
 </div>;
}

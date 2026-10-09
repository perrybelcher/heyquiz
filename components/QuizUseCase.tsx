import Link from "next/link";
import Image from "next/image";
import "./SalesPage.css";
export type UseCase = { title:string; intro:string; sections:{title:string;text:string}[]; example:string; faq:{question:string;answer:string}[] };
export default function QuizUseCase({title,intro,sections,example,faq}:UseCase) {
 return <div className="hq-sales-page"><header className="sales-nav"><Link href="/" aria-label="Pippi home"><Image src="/pippi-logo.svg" alt="Pippi" width={150} height={75}/></Link><Link className="sales-button" href="/create">Create your quiz</Link></header>
 <main id="main" className="sales-width" style={{maxWidth:960,paddingTop:64,paddingBottom:80}}>
 <p className="sales-eyebrow">FREE QUIZ BUILDER • NO CODE REQUIRED</p>
 <h1 style={{fontSize:"clamp(2.25rem,5vw,4rem)",lineHeight:1.1,margin:"20px 0"}}>{title}</h1>
 <p style={{fontSize:"1.25rem",lineHeight:1.7,maxWidth:760}}>{intro}</p>
 <p style={{margin:"28px 0 48px"}}><Link href="/create" className="sales-button">Start building free</Link></p>
 {sections.map(section=><section key={section.title} style={{marginBottom:36}}><h2 style={{fontSize:"1.75rem",marginBottom:12}}>{section.title}</h2><p style={{fontSize:"1.125rem",lineHeight:1.8}}>{section.text}</p></section>)}
 <aside style={{padding:28,background:"#f5eeee",borderRadius:20,margin:"40px 0"}}><h2 style={{fontSize:"1.5rem",marginBottom:12}}>A practical example</h2><p style={{lineHeight:1.8}}>{example}</p></aside>
 <section><h2 style={{fontSize:"1.75rem",marginBottom:20}}>Before you build</h2>{faq.map(item=><details key={item.question} style={{padding:"18px 0",borderBottom:"1px solid #ddd"}}><summary style={{fontWeight:600,cursor:"pointer"}}>{item.question}</summary><p style={{lineHeight:1.8,marginTop:12}}>{item.answer}</p></details>)}</section>
 <p style={{marginTop:32}}>Start creating without signing up. Create a free account to save your work.</p>
 </main><footer className="sales-width sales-footer"><Link href="/">Pippi quiz builder</Link><nav aria-label="Explore quiz types"><Link href="/lead-generation-quiz-builder">Lead generation</Link><Link href="/product-recommendation-quiz-builder">Product recommendations</Link><Link href="/scorecard-builder">Scorecards</Link></nav></footer></div>;
}

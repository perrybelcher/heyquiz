import { blankQuiz } from "../blank-quiz";
import { FormSchema } from "../schema";
import type { AuthoredTemplate } from "../authored-template-contract";

type Practice = [id:string, title:string];
type Category = { id:string; title:string; focus:string; start:string; repeat:string; maintain:string; questions:Practice[] };
const marketing: Category[] = [
 {id:"audience",title:"Audience",focus:"Understanding the situations and language of the people you serve",start:"Speak with two recent customers about what prompted them to look for help.",repeat:"Keep a shared note of customer situations and review it before your next campaign.",maintain:"Check whether recent enquiries reveal a new audience need or an outdated assumption.",questions:[
 ["mh-audience-trigger","How consistently do you record what prompted a new customer to seek help?"],
 ["mh-audience-language","How consistently do you keep customers' own descriptions of the problem for future copy?"],
 ["mh-audience-segment","How consistently do you identify which customer group a campaign is intended to reach before writing it?"],
 ["mh-audience-interview","How consistently do you ask recent customers what mattered when choosing a provider?"],
 ["mh-audience-limits","How consistently do you explain when your offer is unsuitable for an enquiry?"],
 ]},
 {id:"positioning",title:"Positioning",focus:"Explaining the offer and its boundaries",start:"Rewrite one offer description with its intended customer, included work and key limits.",repeat:"Use the same clear offer description across one page, sales reply and listing.",maintain:"Ask someone unfamiliar with your business to explain the offer back to you and update confusing details.",questions:[
 ["mh-positioning-scope","How consistently do offer pages state what is included and what is outside the scope?"],
 ["mh-positioning-tradeoff","How consistently do you explain practical trade-offs between your packages?"],
 ["mh-positioning-proof","How consistently do you include the context and limitations of customer examples you publish?"],
 ["mh-positioning-price","How consistently do you explain prices or the factors used to prepare a quote?"],
 ["mh-positioning-promise","How consistently do sales conversations and website copy describe the same offer?"],
 ]},
 {id:"visibility",title:"Visibility",focus:"Maintaining relevant ways for customers to find the offer",start:"Choose one discovery route your customers use and check its details and destination link.",repeat:"Assign an owner to keep that route accurate and publish answers to relevant customer questions.",maintain:"Review whether your active routes still attract the intended enquiries before adding channels.",questions:[
 ["mh-visibility-route","How consistently do you maintain at least one discovery channel that customers say they use?"],
 ["mh-visibility-listings","How consistently do you update public listings when contact details or services change?"],
 ["mh-visibility-content","How consistently does your published content address a specific question customers have asked?"],
 ["mh-visibility-links","How consistently do you check links from active posts, listings or campaigns?"],
 ["mh-visibility-owner","How consistently does a named person review your active public channels?"],
 ]},
 {id:"conversion",title:"Conversion",focus:"Making the next step clear and usable",start:"Submit a test enquiry on a phone and fix the first obstacle you encounter.",repeat:"Schedule a repeat check of the form, confirmation and receiving inbox after changes.",maintain:"Observe a new user attempting the next step and test one evidence-based improvement.",questions:[
 ["mh-conversion-mobile","How consistently do you test the enquiry process on a small phone screen after changing it?"],
 ["mh-conversion-action","How consistently do calls to action explain what happens after a person clicks?"],
 ["mh-conversion-fields","How consistently do you limit required enquiry fields to information needed for the first response?"],
 ["mh-conversion-errors","How consistently do you check that form errors explain the fix and preserve valid input?"],
 ["mh-conversion-confirm","How consistently do enquiry confirmations set realistic expectations for a response?"],
 ]},
 {id:"followup",title:"Follow-up",focus:"Handling enquiries with clear ownership and next actions",start:"Choose a shared enquiry queue and give each open enquiry an owner.",repeat:"Add a dated next action and a clear out-of-hours process to the queue.",maintain:"Review a sample of stalled enquiries and confirm contact preferences are respected.",questions:[
 ["mh-followup-owner","How consistently is a single owner recorded for each new enquiry?"],
 ["mh-followup-hours","How consistently are out-of-hours enquiries picked up at the next stated check time?"],
 ["mh-followup-context","How consistently can the person replying see the original request and earlier conversation?"],
 ["mh-followup-next","How consistently do active enquiries have an agreed next action and date?"],
 ["mh-followup-preference","How consistently are requests to stop contact reflected in the shared enquiry record?"],
 ]},
 {id:"measurement",title:"Measurement",focus:"Using comparable records to choose a next improvement",start:"Record enquiry source and stage in a simple shared list, allowing unknown where necessary.",repeat:"Review records from a defined period and assign one follow-up action.",maintain:"Check data completeness and account for long decision cycles before judging a change.",questions:[
 ["mh-measurement-source","How consistently do you record the source of an enquiry using agreed labels?"],
 ["mh-measurement-stage","How consistently do enquiry stages use the same definitions across the team?"],
 ["mh-measurement-period","How consistently do reports use defined periods and account for customers who decide later?"],
 ["mh-measurement-loss","How consistently do you distinguish stated reasons for not buying from reasons you do not know?"],
 ["mh-measurement-action","How consistently does a marketing review produce an owner, action and review date?"],
 ]},
];
const onboarding:Category[] = [
 {id:"expectations",title:"Expectations",focus:"Giving a new customer a shared picture of the work",start:"Write a short welcome note with scope and the first milestone.",repeat:"Use the note for every new customer and check that they understand it.",maintain:"Review recent misunderstandings and update the welcome note where needed.",questions:[
 ["onboarding-scope","How consistently do new customers receive a written summary of the agreed scope?"],
 ["onboarding-milestone","How consistently do you agree the first useful milestone with the customer?"],
 ]},
 {id:"handover",title:"Handover",focus:"Transferring promises and ownership from sales to delivery",start:"Create a short handover record for the next customer.",repeat:"Include agreed promises and one named delivery contact in every handover.",maintain:"Check a sample of handovers against the original sales conversation.",questions:[
 ["onboarding-promises","How consistently does the delivery team receive the promises made during the sale?"],
 ["onboarding-contact","How consistently does a new customer know their main contact and how to reach them?"],
 ]},
 {id:"activation",title:"First use",focus:"Helping customers reach the first useful step",start:"List the access or information needed for the customer's first step.",repeat:"Check those prerequisites and guide the customer through one useful task.",maintain:"Review where new customers stall and simplify one first-use instruction.",questions:[
 ["onboarding-access","How consistently do you check that a customer has the access or materials needed to begin?"],
 ["onboarding-task","How consistently do you guide a new customer through the first task that delivers value?"],
 ]},
 {id:"checkin",title:"Check-in",focus:"Finding early friction and agreeing the next step",start:"Arrange an early check-in for the next new customer.",repeat:"Ask about unresolved obstacles and record the agreed next action.",maintain:"Compare recurring early obstacles and improve the onboarding step causing them.",questions:[
 ["onboarding-friction","How consistently do early check-ins ask about obstacles rather than only general satisfaction?"],
 ["onboarding-next","How consistently is an owner and date recorded for issues raised during onboarding?"],
 ]},
];
const operations:Category[] = [
 {id:"priorities",title:"Priorities",focus:"Keeping work aligned when requests compete",start:"Put this week's priorities in an agreed order.",repeat:"Use the list when accepting new requests and explicitly change it when needed.",maintain:"Review recent urgent changes and adjust the decision rule if it caused confusion.",questions:[
 ["ops-priorities","How consistently does the team agree which tasks take priority when requests compete?"],
 ["ops-scope","How consistently do changes to a task include an explicit scope or timing trade-off?"],
 ]},
 {id:"ownership",title:"Ownership",focus:"Making responsibility and handoffs visible",start:"Name one owner for each active task.",repeat:"Include current context and the next action when handing work over.",maintain:"Review blocked tasks for handoff gaps and update the shared process.",questions:[
 ["ops-owner","How consistently can someone see the owner of an active task without asking around?"],
 ["ops-handoff","How consistently do handoffs include current files, context and the next action?"],
 ]},
 {id:"capacity",title:"Capacity",focus:"Making commitments that fit the available time",start:"Compare planned work with the team's available time for this week.",repeat:"Defer, reduce or reassign work when commitments exceed that time.",maintain:"Review recurring interruptions and reserve realistic capacity for them.",questions:[
 ["ops-load","How consistently do you compare planned work with available team time before committing?"],
 ["ops-interruptions","How consistently are nonurgent incoming requests queued without interrupting focused work?"],
 ]},
 {id:"learning",title:"Learning",focus:"Using completed work to improve the next cycle",start:"Agree what finished means for one task and review it after completion.",repeat:"Record one useful lesson and an owner to apply it in the next cycle.",maintain:"Check whether past improvements actually changed the recurring problem.",questions:[
 ["ops-done","How consistently are acceptance conditions agreed before work begins?"],
 ["ops-review","How consistently does a completed-work review produce a concrete change for the next cycle?"],
 ]},
];
function bands(id:string,start:string,repeat:string,maintain:string){return [
 {id:`${id}-start`,min:0,max:33,title:"Build the foundation",advice:"Few of these practices are established in the situations you reported. Start with one manageable change.",action:start,ctaLabel:"Plan my next step",ctaUrl:""},
 {id:`${id}-repeat`,min:34,max:66,title:"Make the practice repeatable",advice:"Some practices are in place, but consistency varies. Focus on a repeatable process rather than adding more tasks.",action:repeat,ctaLabel:"Plan my next step",ctaUrl:""},
 {id:`${id}-maintain`,min:67,max:100,title:"Maintain and refine",advice:"You report more consistent practices in this area. Check real examples and address exceptions before expanding the process.",action:maintain,ctaLabel:"Plan my next step",ctaUrl:""},
];}
function template(id:string,title:string,summary:string,categories:Category[]):AuthoredTemplate{
 const count=categories.reduce((n,c)=>n+c.questions.length,0);
 return {id,quizType:"scorecard",title,summary,audience:"Small business owners and team leads reviewing their own operating practices",length:count===30?"comprehensive":"short",featured:count===30,build(formId){return FormSchema.parse({...blankQuiz(formId,"scorecard"),title,description:`${summary} Think about the last three months and answer for situations that occurred. Not sure / not applicable is excluded from scoring. These example bands describe reported practice, not business performance or an industry benchmark.`,theme:{primaryColor:"#4338ca",backgroundColor:"#eef2ff",cardColor:"#ffffff",layout:"step"},questions:categories.flatMap(c=>c.questions.map(([id,title])=>({id,type:"multiple_choice",title,description:c.title,required:true,points:0,options:[{id:"not-yet",label:"Not yet — we have no regular practice"},{id:"sometimes",label:"Sometimes — it depends on the person or situation"},{id:"usually",label:"Usually — the practice exists but has occasional gaps"},{id:"consistently",label:"Consistently — it is used in nearly all relevant situations"},{id:"unknown",label:"Not sure / not applicable"}]}))),marketing:{kind:"scorecard",presentation:{layout:"score_overview"},fallbackTitle:"More information is needed",fallbackMessage:"There is not enough answered evidence to score an area. Review recent examples or ask the relevant person. Unknown answers are not treated as zero.",scorecard:{title:"Your practice review",message:`This is a self-reported snapshot, not a validated benchmark or a prediction of results. Each category needs ${count===30?"at least three of its five":"both of its two"} practices answered. Overall results appear only when every category has enough evidence.`,bands:bands("overall","Choose one low-scoring area and apply its first action this week.","Choose one inconsistent area, name an owner and agree a review date.","Review real examples to confirm the practices still work and improve one exception.")},categories:categories.map(c=>({id:c.id,title:c.title,description:c.focus,minAnswers:count===30?3:2,bands:bands(c.id,c.start,c.repeat,c.maintain)})),rules:categories.flatMap(c=>c.questions.flatMap(([qid])=>["not-yet","sometimes","usually","consistently"].map((answerId,points)=>({id:`${qid}-${answerId}`,questionId:qid,answerId,targetId:c.id,effect:"add",points,reason:""}))))}});}};
}
export const scorecardTemplates:AuthoredTemplate[]=[
 template("scorecard-marketing-health","Small Business Marketing Health Check","Review six areas of marketing practice with five questions in each area.",marketing),
 template("scorecard-onboarding","Customer Onboarding Scorecard","Review expectations, handover, first use and early check-ins.",onboarding),
 template("scorecard-team-operations","Team Operations Scorecard","Review priorities, ownership, capacity and learning in eight practical questions.",operations),
];

import type { AuthoredTemplate } from "../authored-template-contract";
import { blankQuiz } from "../blank-quiz";
import { FormSchema } from "../schema";
import type { QualificationCondition, QualificationRule } from "../qualification";

type Route = {id:string;title:string;description:string;advice:string;ctaLabel:string};
function choice(id:string,theme:string,title:string,labels:string[],gate=false) {
  return {id,type:"multiple_choice",title,description:`${theme}. ${gate ? "This answer is used in the example route conditions." : "Context for your next conversation; this answer does not change eligibility."}`,required:true,points:0,options:[...labels,"Not sure / not applicable"].map((label,i)=>({id:`${id}-${i===labels.length?"unknown":["a","b","c"][i]}`,label}))};
}
function number(id:string,theme:string,title:string,max:number) {
  return {id,type:"number",title,description:`${theme}. Example route threshold; not an industry standard. Enter a known estimate, or leave blank if unknown.`,required:false,points:0,minVal:0,maxVal:max};
}
const eq=(questionId:string,value:string):QualificationCondition=>({questionId,operator:"equals",value:`${questionId}-${value}`});
const gt=(questionId:string,value:number):QualificationCondition=>({questionId,operator:"greater_than",value:String(value)});
const lt=(questionId:string,value:number):QualificationCondition=>({questionId,operator:"less_than",value:String(value)});
// Expand inclusive numeric thresholds into existing equals/greater-than rules.
// This preserves exact decimal boundaries without adding an evaluator operator.
function atLeast(id:string,outcomeId:string,conditions:QualificationCondition[],bounds:[string,number][]):QualificationRule[] {
  let groups=[conditions];
  for(const [questionId,value] of bounds) groups=groups.flatMap(group=>[
    [...group,{questionId,operator:"equals" as const,value:String(value)}],
    [...group,gt(questionId,value)],
  ]);
  return groups.map((group,i)=>({id:`${id}-${i}`,outcomeId,match:"all",conditions:group}));
}
function qualified(id:string,title:string,intro:string,questions:unknown[],outcomes:Route[],rules:QualificationRule[]) {
  return FormSchema.parse({...blankQuiz(id,"qualification"),title,description:intro,questions,marketing:{kind:"qualification",outcomes:outcomes.map(o=>({...o,ctaUrl:""})),qualificationRules:rules,fallbackTitle:"We need a little more information",fallbackMessage:"No example route has enough confirmed information yet. Review the unanswered requirements or discuss your situation with the provider. An unknown answer does not satisfy a requirement, and this result is not an approval or rejection."},theme:{...blankQuiz(id).theme,primaryColor:"#315578",backgroundColor:"#f4f7fa"}});
}
const implementationQuestions = [
  choice("i01","Use case","What do you want the implementation service to deliver?",["A defined internal workflow using tools we already have","Help define which workflow and tools we should use","Resources to explore the idea ourselves first"],true),
  choice("i02","Use case","Which process would be the first candidate?",["Handling incoming enquiries","Coordinating delivery after a sale","Maintaining an internal information handover"]),
  choice("i03","Use case","What currently starts that process?",["A form or system event","An email or message","A person notices that action is needed"]),
  choice("i04","Use case","What would count as a completed first delivery?",["One workflow running for a small pilot group","A documented process and implementation brief","A clearer view of what is feasible"]),
  choice("i05","Use case","What must stay outside the first project?",["Replacing our main business system","Changing the entire team's responsibilities","Automating decisions without a person's review"]),
  choice("i06","Project ownership","Who can approve the first workflow's scope?",["A named owner is available and authorised","We know the team but have not assigned an owner","We are not ready to assign project ownership"],true),
  choice("i07","Project ownership","Who would answer day-to-day process questions?",["The person who performs the work","A team lead who coordinates the work","Several people with different responsibilities"]),
  choice("i08","Project ownership","How would the project owner prefer to review progress?",["A scheduled review of a working example","Written updates with specific decisions to make","A shared checklist reviewed asynchronously"]),
  choice("i09","Project ownership","Who should test the first version?",["One experienced user","A small group representing different roles","The owner and the person taking over support"]),
  choice("i10","Project ownership","How are changes to the agreed scope usually approved?",["The owner decides after reviewing impact","A small group agrees at a scheduled meeting","The budget holder confirms changes in writing"]),
  choice("i11","Process readiness","How well defined is the workflow you want implemented?",["Steps and exceptions are documented for a pilot","We can explain it, but need to agree the steps","The process needs to be designed first"],true),
  choice("i12","Process readiness","Where does the current workflow most often pause?",["Waiting for information","Waiting for a decision","Waiting for someone to take ownership"]),
  choice("i13","Process readiness","What happens when an unusual case occurs?",["A named person handles it manually","The team discusses it before continuing","It is set aside until more information arrives"]),
  choice("i14","Process readiness","How will you compare the pilot with today's process?",["Time taken to complete a case","Number of missed handovers","Clarity of ownership and next actions"]),
  choice("i15","Process readiness","What should happen if the new workflow is unavailable?",["Return to the existing manual steps","Pause new cases and notify an owner","Keep a separate queue for later processing"]),
  choice("i16","Data readiness","Can you provide authorised test data and access for a pilot?",["Yes; an authorised owner can supply a safe test sample","We need to confirm permissions or prepare a safe sample","No; we cannot provide appropriate test access yet"],true),
  choice("i17","Data readiness","Where does the information needed for the workflow live?",["One main system","Several connected systems","Documents, spreadsheets and messages"]),
  choice("i18","Data readiness","Which data issue should be reviewed first?",["Missing required fields","Duplicate or inconsistent records","Unclear ownership of updates"]),
  choice("i19","Data readiness","What would make a test sample useful?",["It covers the most common case","It includes a few known exceptions","It shows the handover between two roles"]),
  choice("i20","Data readiness","How should the project team record data questions?",["A list reviewed with the data owner","Comments beside example records","A shared issue tracker with assigned owners"]),
  number("i21","Resources","How many staff hours per week are confirmed for the pilot?",80),
  choice("i22","Resources","Who will maintain the workflow after handover?",["An internal operations owner","An internal technical owner","An external support provider to be agreed"]),
  choice("i23","Resources","What kind of training would your team use?",["A live walkthrough with practice cases","A written guide with screenshots","Short recordings for each common task"]),
  choice("i24","Resources","How will you collect feedback from pilot users?",["A brief recurring review","A shared feedback form","A nominated user gathers team comments"]),
  choice("i25","Resources","Which ongoing cost needs clarification?",["Software subscriptions","Provider support time","Internal maintenance time"]),
  number("i26","Timing","How many weeks are available before your target pilot launch?",104),
  choice("i27","Timing","What determines the target launch date?",["An internal planning milestone","A customer or supplier commitment","An opportunity to test during a quieter period"]),
  choice("i28","Timing","What could interrupt the pilot schedule?",["Key people taking leave","Another system change","A busy trading or delivery period"]),
  choice("i29","Timing","How would you prefer to roll out a successful pilot?",["Add more users to the same workflow","Add one related workflow","Keep the pilot small until support is settled"]),
  choice("i30","Timing","What should the first planning conversation produce?",["A confirmed pilot scope and responsibilities","A list of open decisions and owners","A realistic preparation checklist"]),
];
const implementationRoutes: Route[] = [
  {id:"pilot",title:"Discuss a scoped implementation pilot",description:"You supplied the core evidence for this fictional pilot offer: defined use case, authorised owner, documented workflow, safe test access, at least 4 confirmed staff hours weekly and at least 6 weeks before launch. These example thresholds are not a quote, approval or guarantee.",advice:"Bring the workflow outline and a safe sample to a scoping conversation. Confirm access, security requirements, cost and acceptance criteria before any work begins. Other answers give context and do not add hidden eligibility points.",ctaLabel:"Discuss the example pilot"},
  {id:"scoping",title:"Start with a scoping conversation",description:"You explicitly indicated that the use case, ownership, process or test access still needs definition. A scoping conversation is the next example route, not confirmation that implementation can begin.",advice:"List the decisions that are still open and who can answer them. Use the conversation to agree a small scope, an owner and safe test access. Confirm resources and timing before choosing a delivery offer.",ctaLabel:"Arrange a scoping conversation"},
  {id:"preparation",title:"Use a preparation checklist first",description:"You explicitly chose self-guided exploration or identified a preparation constraint. This example route offers time to prepare; it does not judge your business or rule out future support.",advice:"Choose one workflow, assign an owner and document what a safe pilot would need. Confirm available staff time and a realistic launch window before returning to the service discussion.",ctaLabel:"Open the preparation checklist"},
];
const implementationRules: QualificationRule[] = [
  ...atLeast("pilot-ready","pilot",[eq("i01","a"),eq("i06","a"),eq("i11","a"),eq("i16","a")],[["i21",4],["i26",6]]),
  {id:"prepare-first",outcomeId:"preparation",match:"any",conditions:[eq("i01","c"),eq("i06","c"),eq("i11","c"),eq("i16","c"),lt("i21",4),lt("i26",6)]},
  {id:"scope-first",outcomeId:"scoping",match:"any",conditions:[eq("i01","b"),eq("i06","b"),eq("i11","b"),eq("i16","b")]},
];
const renovationQuestions = [
  choice("r01","Project scope","Which description best fits the work you want to discuss?",["Cosmetic changes such as finishes and fittings","Changes that may affect structure or building services","I want information before choosing a project"],true),
  choice("r02","Authority","Can you authorise a professional to assess the property?",["Yes, I am the owner or have documented permission","I need to obtain the owner's permission","I am researching a property I do not control"],true),
  number("r03","Timing","How many weeks remain before you hope to start work?",104),
  choice("r04","Location","Where is the main area you want to change?",["Kitchen or bathroom","Living or sleeping space","Several rooms or an external area"]),
  choice("r05","Use","How will the property be used while work happens?",["We expect to remain in it","It can be empty during the work","We need to plan around tenants or other occupants"]),
  choice("r06","Brief","What information can you bring to an initial discussion?",["Photos and a list of desired changes","Drawings or a previous professional assessment","A rough idea and questions to explore"]),
  choice("r07","Priorities","Which practical constraint should the provider hear first?",["Keeping essential rooms usable","Working within a planned spending limit","Coordinating with another scheduled project"]),
  choice("r08","Next step","What would be most useful from the first conversation?",["Clarifying the scope and next decisions","Understanding which professional should assess it","A checklist of information to gather"]),
];
const renovationRoutes: Route[] = [
  {id:"assessment",title:"Arrange a professional assessment",description:"You confirmed authority to arrange an assessment and indicated possible structural or building-service work. This fictional route prioritises professional assessment; the quiz cannot determine permissions, safety or technical feasibility.",advice:"Describe the proposed changes and provide existing plans if available. Ask a qualified local professional which assessments and permissions apply before planning the work. Do not treat this route as permission to start.",ctaLabel:"Discuss a professional assessment"},
  {id:"brief",title:"Prepare a cosmetic-project brief",description:"You described cosmetic work, confirmed authority and allowed at least 4 weeks before your intended start. That meets this fictional provider's discussion threshold, not a guarantee of availability or a technical assessment.",advice:"Gather photos, list the finishes or fittings to change and describe access and occupancy constraints. Ask the provider to confirm scope, costs and timing before booking work.",ctaLabel:"Discuss a cosmetic-project brief"},
  {id:"research",title:"Gather information before booking",description:"You explicitly indicated that permission, project definition or timing needs attention. This route helps prepare the next conversation; it does not assess the property or the legality of proposed work.",advice:"Confirm who can authorise an assessment, write down the desired changes and review the intended schedule. For possible structural or service changes, seek professional advice before deciding what work to undertake.",ctaLabel:"Open the project preparation guide"},
];
const renovationRules: QualificationRule[] = [
  {id:"professional-first",outcomeId:"assessment",match:"all",conditions:[eq("r01","b"),eq("r02","a")]},
  ...atLeast("cosmetic-brief","brief",[eq("r01","a"),eq("r02","a")],[["r03",4]]),
  {id:"prepare-information",outcomeId:"research",match:"any",conditions:[eq("r01","c"),eq("r02","b"),eq("r02","c"),lt("r03",4)]},
];
const trainingQuestions = [
  choice("t01","Starting point","Which spreadsheet task can you already complete without a guide?",["Create a table and use a basic formula","Enter data, but I need help with formulas","I have not used a spreadsheet yet"],true),
  number("t02","Practice time","How many hours per week can you commit to practice?",40),
  choice("t03","Access","Do you have access to the spreadsheet software used in the example course?",["Yes, and I can open and edit a practice file","I still need to arrange access","I want to explore the topic before arranging software"],true),
  choice("t04","Goal","What would you like to do with spreadsheets?",["Track work or household information","Summarise records for a small team","Check and clean an existing list"]),
  choice("t05","Practice material","Which practice example would be most useful?",["A simple task tracker","An inventory or expense list","A small customer or event list with fictional data"]),
  choice("t06","Support","How do you prefer to ask for help?",["During a live demonstration","After trying an exercise on my own","Through written examples I can revisit"]),
  choice("t07","Schedule","When would practice most realistically fit?",["One planned session each week","Several short sessions","Time that changes from week to week"]),
  choice("t08","Application","How will you use what you learn first?",["Create a new personal sheet","Improve a simple team sheet","Understand a sheet someone else maintains"]),
];
const trainingRoutes: Route[] = [
  {id:"applied",title:"Applied spreadsheet workshop",description:"You reported independent table and formula skills, confirmed software access and at least 2 hours of weekly practice. These are fictional course prerequisites based on self-report; they do not certify your skill.",advice:"Try the provider's sample exercise and confirm the actual course software and schedule. Bring a fictional practice dataset; do not upload confidential work records to a public example.",ctaLabel:"Review the applied workshop"},
  {id:"foundations",title:"Spreadsheet foundations course",description:"You reported limited formula experience, confirmed software access and at least 1 hour of weekly practice. This meets the fictional foundations route, subject to the provider confirming the course format.",advice:"Check that you can open a practice file and set aside a weekly session. Review the sample lesson and accessibility arrangements before enrolling.",ctaLabel:"Review the foundations course"},
  {id:"orientation",title:"Start with a self-paced orientation",description:"You explicitly indicated a need to arrange software, explore first or allow less practice time. This example route helps you prepare without implying that you have met course prerequisites.",advice:"Explore a sample lesson, arrange suitable software access and decide how much practice time you can reserve. Return to the course choices when those details are known.",ctaLabel:"Open the orientation materials"},
];
const trainingRules: QualificationRule[] = [
  ...atLeast("applied-ready","applied",[eq("t01","a"),eq("t03","a")],[["t02",2]]),
  ...atLeast("foundations-beginner","foundations",[eq("t01","b"),eq("t03","a")],[["t02",1]]),
  ...atLeast("foundations-new","foundations",[eq("t01","c"),eq("t03","a")],[["t02",1]]),
  {id:"orientation-access",outcomeId:"orientation",match:"any",conditions:[eq("t03","b"),eq("t03","c"),lt("t02",1)]},
  {id:"orientation-practice",outcomeId:"orientation",match:"all",conditions:[eq("t01","a"),lt("t02",2)]},
];
export const qualificationTemplates: AuthoredTemplate[] = [
  {id:"implementation-fit-30",quizType:"qualification",title:"Is your business ready for our implementation service?",summary:"Review a pilot's use case, ownership, process, data, resources and timing.",audience:"Service providers discussing a workflow implementation pilot",length:"comprehensive",featured:true,build:id=>qualified(id,"Is your business ready for our implementation service?","This 30-question example routes you to a pilot conversation, preparation checklist or scoping conversation, in that priority order. Only marked requirements affect routing; other questions prepare the discussion. Fictional thresholds are 4 staff hours per week and 6 weeks before launch. Unknown information never satisfies a requirement. Replace these conditions and configure destination links before publishing.",implementationQuestions,implementationRoutes,implementationRules)},
  {id:"renovation-next-step-8",quizType:"qualification",title:"Find the right renovation next step",summary:"Use scope, authority and timing to choose the next project conversation.",audience:"Renovation providers helping people prepare an initial enquiry",length:"short",featured:false,build:id=>qualified(id,"Find the right renovation next step","Eight questions suggest a next conversation, not building, legal or safety advice. This fictional service prioritises professional assessment, then a cosmetic brief, then preparation. Its 4-week planning threshold is an example, not a rule or promise. Unknown requirements do not qualify. Configure real service conditions and destination links before publishing.",renovationQuestions,renovationRoutes,renovationRules)},
  {id:"training-route-8",quizType:"qualification",title:"Which training route can you join?",summary:"Choose among applied training, foundations and orientation using explicit prerequisites.",audience:"Training providers presenting example spreadsheet learning routes",length:"short",featured:false,build:id=>qualified(id,"Which training route can you join?","Eight questions suggest a fictional spreadsheet learning route. Applied training requires reported basic skills, software access and 2 practice hours weekly; foundations requires access and 1 hour. Applied is checked first, then foundations, then orientation. This is self-reported preparation, not certification or confirmed enrolment. Unknown requirements do not qualify. Replace course details and configure destination links before publishing.",trainingQuestions,trainingRoutes,trainingRules)},
];

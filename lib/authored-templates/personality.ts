import { blankQuiz } from "../blank-quiz";
import { FormSchema } from "../schema";
import type { AuthoredTemplate } from "../authored-template-contract";

type Prompt = [id: string, theme: string, title: string, structured: string, exploratory: string, relational: string];
type Profile = [id: string, title: string, description: string, advice: string];
const working: Prompt[] = [
  ['brief','Starting work','A new assignment arrives with a loose brief. What helps you begin?','Write down the deliverable and constraints','Try a small example to discover possibilities','Talk through the request with the people involved'],
  ['first-hour','Starting work','You have an uninterrupted first hour on a project. Where do you put it?','Break the work into steps','Explore a possible approach','Understand who needs what from the work'],
  ['unknown-task','Starting work','You face a task you have never done before. What do you reach for first?','A worked checklist or reference process','A sandbox where I can try it','Someone who has done something similar'],
  ['workspace','Starting work','Before starting a concentrated session, what do you arrange?','The files and tasks in the order I need them','A rough canvas for sketches and experiments','A way to ask questions or get quick feedback'],
  ['motivation','Starting work','Which starting point makes an unclear project feel more approachable?','Knowing what finished means','Finding an interesting angle','Knowing how it will help someone'],
  ['weekly-plan','Planning','How do you usually shape a week with several competing tasks?','Allocate blocks for the main deliverables','Reserve room to follow emerging opportunities','Coordinate commitments with collaborators'],
  ['estimate','Planning','Someone asks how long an unfamiliar task will take. How do you estimate it?','Split it into smaller parts and estimate each','Run a short trial before estimating the rest','Compare assumptions with the people doing the work'],
  ['milestone','Planning','What kind of checkpoint helps you most during a long project?','A scheduled deliverable review','A chance to test a new version','A conversation about what others now need'],
  ['dependency','Planning','Your next step depends on another team. What do you tend to do?','Make the dependency and date explicit','Explore work I can test independently','Arrange a conversation to coordinate the handoff'],
  ['task-list','Planning','Which task-list format would you choose for your own use?','An ordered list with dates','A flexible board of ideas and experiments','A shared list showing who is involved'],
  ['options','Decisions','Two approaches could work. What usually breaks the tie for you?','How well each meets agreed criteria','Which can teach us something with a small trial','Which fits the people who will use it'],
  ['incomplete-data','Decisions','You must decide with incomplete information. What do you do first?','Identify the missing fact most likely to change the decision','Choose a reversible experiment','Discuss the uncertainty with affected people'],
  ['purchase','Decisions','You are choosing a tool for your work. What is your first comparison?','Requirements, cost and reliability','What I can discover by trying it','How comfortably my collaborators can use it'],
  ['disagreement','Decisions','A colleague prefers a different approach. What helps you decide together?','Agree on criteria and compare the options','Build a small example of each approach','Explore the needs behind each preference'],
  ['risk','Decisions','What makes you comfortable taking a project risk?','Clear limits and a recovery plan','A small, reversible test','Agreement from those who will be affected'],
  ['meeting','Collaboration','What role do you naturally take in a working meeting?','Clarify decisions and next steps','Offer alternative ways to approach the topic','Draw out views that have not been heard'],
  ['feedback','Collaboration','What feedback format is easiest for you to act on?','Specific comments against agreed requirements','Reactions to an early prototype','A discussion about how the work lands for people'],
  ['handoff','Collaboration','When giving work to a colleague, what do you emphasize?','Instructions, dependencies and completion criteria','What we tried and what remains open to exploration','Who can help and which relationships matter'],
  ['remote','Collaboration','How would you prefer to coordinate a remote task?','Written updates with clear owners','Shared prototypes people can comment on','Short conversations when people need alignment'],
  ['help','Collaboration','A teammate is stuck. What support do you offer first?','Help isolate the next concrete step','Suggest another angle to try','Ask what is making the task difficult for them'],
  ['scope','Handling change','The requested scope changes halfway through. What do you check first?','What this changes in the plan and deadline','What new possibilities it opens','Who needs to be consulted about the change'],
  ['tool-change','Handling change','Your team adopts a new tool. How do you get comfortable?','Learn the core workflow from its guide','Try features in a low-risk example','Work through a real task with a colleague'],
  ['interruption','Handling change','An urgent request interrupts focused work. What helps you switch?','Record my stopping point and reprioritize','Find a quick way to test the new request','Clarify the urgency with the person asking'],
  ['failed-attempt','Handling change','An approach does not work as expected. What is your next move?','Compare the result with the original assumptions','Try a different version','Get perspectives from the people closest to the issue'],
  ['uncertainty','Handling change','During a week of frequent changes, what keeps you oriented?','A current list of decisions and priorities','A sequence of small experiments','Regular contact with the people involved'],
  ['final-check','Finishing work','Before handing over a finished piece of work, what do you focus on?','Check it against the agreed requirements','Try it in an unexpected situation','Ask whether the recipient can use it comfortably'],
  ['deadline','Finishing work','A deadline is close and optional refinements remain. How do you choose?','Finish the agreed essentials first','Pick the refinement with the clearest testable benefit','Ask which refinement matters most to the recipient'],
  ['documentation','Finishing work','What do you most want to leave behind after a project?','A repeatable process and clear records','Lessons from experiments and promising ideas','Shared understanding and useful contacts'],
  ['retrospective','Finishing work','What question do you most want answered in a project review?','Where did the process help or slow us?','What did we discover that we can try next?','How well did we work with the people involved?'],
  ['satisfaction','Finishing work','Which moment most often tells you a project is complete?','The requirements are checked and handed over','The idea works in a real test','The people using it understand their next step'],
];
const travel: Prompt[] = [
 ['weekend','Trip rhythm','You have a free weekend in a new city. Which plan appeals most?','Reserve a few highlights and leave gaps between them','Choose a neighbourhood and see what turns up','Ask local people where they spend their weekends'],
 ['stay','Accommodation','Which detail matters most when choosing where to stay?','A dependable base near the places on my list','Access to an area I have not explored','A host or shared space where conversations happen'],
 ['meal','Food','How would you choose your first evening meal?','Use a short list that fits my preferences','Try a menu I have not encountered before','Follow a recommendation from someone I meet'],
 ['free-day','Flexibility','A planned activity is cancelled. What sounds best instead?','Choose a backup from my saved options','Follow an unexpected opportunity','Join something suggested by a local contact'],
 ['souvenir','Memories','What would you most enjoy bringing home?','A record of the places I set out to visit','A story about an unexpected discovery','A recipe or tradition someone shared with me'],
 ['transport','Getting around','For a day trip, which approach suits you?','Check routes and return times in advance','Take a route with interesting stops to explore','Travel with a guide or small group'],
 ['activity','Activities','Which afternoon would you choose?','A booked visit to a landmark I want to understand','A self-directed walk with room for detours','A workshop led by someone who lives there'],
 ['pace','Travel pace','What makes a trip feel well spent to you?','Enjoying the experiences I planned without rushing','Finding something I could not have predicted','Feeling connected to people and their everyday life'],
];
const home: Prompt[] = [
 ['room','Room atmosphere','What would you like to notice first when entering your living room?','Clear space and a few considered pieces','An unusual mix that feels personal','Soft textures and a welcoming place to sit'],
 ['shelf','Display','How would you arrange an open shelf?','Leave space around a small number of objects','Mix books, art and unexpected finds','Group familiar objects and useful everyday items'],
 ['colour','Colour','Which colour approach would you enjoy living with?','A limited palette with subtle contrasts','Contrasting colours or a distinctive accent','Warm tones that work with natural materials'],
 ['furniture','Furniture','Which chair would you be drawn to first?','A simple shape with a practical footprint','A distinctive vintage or statement piece','A comfortable upholstered seat'],
 ['lighting','Lighting','What evening lighting would you prefer?','A few clean, adjustable light sources','A striking lamp that becomes a feature','Several soft pools of light around the room'],
 ['purchase','New pieces','When adding something to your home, what guides your choice?','Whether it serves a clear purpose without adding clutter','Whether it brings character I do not already have','Whether it makes daily life more comfortable'],
 ['hosting','Hosting','How would you prepare your room for friends visiting?','Clear surfaces and arrange an easy flow','Set out something interesting to discover or discuss','Add seats, cushions and places to put drinks'],
 ['refresh','Refreshing a room','Which small refresh would you enjoy most?','Remove unused items and simplify the arrangement','Move art and introduce an unexpected combination','Add texture and improve the comfortable corners'],
];
function define(id: string, title: string, summary: string, audience: string, prompts: Prompt[], profiles: Profile[]): AuthoredTemplate {
 return {id,quizType:'personality',title,summary,audience,length:prompts.length===30?'comprehensive':'short',featured:prompts.length===30,build(formId){
  const questions=prompts.map(([qid,theme,text,...answers],index)=>({id:qid,type:'multiple_choice',title:text,description:`${theme}. Choose the closest fit; there is no right answer.`,required:true,points:0,options:[...answers.map((label,i)=>({id:`${qid}-${profiles[i][0]}`,label})).slice(index%3),...answers.map((label,i)=>({id:`${qid}-${profiles[i][0]}`,label})).slice(0,index%3),{id:`${qid}-unsure`,label:'Not sure / it depends'}]}));
  return FormSchema.parse({...blankQuiz(formId,'personality'),title,description:`${summary} Choose what fits you most often, rather than what sounds ideal. This informal example reflects preferences in these situations, not a validated psychological assessment. Mixed preferences are normal.`,questions,settings:{showProgressBar:true,progressBarMode:'questions',showReviewBeforeSubmit:true},marketing:{kind:'segmentation',fallbackTitle:'No clear preference yet',fallbackMessage:'Your answers do not provide enough evidence for one profile. Review the situations you can answer, or compare the three descriptions without treating one as a diagnosis.',outcomes:profiles.map(([pid,name,description,advice])=>({id:pid,title:name,description:`${description} This is the closest of three example profiles based on your selected answers; it is not a fixed identity.`,advice,ctaLabel:'Explore this style',ctaUrl:'',minPoints:2})),rules:prompts.flatMap(([qid,,text,...answers])=>profiles.map(([pid],i)=>({id:`${qid}-${pid}-rule`,questionId:qid,answerId:`${qid}-${pid}`,targetId:pid,points:1,effect:'add',reason:`${text} You chose: ${answers[i]}.`})))}});
 }};
}
export const personalityTemplates: AuthoredTemplate[] = [
 define('personality-working-style','Discover your working style','Explore how you start, plan, decide, collaborate, adapt and finish work.','Teams and independent professionals',working,[
 ['planner','The structured planner','Your selected situations lean toward clarity, criteria and repeatable steps.','For your next project, write a one-page plan with a clear finish line. Leave one checkpoint open for a new idea or colleague perspective.'],
 ['explorer','The practical explorer','Your selected situations lean toward learning through examples, trials and alternative approaches.','Choose one small experiment for your next project. Set a time limit and record what result would make you keep or change the approach.'],
 ['connector','The collaborative connector','Your selected situations lean toward shared understanding and the needs of people involved.','Bring the key people together to agree on the next step. Record one owner and one decision so the conversation turns into action.'],
 ]),
 define('personality-traveller','What kind of traveller are you?','Find a travel rhythm that fits the experiences you enjoy.','Travel planners and curious holidaymakers',travel,[
 ['planner','The considered planner','Your choices lean toward a dependable base and deliberately chosen experiences.','Pick two priority experiences for your next trip, check their practical details and leave one afternoon unplanned.'],
 ['explorer','The curious explorer','Your choices lean toward discovery, detours and trying unfamiliar experiences.','Choose one walkable area to explore, then check transport and a return plan before setting off.'],
 ['connector','The local-life connector','Your choices lean toward conversations, shared activities and everyday local life.','Look for a locally hosted activity that welcomes visitors, and read how to participate respectfully before booking.'],
 ]),
 define('personality-home-style','Discover your home style','Explore the spaces, objects and atmosphere you enjoy at home.','Homeowners and renters planning a room refresh',home,[
 ['planner','Calm and considered','Your choices lean toward simple forms, useful objects and visual breathing room.','Start with one surface: remove what you do not use, keep one piece you enjoy and check that the arrangement works for daily life.'],
 ['explorer','Expressive and collected','Your choices lean toward character, contrast and personal discoveries.','Create a small arrangement using pieces you already own. Repeat one colour or material to connect the mix before buying anything.'],
 ['connector','Warm and welcoming','Your choices lean toward comfort, texture and spaces people can settle into.','Choose one sitting area and improve its light, comfort and place for a drink. Try the arrangement before adding more furniture.'],
 ]),
];

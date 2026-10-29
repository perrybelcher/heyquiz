import type { QuizType } from "./quiz-types";

export interface CreationExample {
  templateId: string;
  image: string;
  imageAlt: string;
  focalPoint: string;
  title: string;
  resultHeading: string;
  explanation: string;
  nextStep: string;
}

/** Lightweight editorial excerpts from the referenced authored templates.
 * Keep participant result copy in sync when those templates change.
 * No factory imports: browsing the creation page must not load quiz engines.
 */
export const creationExamples: Record<QuizType, CreationExample> = {
  "personality": {
    "templateId": "personality-working-style",
    "image": "/create/environment-workspace.webp",
    "imageAlt": "Hands writing in a notebook at a sunlit home workspace",
    "focalPoint": "65% 50%",
    "title": "Discover your working style",
    "resultHeading": "The structured planner",
    "explanation": "Your selected situations lean toward clarity, criteria and repeatable steps. This is the closest of three example profiles based on your selected answers; it is not a fixed identity.",
    "nextStep": "For your next project, write a one-page plan with a clear finish line. Leave one checkpoint open for a new idea or colleague perspective."
  },
  "product_finder": {
    "templateId": "ideal-coffee-8",
    "image": "/templates/lifestyle/coffee.webp",
    "imageAlt": "A freshly prepared coffee at a warm wooden table",
    "focalPoint": "50% 50%",
    "title": "Find your ideal coffee",
    "resultHeading": "Fruit-forward sample",
    "explanation": "Fictional regular-caffeine coffee with fruit-forward tasting notes. Your preferences point toward trying this style; roast, origin and brewing can change the actual taste.",
    "nextStep": "Ask a roaster for a small sample, confirm the grind suits your brewer and taste it before buying a larger bag. Tasting notes describe a sensory impression, not added ingredients."
  },
  "diagnostic": {
    "templateId": "diagnostic-lead-generation",
    "image": "/create/environment-workspace.webp",
    "imageAlt": "An overhead view of a notebook and laptop on a warm wooden desk",
    "focalPoint": "65% 50%",
    "title": "What is holding back your lead generation?",
    "resultHeading": "Clarify who the offer is for",
    "explanation": "Your answers supplied evidence of gaps in audience or offer clarity. This is a place to investigate, not proof that positioning causes your sales results.",
    "nextStep": "1. Review five recent enquiries and write down the situation that prompted each one.\n2. Rewrite one offer page around a specific customer problem, scope and next step.\n3. Ask two people in that audience to explain the offer back to you; revise unclear wording."
  },
  "qualification": {
    "templateId": "implementation-fit-30",
    "image": "/create/environment-consultation.webp",
    "imageAlt": "A warm consultation table with project documents and gesturing hands",
    "focalPoint": "65% 50%",
    "title": "Is your business ready for our implementation service?",
    "resultHeading": "Discuss a scoped implementation pilot",
    "explanation": "You supplied the core evidence for this fictional pilot offer: defined use case, authorised owner, documented workflow, safe test access, at least 4 confirmed staff hours weekly and at least 6 weeks before launch. These example thresholds are not a quote, approval or guarantee.",
    "nextStep": "Bring the workflow outline and a safe sample to a scoping conversation. Confirm access, security requirements, cost and acceptance criteria before any work begins. Other answers give context and do not add hidden eligibility points."
  },
  "knowledge": {
    "templateId": "knowledge-suspicious-messages",
    "image": "/create/environment-messages.webp",
    "imageAlt": "Hands checking a laptop message at a cozy window-side desk",
    "focalPoint": "65% 50%",
    "title": "Can you spot a suspicious message?",
    "resultHeading": "Build your foundation",
    "explanation": "Review the explanations for the situations you missed or were unsure about. Choose two principles to practise, then retake the quiz. These bands are example learning feedback, not an external standard.",
    "nextStep": "Display names can be imitated. Check unusual requests through a known channel."
  },
  "scorecard": {
    "templateId": "scorecard-marketing-health",
    "image": "/create/environment-workspace.webp",
    "imageAlt": "A sunlit desk with planning notes, coffee and a laptop",
    "focalPoint": "65% 50%",
    "title": "Small Business Marketing Health Check",
    "resultHeading": "Audience · Build the foundation",
    "explanation": "Few of these practices are established in the situations you reported. Start with one manageable change.",
    "nextStep": "Speak with two recent customers about what prompted them to look for help."
  }
};

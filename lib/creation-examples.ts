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
    "templateId": "personality-traveller",
    "image": "/create/lifestyle-travel.webp",
    "imageAlt": "Turquoise Mediterranean cove below a colourful coastal village",
    "focalPoint": "50% 50%",
    "title": "What kind of traveller are you?",
    "resultHeading": "The curious explorer",
    "explanation": "Your choices lean toward discovery, detours and trying unfamiliar experiences. This is the closest of three example profiles based on your selected answers; it is not a fixed identity.",
    "nextStep": "Choose one walkable area to explore, then check transport and a return plan before setting off."
  },
  "product_finder": {
    "templateId": "ideal-coffee-8",
    "image": "/create/lifestyle-coffee.webp",
    "imageAlt": "Coffee and a croissant on a tiled courtyard terrace with bougainvillea",
    "focalPoint": "50% 50%",
    "title": "Find your ideal coffee",
    "resultHeading": "Fruit-forward sample",
    "explanation": "Fictional regular-caffeine coffee with fruit-forward tasting notes. Your preferences point toward trying this style; roast, origin and brewing can change the actual taste.",
    "nextStep": "Ask a roaster for a small sample, confirm the grind suits your brewer and taste it before buying a larger bag. Tasting notes describe a sensory impression, not added ingredients."
  },
  "diagnostic": {
    "templateId": "diagnostic-lead-generation",
    "image": "/create/lifestyle-growth.webp",
    "imageAlt": "Sunlit glasshouse filled with lush plants along a terracotta path",
    "focalPoint": "50% 50%",
    "title": "What is holding back your lead generation?",
    "resultHeading": "Clarify who the offer is for",
    "explanation": "Your answers supplied evidence of gaps in audience or offer clarity. This is a place to investigate, not proof that positioning causes your sales results.",
    "nextStep": "1. Review five recent enquiries and write down the situation that prompted each one.\n2. Rewrite one offer page around a specific customer problem, scope and next step.\n3. Ask two people in that audience to explain the offer back to you; revise unclear wording."
  },
  "qualification": {
    "templateId": "implementation-fit-30",
    "image": "/create/lifestyle-routes.webp",
    "imageAlt": "Alpine walking trails overlooking a turquoise mountain lake",
    "focalPoint": "50% 50%",
    "title": "Is your business ready for our implementation service?",
    "resultHeading": "Discuss a scoped implementation pilot",
    "explanation": "You supplied the core evidence for this fictional pilot offer: defined use case, authorised owner, documented workflow, safe test access, at least 4 confirmed staff hours weekly and at least 6 weeks before launch. These example thresholds are not a quote, approval or guarantee.",
    "nextStep": "Bring the workflow outline and a safe sample to a scoping conversation. Confirm access, security requirements, cost and acceptance criteria before any work begins. Other answers give context and do not add hidden eligibility points."
  },
  "knowledge": {
    "templateId": "knowledge-suspicious-messages",
    "image": "/create/lifestyle-library.webp",
    "imageAlt": "Warm walnut library with a curved staircase and a burgundy reading chair",
    "focalPoint": "50% 50%",
    "title": "Can you spot a suspicious message?",
    "resultHeading": "Build your foundation",
    "explanation": "Review the explanations for the situations you missed or were unsure about. Choose two principles to practise, then retake the quiz. These bands are example learning feedback, not an external standard.",
    "nextStep": "Display names can be imitated. Check unusual requests through a known channel."
  },
  "scorecard": {
    "templateId": "scorecard-marketing-health",
    "image": "/create/lifestyle-court.webp",
    "imageAlt": "Aerial view of a red tennis court with green surroundings and long shadows",
    "focalPoint": "50% 50%",
    "title": "Small Business Marketing Health Check",
    "resultHeading": "Audience \u00b7 Build the foundation",
    "explanation": "Few of these practices are established in the situations you reported. Start with one manageable change.",
    "nextStep": "Speak with two recent customers about what prompted them to look for help."
  }
};

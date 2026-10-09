import QuizUseCase from "@/components/QuizUseCase";
import { publicMetadata } from "@/lib/seo";
export const metadata = publicMetadata("Free Scorecard Quiz Builder | Pippi","Create scored assessments with different points per answer, category scores, and personalized advice. Build your scorecard quiz free with Pippi.","/scorecard-builder");
const content = {
  "title": "A scorecard builder that turns answers into useful advice.",
  "intro": "Help people see where they stand and what to work on next. Create a scored assessment with category results, clear explanations, and a relevant follow-up action.",
  "sections": [
    {
      "title": "Define what the assessment measures",
      "text": "Choose a small set of categories that relate to the audience’s goal. For a business assessment, these might be operations, follow-up, and measurement. Explain each category in plain language. Your scorecard is a guide based on self-reported answers, not an independently validated diagnosis or certification."
    },
    {
      "title": "Give different answers different points",
      "text": "Assign points to individual answer choices instead of giving every response the same value. A consistent process might receive more points than an occasional one. Include a genuine zero-point choice where appropriate, and check that the scoring reflects your intended interpretation of the answers."
    },
    {
      "title": "Make each score band useful",
      "text": "Configure category score bands and write advice for each level. Someone beginning a process needs a manageable first step; someone with an established process may benefit from a refinement. Pippi supports personalized category advice so the result can explain the score rather than display a number alone."
    },
    {
      "title": "Test the boundaries before publishing",
      "text": "Try an all-low response, an all-high response, and a mixed response. Check category boundaries and any skipped questions. Review the final advice and call to action for each path, then publish and complete the public quiz as a visitor. Use completion and lead analytics to improve the experience over time."
    }
  ],
  "example": "A follow-up readiness scorecard could measure response habits and performance tracking separately. A visitor with strong response habits but weak tracking should receive practical measurement advice, rather than a generic message based only on a total score.",
  "faq": [
    {
      "question": "Can multiple-choice answers have different scores?",
      "answer": "Yes. Set points for each answer choice and configure the categories and result rules that interpret those points."
    },
    {
      "question": "Can I use a scorecard for lead generation?",
      "answer": "Yes. Pair the assessment with lead capture and a relevant next-step link. Clearly explain the value of sharing contact details and request marketing consent separately."
    }
  ]
};
export default function Page() { return <QuizUseCase {...content}/>; }

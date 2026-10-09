import QuizUseCase from "@/components/QuizUseCase";
import { publicMetadata } from "@/lib/seo";
export const metadata = publicMetadata("Free Lead Generation Quiz Builder | Pippi","Create a lead generation quiz that helps visitors find their next step. Build questions, capture leads, and personalize results with Pippi. Start free.","/lead-generation-quiz-builder");
const content = {
  "title": "A lead generation quiz builder that starts a useful conversation.",
  "intro": "Give visitors a reason to share more than an email address. Build an interactive quiz that helps them understand their needs, then connect their answers to a relevant result and next step.",
  "sections": [
    {
      "title": "Ask questions that help both sides",
      "text": "Start with the decision your visitor is trying to make. Ask about their goals, current situation, and biggest obstacle. Keep the language familiar and give people an honest option when they are unsure. Useful answers help you understand a potential customer; useful results give them a reason to finish."
    },
    {
      "title": "Build a quiz funnel around a clear next step",
      "text": "Choose the result categories first, then connect answer choices to those outcomes. A visitor who needs foundational help should see different advice from someone ready for an advanced service. Use branching when a question only applies to some visitors. End with one relevant action, such as exploring a service or booking a conversation."
    },
    {
      "title": "Capture leads without losing the conversation",
      "text": "Explain why you are asking for contact details and keep marketing consent separate. Pippi supports lead capture and personalized results, so the quiz can deliver value as well as collect a response. Preview each path and test the published link before sending traffic."
    },
    {
      "title": "Learn where visitors stop",
      "text": "Review quiz starts, completions, leads, and next-step clicks in the analytics. Look for questions where people leave and simplify the wording or choices. These signals can guide improvements, but they are not a guarantee of sales. Connect the quiz outcome to your actual follow-up process."
    }
  ],
  "example": "A consultant could ask about inquiry volume, follow-up consistency, and sales visibility. The results might recommend improving lead capture, creating a follow-up routine, or measuring the sales process. Each result can point to the service that addresses that need.",
  "faq": [
    {
      "question": "Can I add the quiz to my website?",
      "answer": "Yes. Publish your quiz and use its direct link or iframe embed. Test the embed on your own page and on a phone before launch."
    },
    {
      "question": "Do visitors have to create an account?",
      "answer": "Quiz takers can use a published quiz without a Pippi creator account. You need a free creator account to save and manage your quiz."
    }
  ]
};
export default function Page() { return <QuizUseCase {...content}/>; }

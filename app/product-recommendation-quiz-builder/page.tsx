import QuizUseCase from "@/components/QuizUseCase";
import { publicMetadata } from "@/lib/seo";
export const metadata = publicMetadata("Product Recommendation Quiz Builder | Pippi","Build product recommendation quizzes that match answers to relevant products. Customize questions, result rules, and destination links with Pippi.","/product-recommendation-quiz-builder");
const content = {
  "title": "Help shoppers find what fits with a product recommendation quiz.",
  "intro": "Turn a long list of choices into a guided decision. Ask shoppers what matters to them, then recommend a product based on the answers they actually give.",
  "sections": [
    {
      "title": "Start with the differences shoppers care about",
      "text": "A good product finder translates product features into everyday needs. Instead of asking shoppers to choose technical specifications, ask how they will use the product, what they need to carry, or which trade-offs matter most. Keep questions specific enough to improve the recommendation."
    },
    {
      "title": "Connect answers to product matches",
      "text": "Create your product outcomes and assign answer weights to them. Use exclusions for answers that make a product unsuitable. Review ties and cases where no product fits before publishing. A recommendation should reflect the rules you configured, not imply that the quiz knows more than the customer has shared."
    },
    {
      "title": "Explain the recommendation",
      "text": "Give each result a clear description of who it suits and why someone might choose it. Add a destination link to the relevant product page. The quiz helps guide the decision; purchasing happens on your linked store or website. Keep availability, pricing, and checkout details accurate at that destination."
    },
    {
      "title": "Publish, embed, and refine",
      "text": "Share the public quiz link or embed it in your website. Customize the quiz theme in Pippi; an iframe does not automatically inherit your website styles. Review completions and result clicks to see whether the journey is useful, then test clearer questions or more helpful result descriptions."
    }
  ],
  "example": "A bag retailer could ask what a shopper carries, whether a laptop needs protection, and how much space they want. A light everyday load might lead to a sling, while work essentials point to a backpack. A product exclusion can prevent an unsuitable match.",
  "faq": [
    {
      "question": "Does this require a Shopify app?",
      "answer": "You can share a published quiz link or use an iframe embed on a site that supports it. This page does not promise native Shopify catalog synchronization or checkout integration."
    },
    {
      "question": "Can I change the recommended destination?",
      "answer": "Yes. Configure the destination link for the result so shoppers can continue to the relevant product or information page."
    }
  ]
};
export default function Page() { return <QuizUseCase {...content}/>; }

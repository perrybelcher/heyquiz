import type { Metadata } from "next";
import SalesPage from "@/components/SalesPage";
export const metadata: Metadata = {
  title: "pippi — The right question changes everything",
  description:
    "Create product finders, audience segmentation quizzes, and personalized scorecards. Turn thoughtful questions into meaningful next steps with pippi.",
  alternates: { canonical: "https://heyquiz-fawn.vercel.app/welcome" },
  openGraph: {
    title: "pippi — The right question changes everything",
    description:
      "Help people find what fits. Product finders, scorecards, and quizzes with a more personal next step.",
    images: [
      {
        url: "https://heyquiz-fawn.vercel.app/images/quiz-bags.webp",
        width: 1536,
        height: 1024,
      },
    ],
  },
};
// Always public, including for signed-in users who want to share the sales page.
export default function WelcomePage() {
  return <SalesPage />;
}

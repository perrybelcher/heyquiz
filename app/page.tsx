import type { Metadata } from "next";
import { getAllForms } from "@/lib/storage";
import { currentUser } from "@/lib/auth";
import SalesPage from "@/components/SalesPage";
import Dashboard from "@/components/Dashboard";
export const metadata: Metadata = {
  title: "pippi — The right question changes everything",
  description:
    "Build product finders, audience segmentation quizzes, and personalized scorecards with useful conversion analytics.",
};
// Resolve the session per request; never cache one user’s workspace as public HTML.
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const user = await currentUser();
  // The public introduction shares this URL, while existing users keep their dashboard.
  if (!user) return <SalesPage />;
  return <Dashboard initialForms={await getAllForms(user.id)} />;
}

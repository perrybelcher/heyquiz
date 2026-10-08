import type { Metadata } from "next";
import { getAllForms } from "@/lib/storage";
import { currentUser } from "@/lib/auth";
import SalesPage from "@/components/SalesPage";
import Dashboard from "@/components/Dashboard";
export const metadata: Metadata = { title: "HeyQuiz — The right question changes everything", description: "Build product finders, audience segmentation quizzes, and personalized scorecards with useful conversion analytics." };
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const user = await currentUser();
  if (!user) return <SalesPage />;
  return <Dashboard initialForms={await getAllForms(user.id)} />;
}

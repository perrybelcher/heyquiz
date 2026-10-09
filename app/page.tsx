import { publicMetadata, homeTitle, homeDescription, privateMetadata } from "@/lib/seo";
import { getAllForms } from "@/lib/storage";
import { currentUser } from "@/lib/auth";
import SalesPage from "@/components/SalesPage";
import Dashboard from "@/components/Dashboard";
export async function generateMetadata() {
  return await currentUser() ? { ...privateMetadata, title: "Your workspace | Pippi" } : publicMetadata(homeTitle, homeDescription, "/");
}
// Resolve the session per request; never cache one user’s workspace as public HTML.
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const user = await currentUser();
  // The public introduction shares this URL, while existing users keep their dashboard.
  if (!user) return <SalesPage />;
  return <Dashboard initialForms={await getAllForms(user.id)} />;
}

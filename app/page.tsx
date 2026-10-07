import { getAllForms } from "@/lib/storage";
import { requirePageUser } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const user = await requirePageUser();
  return <Dashboard initialForms={await getAllForms(user.id)} />;
}

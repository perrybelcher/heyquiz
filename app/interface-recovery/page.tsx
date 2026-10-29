import { requirePageUser } from "@/lib/auth";
import InterfaceRecovery from "./recovery";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requirePageUser("/interface-recovery");
  return <main className="mx-auto max-w-lg p-8"><h1 className="text-2xl font-semibold">Return to Classic</h1><p className="my-4">Use the Classic workspace for this account. Save any work in other tabs before continuing.</p><InterfaceRecovery accountKey={user.accountKey} /></main>;
}

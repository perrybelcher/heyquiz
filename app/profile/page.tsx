import { requirePageUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import ProfileSettings from "@/components/ProfileSettings";

export const dynamic = "force-dynamic";
export const metadata = { ...privateMetadata, title: "Profile | Pippi" };

export default async function ProfilePage() {
  const user = await requirePageUser("/profile");
  return <div className="pippi-app min-h-screen bg-[#f8f9f5] text-slate-900"><WorkspaceHeader active="profile" /><ProfileSettings accountKey={user.accountKey} /></div>;
}

import { currentUser } from "@/lib/auth";
import { resolveInterface } from "@/lib/interface-preferences";
import SessionActivity from "./SessionActivity";
import WorkspaceShell from "@/components/v2/WorkspaceShell";
/** Resolve per request. Public/guest surfaces retain their existing presentation. */
export default async function CreatorInterface({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const version = user ? await resolveInterface(user.id) : "v1";
  return <SessionActivity accountKey={user?.accountKey}><WorkspaceShell version={version}>{children}</WorkspaceShell></SessionActivity>;
}

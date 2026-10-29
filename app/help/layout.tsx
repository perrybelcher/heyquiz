import CreatorInterface from "@/components/CreatorInterface";
import WorkspaceHeader from "@/components/WorkspaceHeader";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <CreatorInterface><WorkspaceHeader active="more" />{children}</CreatorInterface>;
}

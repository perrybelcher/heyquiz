import WorkspaceHeader from "@/components/WorkspaceHeader";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <><WorkspaceHeader active="more" />{children}</>;
}

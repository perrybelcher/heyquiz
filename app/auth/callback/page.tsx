import AuthCallback from "@/components/AuthCallback";
export const metadata = {
  title: "Confirm your email — pippi",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return <AuthCallback />;
}

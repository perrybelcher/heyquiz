import AccountForm from "@/components/AccountForm";
export const metadata = {
  title: "Quiznick — Signup",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AccountForm mode="signup" />;
}

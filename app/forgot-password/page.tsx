import AccountForm from "@/components/AccountForm";
export const metadata = {
  title: "Quiznick — Forgot Password",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AccountForm mode="recover" />;
}

import AccountForm from "@/components/AccountForm";
export const metadata = {
  title: "Quiznick — Resend Confirmation",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AccountForm mode="resend" />;
}

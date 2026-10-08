import AccountForm from "@/components/AccountForm";
export const metadata = {
  title: "pippi — Resend Confirmation",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AccountForm mode="resend" />;
}

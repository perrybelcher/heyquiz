import AccountForm from "@/components/AccountForm";
export const metadata = {
  title: "Quiznick — Reset Password",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AccountForm mode="reset" />;
}

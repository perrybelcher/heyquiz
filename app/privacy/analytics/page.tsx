import Link from "next/link";
export const metadata = { title: "Behavior analytics preferences | Pippi", robots: { index: false, follow: false } };
export default function AnalyticsPrivacy() {
  return <main className="mx-auto max-w-2xl space-y-5 px-6 py-12 text-slate-800">
    <Link href="/create" className="text-sm underline">Back to creating a quiz</Link>
    <h1 className="text-3xl font-semibold">Optional behavior analytics</h1>
    <p>With your permission, Pippi uses Microsoft Clarity to understand clicks, scrolling and difficulties in our creator screens. Microsoft receives usage, device and browser information and creates masked session recordings and heatmaps. This helps us improve the builder.</p>
    <p>Recording is off until you choose “Allow analytics.” We mask page content, including quiz wording and form entries. We do not send names, email addresses, answers or quiz titles as custom events. Our events describe actions such as opening scoring help or trying an answer.</p>
    <p>We exclude signup, sign-in, password recovery, public quizzes and private result links. Opening Contacts, Results or Integrations stops recording for the rest of that page session. Recording is limited to Pippi’s production domain; local development and previews are excluded.</p>
    <p>Clarity may use analytics cookies after you opt in. Advertising storage remains denied. You can withdraw through “Analytics preferences” in the builder. Withdrawal stops new recording; it does not erase previously collected recordings. Your preference is saved on this browser for 180 days. We also respect Global Privacy Control.</p>
    <p>Learn more in <a className="underline" href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noreferrer">Microsoft’s privacy statement</a> and <a className="underline" href="https://clarity.microsoft.com/privacy" target="_blank" rel="noreferrer">Clarity’s privacy information</a>.</p>
  </main>;
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pippiapp.com"),
  title: "Pippi Quiz Builder",
  description: "Build interactive quizzes, product recommendations, and personalized scorecards with Pippi.",
  icons: { icon: "/pippi-logo.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

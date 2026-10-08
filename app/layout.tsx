import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pippi - Advanced Form & Quiz Builder",
  description:
    "Modern, bloat-free form and quiz builder with conditional logic and agent intelligence.",
  icons: {
    icon: "/pippi-logo.svg",
  },
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

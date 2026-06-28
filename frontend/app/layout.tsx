import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QazVelo Engine - Trading Dashboard",
  description: "Real-time market analytics and paper trading platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}

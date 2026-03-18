import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schliemann Writing Studio",
  description: "A focused web GUI for Schliemann-style English writing practice."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


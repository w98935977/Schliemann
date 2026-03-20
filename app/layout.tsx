import type { Metadata } from "next";
import { loraFontBase64 } from "@/lib/pdf-fonts";
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
      <head>
        <style>{`
          @font-face {
            font-family: "Lora Embedded";
            src: url(data:font/ttf;base64,${loraFontBase64}) format("truetype");
            font-style: normal;
            font-weight: 400 700;
            font-display: swap;
          }

          :root {
            --font-lora: "Lora Embedded";
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

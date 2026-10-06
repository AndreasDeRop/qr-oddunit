import type { Metadata } from "next";
import { siteDescription, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "QR-codes met 3D-logo en Web AR | OddUnit", template: "%s | OddUnit QR+AR" },
  description: siteDescription,
  openGraph: { type: "website", locale: "nl_BE", siteName: "OddUnit QR+AR", title: "OddUnit QR+AR", description: siteDescription },
  twitter: { card: "summary", title: "OddUnit QR+AR", description: siteDescription }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

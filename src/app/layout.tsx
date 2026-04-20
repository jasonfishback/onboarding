import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simon Express — Carrier Onboarding",
  description: "Carrier onboarding portal for Simon Express Logistics LLC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

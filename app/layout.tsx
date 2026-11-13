import type { Metadata } from "next";
import "./globals.css";
import "./commerce.css";
export const metadata: Metadata = {
  title: "LocalAgentPay — Local living. Borderless payments.",
  description:
    "Find regional merchants and documented payment paths across 12 countries. Compare direct NEAR, crypto checkout, and conventional options before continuing with a provider.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

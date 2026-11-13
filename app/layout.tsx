import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LocalAgentPay — Local living. Borderless payments.",
  description:
    "Find your neighborhood favorites. Preview paying with your crypto through NEAR Intents. A hackathon prototype with fictional merchants and simulated confirmation.",
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

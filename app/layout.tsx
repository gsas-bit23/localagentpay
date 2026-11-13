import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./commerce.css";
export const metadata: Metadata = {
  title: "LocalAgentPay — Local living. Borderless payments.",
  description:
    "Book flights and hotel stays inside the map with wallet payments and optional NEAR conversion. More merchants and countries are coming soon.",
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

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIOBuy Shipping Quote Demo",
  description: "Estimate and compare international shipping channels with the HIOBuy API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reel-to-Cart",
  description: "Paste a reel or upload a photo — find the outfit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

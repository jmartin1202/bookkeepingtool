import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Month-End Document Chaser",
  description: "Secure document collection for bookkeepers and accounting firms.",
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

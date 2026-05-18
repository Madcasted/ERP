// @ts-ignore
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ERP Dashboard",
  description: "Next.js ERP system connected to PostgreSQL via Docker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="app-body">{children}</body>
    </html>
  );
}

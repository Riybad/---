import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "الإدارة المالية للمركز",
  description: "نظام إدارة الإيرادات والمصروفات والعهد",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

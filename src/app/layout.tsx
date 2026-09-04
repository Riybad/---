import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نبغ — النخب الناشئة (تمكين)",
  description: "خطط الطلاب السنوية (حفظ وشرح) وإدارة الإيرادات والمصروفات والعهد",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

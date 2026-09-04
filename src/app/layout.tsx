import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نبغ — النخب الناشئة (تمكين)",
  description: "خطط الطلاب السنوية: تقسيم المقررات على السنة بين الحفظ والشرح",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

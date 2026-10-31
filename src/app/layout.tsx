import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "صناعة الموهبة",
  description: "مشروع صناعة الموهبة — خطط الطلاب السنوية وإنجازهم وقياس أدائهم",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

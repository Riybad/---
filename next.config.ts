import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs"],
  // قالب «الخطة الزمنية» يُقرأ وقت التشغيل، فلا بد أن يُرفع مع الدالة
  outputFileTracingIncludes: {
    "/api/export/khitta/**": ["./docs/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;

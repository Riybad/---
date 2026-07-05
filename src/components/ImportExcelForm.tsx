"use client";

import { useActionState } from "react";
import { importExcel } from "@/app/actions";

export default function ImportExcelForm() {
  const [result, action, pending] = useActionState(importExcel, null);
  return (
    <form action={action} className="space-y-3">
      <input
        type="file"
        name="file"
        accept=".xlsx,.xls,.csv"
        required
        className="input"
      />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "جارٍ الاستيراد…" : "استيراد"}
        </button>
        <a
          href="/api/template"
          className="text-sm font-semibold hover:underline"
          style={{ color: "var(--accent)" }}
        >
          تحميل نموذج إكسل جاهز
        </a>
      </div>
      {result && (
        <p className="text-sm font-semibold" style={{ color: "var(--good-text)" }}>
          تم استيراد {result.ok} حركة
          {result.skipped > 0 ? ` — وتم تجاهل ${result.skipped} صف غير مكتمل` : ""}
        </p>
      )}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { submitClosure } from "@/app/actions";

export default function ClosureForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(submitClosure, null);
  const [rows, setRows] = useState([0]);
  const [nextKey, setNextKey] = useState(1);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {rows.map((key, i) => (
        <fieldset
          key={key}
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <legend className="px-1 text-sm font-bold">فاتورة {i + 1}</legend>
            {rows.length > 1 && (
              <button
                type="button"
                className="text-xs font-semibold hover:underline"
                style={{ color: "var(--critical)" }}
                onClick={() => setRows(rows.filter((r) => r !== key))}
              >
                إزالة
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">وصف الفاتورة</label>
              <input name="inv_description" className="input" required />
            </div>
            <div>
              <label className="label">المبلغ (ر.س)</label>
              <input name="inv_amount" type="number" step="0.01" min="0.01" className="input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ملف الفاتورة (PDF — بحد أقصى 10MB)</label>
              <input name="inv_file" type="file" accept="application/pdf,.pdf" className="input" required />
            </div>
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        className="btn btn-ghost text-sm"
        onClick={() => {
          setRows([...rows, nextKey]);
          setNextKey(nextKey + 1);
        }}
      >
        + إضافة فاتورة أخرى
      </button>

      {error && (
        <p className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}

      <button className="btn btn-primary w-full justify-center" disabled={pending}>
        {pending ? "جارٍ الرفع…" : "إرسال طلب الإقفال"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { submitRequest } from "@/app/actions";
import HijriDateFields from "@/components/HijriDateFields";
import { STAGES } from "@/lib/hijri";

export default function RequestForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(submitRequest, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="token" value={token} />
      <div className="col-span-2">
        <label className="label">الاسم الكامل</label>
        <input name="name" className="input" required />
      </div>
      <div>
        <label className="label">رقم الجوال</label>
        <input name="phone" className="input" dir="ltr" placeholder="05xxxxxxxx" required />
      </div>
      <div>
        <label className="label">المرحلة</label>
        <select name="stage" className="input" required defaultValue="">
          <option value="" disabled>
            اختر المرحلة
          </option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">التاريخ (هجري)</label>
        <HijriDateFields />
      </div>
      <div className="col-span-2">
        <label className="label">سبب العهدة</label>
        <textarea name="reason" className="input" rows={3} required />
      </div>
      <div className="col-span-2">
        <label className="label">المبلغ المطلوب</label>
        <input name="requested_amount" type="number" step="0.01" min="0.01" className="input" required />
      </div>
      {error && (
        <p className="col-span-2 text-sm font-semibold" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
      <div className="col-span-2">
        <button className="btn btn-primary w-full justify-center" disabled={pending}>
          {pending ? "جارٍ الإرسال…" : "إرسال الطلب"}
        </button>
      </div>
    </form>
  );
}

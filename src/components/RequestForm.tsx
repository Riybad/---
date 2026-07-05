"use client";

import { useActionState } from "react";
import { submitRequest } from "@/app/actions";

export default function RequestForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(submitRequest, null);
  const today = new Date().toISOString().slice(0, 10);
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
        <label className="label">تاريخ الحاجة</label>
        <input name="request_date" type="date" className="input" defaultValue={today} required />
      </div>
      <div className="col-span-2">
        <label className="label">سبب العهدة</label>
        <textarea name="reason" className="input" rows={3} required />
      </div>
      <div className="col-span-2">
        <label className="label">المبلغ المطلوب (ر.س) — اختياري</label>
        <input name="requested_amount" type="number" step="0.01" min="0" className="input" />
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

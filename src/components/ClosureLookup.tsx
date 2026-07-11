"use client";

import { useActionState } from "react";
import { findClosureByPhone } from "@/app/actions";

export default function ClosureLookup({ token }: { token: string }) {
  const [error, action, pending] = useActionState(findClosureByPhone, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label">رقم الجوال المسجل في العهدة</label>
        <input
          name="phone"
          className="input"
          dir="ltr"
          placeholder="05xxxxxxxx"
          inputMode="tel"
          required
          autoFocus
        />
      </div>
      {error && (
        <p className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>
        {pending ? "جارٍ البحث…" : "متابعة الإقفال"}
      </button>
    </form>
  );
}

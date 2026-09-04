"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="sunny sunny-bg flex min-h-screen items-center justify-center p-4">
      <form action={action} className="card sunny-card w-full max-w-sm p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-nabgh.png" alt="شعار نبغ" className="mx-auto mb-4 h-20 w-auto" />
        <h1 className="page-title mb-1 text-center text-xl">لوحة الطلاب</h1>
        <p className="mb-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          تسجيل دخول المشرف
        </p>
        <label className="label" htmlFor="password">
          كلمة المرور
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input mb-4"
          autoFocus
          required
        />
        {error && (
          <p className="mb-3 text-sm font-semibold" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full justify-center" disabled={pending}>
          {pending ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </main>
  );
}

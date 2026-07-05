"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={action} className="card w-full max-w-sm p-8">
        <h1 className="mb-1 text-xl font-bold">الإدارة المالية للمركز</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
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

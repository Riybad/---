import Link from "next/link";
import { createCustodyManual } from "@/app/actions";
import HijriDateFields from "@/components/HijriDateFields";
import { STAGES } from "@/lib/hijri";
import type { CustodyStatus } from "@/lib/db";
import { money, fmtDate, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import { listCustodies } from "@/lib/queries";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "الكل" },
  { key: "pending", label: "طلبات جديدة" },
  { key: "open", label: "مفتوحة" },
  { key: "pending_close", label: "بانتظار الاعتماد" },
  { key: "closed", label: "مقفلة" },
  { key: "rejected", label: "مرفوضة" },
];

export default async function CustodiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const valid = FILTERS.some((f) => f.key === status) ? status : undefined;
  const custodies = listCustodies(valid || undefined);

  return (
    <main className="space-y-6">
      <h1 className="page-title text-xl">العهد</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (valid ?? "") === f.key;
          return (
            <Link
              key={f.key}
              href={f.key ? `/custodies?status=${f.key}` : "/custodies"}
              className="rounded-full border px-3 py-1 text-sm font-semibold"
              style={{
                borderColor: active ? "var(--accent)" : "var(--hairline)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <section className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>الجوال</th>
                <th>السبب</th>
                <th>المرحلة</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {custodies.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center">
                    لا توجد عهد بهذا الفلتر
                  </td>
                </tr>
              )}
              {custodies.map((c) => (
                <tr key={c.id}>
                  <td className="num">{c.id}</td>
                  <td>
                    <Link
                      href={`/custodies/${c.id}`}
                      className="font-semibold hover:underline"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="num" dir="ltr">
                    {c.phone || "—"}
                  </td>
                  <td className="max-w-56 truncate" title={c.reason}>
                    {c.reason}
                  </td>
                  <td>{c.stage || "—"}</td>
                  <td className="num">{money(c.amount ?? c.requested_amount)}</td>
                  <td>
                    <span className={STATUS_STYLE[c.status as CustodyStatus]}>
                      {STATUS_LABEL[c.status as CustodyStatus]}
                    </span>
                  </td>
                  <td className="num">{fmtDate(c.request_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card max-w-2xl p-5">
        <h2 className="mb-4 font-bold">تسجيل عهدة يدويًا</h2>
        <form action={createCustodyManual} className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">الاسم</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">رقم الجوال</label>
            <input name="phone" className="input" dir="ltr" />
          </div>
          <div className="col-span-2">
            <label className="label">السبب</label>
            <input name="reason" className="input" required />
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
          <div>
            <label className="label">المبلغ المطلوب</label>
            <input name="requested_amount" type="number" step="0.01" min="0" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">التاريخ (هجري)</label>
            <HijriDateFields />
          </div>
          <div className="col-span-2">
            <button className="btn btn-primary">تسجيل الطلب</button>
          </div>
        </form>
      </section>
    </main>
  );
}

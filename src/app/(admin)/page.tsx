import Link from "next/link";
import { headers } from "next/headers";
import CopyButton from "@/components/CopyButton";
import { getRequestToken } from "@/lib/db";
import { money, fmtDate, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import { getCustodyStats, getTotals, listCustodies, listStudents, listTransactions } from "@/lib/queries";
import { YEAR_END, YEAR_START } from "@/lib/calendar";

export const dynamic = "force-dynamic";

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "critical";
}) {
  const color =
    tone === "good" ? "var(--good-text)" : tone === "critical" ? "var(--critical)" : "var(--text-primary)";
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const totals = await getTotals();
  const custody = await getCustodyStats();
  const recentCustodies = await listCustodies(undefined, 6);
  const recentTx = await listTransactions(6);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const requestUrl = `${proto}://${host}/r/${await getRequestToken()}`;
  const khittaUrl = `${proto}://${host}/khitta`;
  const students = await listStudents();

  const net = totals.revenue - totals.expense;

  return (
    <main className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="page-title text-lg">خطط الطلاب</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              دراسة ذاتية على مدار السنة — من {YEAR_START.hijri} إلى {YEAR_END.hijri}
            </p>
          </div>
          <div className="ms-auto flex flex-wrap gap-2">
            <Link href="/students" className="btn btn-primary text-sm">
              الطلاب ({students.length})
            </Link>
            <Link href="/courses" className="btn btn-ghost text-sm">
              المقررات
            </Link>
            <Link href="/taqweem" className="btn btn-ghost text-sm">
              الخطة الزمنية
            </Link>
          </div>
        </div>
        <div
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl p-3"
          style={{ background: "var(--surface-stripe)" }}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              رابط تسجيل الخطة (أرسله للطلاب)
            </p>
            <p className="break-all text-xs num" style={{ color: "var(--text-secondary)" }}>
              {khittaUrl}
            </p>
          </div>
          <div className="ms-auto flex gap-2">
            <CopyButton text={khittaUrl} />
            <a className="btn btn-ghost text-sm" href="/api/export/khitta">
              تصدير كل الخطط إكسل
            </a>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="مجموع الإيرادات" value={money(totals.revenue)} tone="good" />
        <StatTile label="مجموع المصروفات" value={money(totals.expense)} tone="critical" />
        <StatTile label="الصافي" value={money(net)} tone={net >= 0 ? "good" : "critical"} />
        <StatTile
          label="طلبات عهد جديدة"
          value={String(custody.pending.count)}
          sub="بانتظار قرارك"
        />
        <StatTile
          label="العهد المفتوحة"
          value={String(custody.open.count)}
          sub={`إجمالي المبالغ: ${money(custody.open.amount)}`}
        />
        <StatTile
          label="بانتظار اعتماد الإقفال"
          value={String(custody.pendingClose.count)}
          sub={`إجمالي المبالغ: ${money(custody.pendingClose.amount)}`}
        />
        <StatTile
          label="العهد المقفلة"
          value={String(custody.closed.count)}
          sub={`إجمالي المبالغ: ${money(custody.closed.amount)}`}
        />
        <div className="card flex flex-col justify-between gap-2 p-5">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              رابط طلب عهدة (للموظفين)
            </p>
            <p className="mt-1 break-all text-xs num" style={{ color: "var(--text-secondary)" }}>
              {requestUrl}
            </p>
          </div>
          <CopyButton text={requestUrl} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="font-bold">آخر العهد</h2>
            <Link href="/custodies" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
              عرض الكل ←
            </Link>
          </div>
          <table className="table mt-2">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {recentCustodies.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center">
                    لا توجد عهد بعد
                  </td>
                </tr>
              )}
              {recentCustodies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/custodies/${c.id}`} className="font-semibold hover:underline" style={{ color: "var(--text-primary)" }}>
                      {c.name}
                    </Link>
                  </td>
                  <td className="num">{money(c.amount ?? c.requested_amount)}</td>
                  <td>
                    <span className={STATUS_STYLE[c.status]}>{STATUS_LABEL[c.status]}</span>
                  </td>
                  <td className="num">{fmtDate(c.request_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="font-bold">آخر الحركات المالية</h2>
            <Link href="/transactions" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
              عرض الكل ←
            </Link>
          </div>
          <table className="table mt-2">
            <thead>
              <tr>
                <th>الوصف</th>
                <th>النوع</th>
                <th>المبلغ</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center">
                    لا توجد حركات بعد
                  </td>
                </tr>
              )}
              {recentTx.map((t) => (
                <tr key={t.id}>
                  <td>{t.description}</td>
                  <td>
                    <span
                      className="text-xs font-bold"
                      style={{ color: t.type === "revenue" ? "var(--good-text)" : "var(--critical)" }}
                    >
                      {t.type === "revenue" ? "إيراد" : "مصروف"}
                    </span>
                  </td>
                  <td className="num">{money(t.amount)}</td>
                  <td className="num">{fmtDate(t.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import CopyButton from "@/components/CopyButton";
import {
  approveClose,
  deleteCustody,
  disburseCustody,
  rejectCustody,
  reopenCustody,
} from "@/app/actions";
import { money, fmtDate, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import { getCustody, listInvoices } from "@/lib/queries";

export const dynamic = "force-dynamic";

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-0.5 font-semibold" dir={ltr ? "ltr" : undefined} style={{ textAlign: "start" }}>
        {value}
      </p>
    </div>
  );
}

export default async function CustodyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const custody = await getCustody(Number(id));
  if (!custody) notFound();
  const invoices = await listInvoices(custody.id);
  const invoicesTotal = invoices.reduce((s, i) => s + i.amount, 0);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const closeUrl = `${proto}://${host}/c/${custody.close_token}`;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title text-xl">عهدة رقم {custody.id} — {custody.name}</h1>
        <span className={STATUS_STYLE[custody.status]}>{STATUS_LABEL[custody.status]}</span>
      </div>

      <section className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        <Field label="الاسم" value={custody.name} />
        <Field label="رقم الجوال" value={custody.phone || "—"} ltr />
        <Field label="تاريخ الطلب" value={fmtDate(custody.request_date)} />
        <Field label="المرحلة" value={custody.stage || "—"} />
        <Field label="المبلغ المطلوب" value={money(custody.requested_amount)} />
        <Field label="المبلغ المصروف" value={money(custody.amount)} />
        <Field label="تاريخ الصرف" value={fmtDate(custody.disbursed_at)} />
        <div className="col-span-2 sm:col-span-3">
          <Field label="السبب" value={custody.reason} />
        </div>
        {custody.admin_notes && (
          <div className="col-span-2 sm:col-span-3">
            <Field label="ملاحظات الإدارة" value={custody.admin_notes} />
          </div>
        )}
      </section>

      {custody.status === "pending" && (
        <section className="card p-5">
          <h2 className="mb-4 font-bold">صرف العهدة</h2>
          <form action={disburseCustody} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={custody.id} />
            <div>
              <label className="label">المبلغ المصروف (ر.س)</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                defaultValue={custody.requested_amount ?? undefined}
                required
              />
            </div>
            <div>
              <label className="label">ملاحظات (اختياري)</label>
              <input name="admin_notes" className="input" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn btn-primary">تأكيد الصرف</button>
            </div>
          </form>
          <form action={rejectCustody} className="mt-3">
            <input type="hidden" name="id" value={custody.id} />
            <button className="btn btn-ghost text-sm" style={{ color: "var(--critical)" }}>
              رفض الطلب
            </button>
          </form>
        </section>
      )}

      {custody.status === "open" && (
        <section className="card p-5">
          <h2 className="mb-1 font-bold">رابط إقفال العهدة</h2>
          <p className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
            أرسل هذا الرابط للموظف ليرفع تفاصيل الفواتير وملفات الـ PDF
          </p>
          <p className="mb-3 break-all text-sm num" style={{ color: "var(--text-secondary)" }}>
            {closeUrl}
          </p>
          <CopyButton text={closeUrl} label="نسخ رابط الإقفال" />
        </section>
      )}

      {invoices.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="font-bold">الفواتير المرفوعة ({invoices.length})</h2>
            <p className="text-sm font-semibold num">
              الإجمالي: {money(invoicesTotal)}
              {custody.amount != null && (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}
                  من {money(custody.amount)}
                </span>
              )}
            </p>
          </div>
          <table className="table mt-2">
            <thead>
              <tr>
                <th>الوصف</th>
                <th>المبلغ</th>
                <th>الملف</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ color: "var(--text-primary)" }}>{inv.description}</td>
                  <td className="num">{money(inv.amount)}</td>
                  <td>
                    <a
                      href={`/files/${inv.id}`}
                      target="_blank"
                      className="text-sm font-semibold hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      عرض PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {custody.status === "pending_close" && (
        <section className="card flex flex-wrap gap-3 p-5">
          <form action={approveClose}>
            <input type="hidden" name="id" value={custody.id} />
            <button className="btn btn-good">اعتماد الإقفال</button>
          </form>
          <form action={reopenCustody}>
            <input type="hidden" name="id" value={custody.id} />
            <button className="btn btn-ghost">إعادة فتح (حذف الفواتير وإعادة الرفع)</button>
          </form>
        </section>
      )}

      <form action={deleteCustody}>
        <input type="hidden" name="id" value={custody.id} />
        <button className="text-sm font-semibold hover:underline" style={{ color: "var(--critical)" }}>
          حذف العهدة نهائيًا
        </button>
      </form>
    </main>
  );
}

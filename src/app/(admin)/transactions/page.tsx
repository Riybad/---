import ImportExcelForm from "@/components/ImportExcelForm";
import { addTransaction, deleteTransaction } from "@/app/actions";
import { money, fmtDate } from "@/lib/format";
import { getTotals, listTransactions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  const transactions = listTransactions();
  const totals = getTotals();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="space-y-6">
      <h1 className="page-title text-xl">الإيرادات والمصروفات</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">إضافة حركة يدويًا</h2>
          <form action={addTransaction} className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">النوع</label>
              <select name="type" className="input" required>
                <option value="revenue">إيراد</option>
                <option value="expense">مصروف</option>
              </select>
            </div>
            <div>
              <label className="label">المبلغ (ر.س)</label>
              <input name="amount" type="number" step="0.01" min="0.01" className="input" required />
            </div>
            <div className="col-span-2">
              <label className="label">الوصف</label>
              <input name="description" className="input" required />
            </div>
            <div>
              <label className="label">التصنيف (اختياري)</label>
              <input name="category" className="input" placeholder="رواتب، اشتراكات…" />
            </div>
            <div>
              <label className="label">التاريخ</label>
              <input name="date" type="date" className="input" defaultValue={today} required />
            </div>
            <div className="col-span-2">
              <button className="btn btn-primary">إضافة</button>
            </div>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-bold">استيراد من إكسل</h2>
          <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
            الأعمدة المطلوبة: التاريخ، النوع (إيراد/مصروف)، الوصف، التصنيف، المبلغ
          </p>
          <ImportExcelForm />
        </section>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center gap-4 p-4 pb-0">
          <h2 className="font-bold">كل الحركات ({transactions.length})</h2>
          <p className="ms-auto text-sm font-semibold num" style={{ color: "var(--text-secondary)" }}>
            الإيرادات: <span style={{ color: "var(--good-text)" }}>{money(totals.revenue)}</span>
            {" · "}
            المصروفات: <span style={{ color: "var(--critical)" }}>{money(totals.expense)}</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="table mt-2">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الوصف</th>
                <th>التصنيف</th>
                <th>المبلغ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">
                    لا توجد حركات — أضف حركة أو استورد ملف إكسل
                  </td>
                </tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="num">{fmtDate(t.date)}</td>
                  <td>
                    <span
                      className="text-xs font-bold"
                      style={{ color: t.type === "revenue" ? "var(--good-text)" : "var(--critical)" }}
                    >
                      {t.type === "revenue" ? "إيراد" : "مصروف"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-primary)" }}>{t.description}</td>
                  <td>{t.category || "—"}</td>
                  <td className="num font-semibold" style={{ color: "var(--text-primary)" }}>
                    {money(t.amount)}
                  </td>
                  <td>
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        className="text-xs font-semibold hover:underline"
                        style={{ color: "var(--critical)" }}
                      >
                        حذف
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

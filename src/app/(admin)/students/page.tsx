import Link from "next/link";
import { SESSIONS, YEAR_SESSIONS_LABEL } from "@/lib/calendar";
import { listStudents, planCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: search } = await searchParams;
  const [students, counts] = await Promise.all([listStudents(search), planCounts()]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title text-xl">الطلاب وخططهم</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {YEAR_SESSIONS_LABEL} — من {SESSIONS[0]?.hijri} إلى {SESSIONS[SESSIONS.length - 1]?.hijri}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          <a className="btn btn-ghost text-sm" href="/api/export/khitta">
            تصدير كل الخطط إكسل
          </a>
          <Link className="btn btn-primary text-sm" href="/khitta" target="_blank">
            رابط تسجيل الطلاب ↗
          </Link>
        </div>
      </div>

      <form className="card flex flex-wrap gap-2 p-3">
        <input
          name="q"
          defaultValue={search ?? ""}
          className="input flex-1"
          placeholder="ابحث بالاسم أو رقم الجوال"
        />
        <button className="btn btn-ghost text-sm">بحث</button>
      </form>

      <div className="card overflow-x-auto">
        {students.length === 0 ? (
          <p className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            {search ? "لا نتائج للبحث." : "لم يسجّل أي طالب خطته بعد — أرسل لهم رابط التسجيل."}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">م</th>
                <th>الاسم</th>
                <th>الجوال</th>
                <th>المرحلة</th>
                <th>عدد المقررات</th>
                <th>تاريخ التسجيل</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td className="num">{i + 1}</td>
                  <td className="font-semibold">{s.name}</td>
                  <td className="num" dir="ltr">
                    {s.phone || "—"}
                  </td>
                  <td>{s.stage || "—"}</td>
                  <td className="num">{counts.get(s.id) ?? 0}</td>
                  <td className="num" dir="ltr">
                    {new Date(s.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td>
                    <Link
                      href={`/students/${s.id}`}
                      className="font-semibold underline"
                      style={{ color: "var(--brand-olive)" }}
                    >
                      الخطة
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

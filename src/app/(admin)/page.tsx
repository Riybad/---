import Link from "next/link";
import { headers } from "next/headers";
import CopyButton from "@/components/CopyButton";
import { CADENCES, cadenceInfo, YEAR_END, YEAR_START } from "@/lib/calendar";
import type { Cadence } from "@/lib/calendar";
import { listCourses, listStudents, planCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const [students, counts, courses] = await Promise.all([listStudents(), planCounts(), listCourses()]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const khittaUrl = `${proto}://${host}/khitta`;

  // لا تُعرض الوحدات التي لم يخترها أحد — الأصفار تشوّش ولا تفيد
  const byCadence = CADENCES.map((c) => ({
    label: c.label,
    n: students.filter((s) => (s.cadence || "weekly") === c.key).length,
  })).filter((c) => c.n > 0);
  const latest = students.slice(0, 8);
  const today = new Date().toISOString().slice(0, 10);
  const registeredToday = students.filter(
    (s) => new Date(s.created_at).toISOString().slice(0, 10) === today
  ).length;

  return (
    <main className="grid gap-6">
      {/* رابط التسجيل — أهم شيء في اللوحة */}
      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <h1 className="page-title text-lg">رابط تسجيل الطلاب</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              أرسله للطلاب. كل طالب يكتب اسمه ويقسّم مقرراته على السنة ويحفظ خطته، وتظهر لك هنا.
            </p>
            <p
              className="mt-3 break-all rounded-lg px-3 py-2 text-sm num"
              style={{ background: "var(--surface-stripe)", color: "var(--text-secondary)" }}
            >
              {khittaUrl}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:flex-col">
            <CopyButton text={khittaUrl} label="نسخ الرابط" />
            <Link href="/khitta" target="_blank" className="btn btn-ghost text-sm">
              فتح الصفحة ↗
            </Link>
          </div>
        </div>
      </section>

      {/* أرقام سريعة */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="الطلاب المسجّلون" value={String(students.length)} sub={registeredToday ? `${registeredToday} سجّلوا اليوم` : "لم يسجّل أحد اليوم"} />
        <Tile
          label="وحدات التقسيم"
          value={byCadence.length ? `${byCadence.length}` : "—"}
          sub={byCadence.map((c) => `${c.n} ${c.label}`).join(" · ") || "لا خطط بعد"}
        />
        <Tile label="المقررات المفعّلة" value={String(courses.length)} sub={courses.map((c) => c.name).join("، ")} />
        <Tile label="سنة الخطة" value="366 يومًا" sub={`${YEAR_START.hijri} إلى ${YEAR_END.hijri}`} />
      </section>

      {/* التصدير */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h2 className="font-bold">تصدير إكسل</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              <strong>كل الطلاب</strong>: ورقة الطلاب، وتفاصيل خططهم صفًا لكل فترة ومقرر، والمقررات، والخطة الزمنية.
              أما <strong>الطالب الواحد</strong> فمن صفحته أو من زرّي «قالب» و«تفصيلي» في جدول الطلاب.
            </p>
          </div>
          <a className="btn btn-primary ms-auto text-sm" href="/api/export/khitta">
            تصدير كل الخطط
          </a>
        </div>
      </section>

      {/* آخر الطلاب */}
      <section className="card">
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="font-bold">آخر الطلاب</h2>
          <Link href="/students" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            كل الطلاب ←
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            لم يسجّل أحد بعد. أرسل رابط التسجيل للطلاب.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table mt-2">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الوحدة</th>
                  <th>المقررات</th>
                  <th>التاريخ</th>
                  <th>إكسل</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/students/${s.id}`} className="font-semibold hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td>{cadenceInfo((s.cadence || "weekly") as Cadence).label}</td>
                    <td className="num">{counts.get(s.id) ?? 0}</td>
                    <td className="num" dir="ltr">
                      {new Date(s.created_at).toISOString().slice(0, 10)}
                    </td>
                    <td className="whitespace-nowrap">
                      <a className="btn btn-ghost px-2 py-1 text-xs" href={`/api/export/khitta/${s.token}`}>
                        قالب
                      </a>{" "}
                      <a className="btn btn-ghost px-2 py-1 text-xs" href={`/api/export/khitta/${s.token}?format=table`}>
                        تفصيلي
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

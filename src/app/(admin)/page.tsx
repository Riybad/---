import Link from "next/link";
import { headers } from "next/headers";
import CopyButton from "@/components/CopyButton";
import { YEAR_END, YEAR_START } from "@/lib/calendar";
import { listCourses, listStudents, progressCounts } from "@/lib/queries";
import { TRACKS, type Track } from "@/lib/tracks";
import type { Course } from "@/lib/plan";
import type { Student } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [students, counts, courses] = await Promise.all([
    listStudents(),
    progressCounts(),
    listCourses(),
  ]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const khittaUrl = `${proto}://${host}/khitta`;

  const today = new Date().toISOString().slice(0, 10);
  const registeredToday = students.filter(
    (s) => new Date(s.created_at).toISOString().slice(0, 10) === today
  ).length;
  const withoutPlan = students.filter((s) => (counts.get(s.id)?.total ?? 0) === 0).length;
  const finished = students.filter((s) => {
    const c = counts.get(s.id);
    return c && c.total > 0 && c.done === c.total;
  }).length;

  return (
    <main className="grid gap-6">
      {/* أرقام سريعة */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label="الطلاب"
          value={String(students.length)}
          sub={registeredToday ? `${registeredToday} سجّلوا اليوم` : "لم يسجّل أحد اليوم"}
        />
        <Tile
          label="بلا خطة بعد"
          value={String(withoutPlan)}
          sub={withoutPlan ? "قسّم لهم أو أرسل لهم روابطهم" : "كل الطلاب لهم خطط"}
        />
        <Tile
          label="أنهى مقرراته"
          value={String(finished)}
          sub={finished ? "أنهوا كل مقررات خططهم" : "لم ينهِ أحد كل مقرراته بعد"}
        />
        <Tile label="المقررات المفعّلة" value={String(courses.length)} sub={`في ${TRACKS.length} مسارين`} />
      </section>

      {/* المساران */}
      <section className="grid gap-4 lg:grid-cols-2">
        {TRACKS.map((t) => (
          <TrackCard
            key={t.key}
            track={t}
            students={students.filter((s) => s.track === t.key)}
            courses={courses.filter((c) => c.track === t.key)}
            counts={counts}
            khittaUrl={khittaUrl}
          />
        ))}
      </section>

      {/* التصدير */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h2 className="font-bold">تصدير إكسل</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              <strong>كل الطلاب</strong>: ورقة الطلاب بمساراتهم، وتفاصيل خططهم صفًا لكل فترة
              ومقرر، والمقررات، والخطة الزمنية. أما <strong>الطالب الواحد</strong> فمن صفحته أو
              من زرّي «قالب» و«تفصيلي» في جدول الطلاب.
            </p>
          </div>
          <a className="btn btn-primary ms-auto text-sm" href="/api/export/khitta">
            تصدير كل الخطط
          </a>
        </div>
      </section>

      {/* آخر الطلاب */}
      <section className="card">
        <div className="flex flex-wrap items-center gap-2 p-4 pb-0">
          <h2 className="font-bold">آخر الطلاب</h2>
          <Link className="btn btn-primary ms-auto text-sm" href="/students/new">
            + إضافة طالب
          </Link>
          <Link href="/students" className="btn btn-ghost text-sm">
            كل الطلاب
          </Link>
        </div>
        {students.length === 0 ? (
          <p className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            لا طلاب بعد — أضف طالبًا من اللوحة أو أرسل رابط التسجيل.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table mt-2">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>المسار</th>
                  <th>المقررات</th>
                  <th>المنجَز</th>
                  <th>التاريخ</th>
                  <th>إكسل</th>
                </tr>
              </thead>
              <tbody>
                {students.slice(0, 8).map((s) => {
                  const t = TRACKS.find((x) => x.key === s.track) ?? TRACKS[0];
                  const c = counts.get(s.id);
                  const n = c?.total ?? 0;
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/students/${s.id}`} className="font-semibold hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td>
                        <span
                          className="whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold"
                          style={{ background: `${t.color}1f`, color: t.color }}
                        >
                          {t.name}
                        </span>
                      </td>
                      <td className="num">
                        {n > 0 ? (
                          n
                        ) : (
                          <span style={{ color: "var(--brand-amber)" }}>بلا خطة</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {n === 0 ? (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        ) : (
                          <span
                            style={{
                              color: c && c.done === n ? t.color : "var(--text-secondary)",
                              fontWeight: c && c.done === n ? 700 : 400,
                            }}
                          >
                            {c?.done ?? 0} من {n}
                            {c && c.done === n && " ✓"}
                          </span>
                        )}
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function TrackCard({
  track,
  students,
  courses,
  counts,
  khittaUrl,
}: {
  track: Track;
  students: Student[];
  courses: Course[];
  counts: Map<number, { done: number; total: number }>;
  khittaUrl: string;
}) {
  const planned = students.filter((s) => (counts.get(s.id)?.total ?? 0) > 0).length;
  const finished = students.filter((s) => {
    const c = counts.get(s.id);
    return c && c.total > 0 && c.done === c.total;
  }).length;
  return (
    <div className="card p-5" style={{ borderTop: `3px solid ${track.color}` }}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-bold" style={{ color: track.color }}>
          {track.name}
        </h2>
        <span className="text-sm num" style={{ color: "var(--text-muted)" }}>
          {students.length} طالبًا · {planned} لهم خطط · {finished} أنهوا مقرراتهم
        </span>
      </div>

      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        {courses.length > 0 ? (
          <>
            <strong>{courses.length} مقررات:</strong> {courses.map((c) => c.name).join("، ")}
          </>
        ) : (
          <span style={{ color: "var(--brand-amber)" }}>
            لا مقررات بعد — أضفها من صفحة المقررات قبل أن تقسّم لطلابه.
          </span>
        )}
      </p>

      {track.publicSignup ? (
        <>
          <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
            رابط التسجيل — أرسله للطلاب ليقسّموا خططهم بأنفسهم:
          </p>
          <p
            className="mt-1 break-all rounded-lg px-3 py-2 text-sm num"
            style={{ background: "var(--surface-stripe)", color: "var(--text-secondary)" }}
          >
            {khittaUrl}
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          بلا رابط تسجيل — تضيف الطالب من اللوحة وتقسّم له خطته، أو ترسل له رابط خطته الخاص
          ليقسّم بنفسه.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="btn btn-primary text-sm" href={`/students/new?track=${track.key}`}>
          + إضافة طالب
        </Link>
        <Link className="btn btn-ghost text-sm" href={`/students?track=${track.key}`}>
          طلابه ({students.length})
        </Link>
        <Link className="btn btn-ghost text-sm" href={`/injaz?track=${track.key}`}>
          إنجازهم
        </Link>
        <Link className="btn btn-ghost text-sm" href="/courses">
          مقرراته
        </Link>
        {track.publicSignup && <CopyButton text={khittaUrl} label="نسخ رابط التسجيل" />}
      </div>
    </div>
  );
}

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

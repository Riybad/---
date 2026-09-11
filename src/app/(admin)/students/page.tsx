import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteStudent } from "@/app/plan-actions";
import { cadenceInfo, YEAR_END, YEAR_START } from "@/lib/calendar";
import type { Cadence } from "@/lib/calendar";
import { listStudents, progressCounts } from "@/lib/queries";
import { isTrack, TRACKS, trackInfo, type TrackKey } from "@/lib/tracks";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; track?: string }>;
}) {
  const { q: search, track: rawTrack } = await searchParams;
  const track = isTrack(rawTrack) ? (rawTrack as TrackKey) : undefined;
  const [students, counts, all] = await Promise.all([
    listStudents(search, track),
    progressCounts(),
    listStudents(),
  ]);
  const countIn = (key: TrackKey) => all.filter((s) => s.track === key).length;
  const href = (t?: TrackKey) =>
    `/students?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(t ? { track: t } : {}) })}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title text-xl">الطلاب وخططهم</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            السنة من {YEAR_START.hijri} إلى {YEAR_END.hijri} · {students.length} طالبًا
            {track ? ` في ${trackInfo(track).name}` : ""}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          <Link className="btn btn-primary text-sm" href="/students/new">
            + إضافة طالب
          </Link>
          <a className="btn btn-ghost text-sm" href="/api/export/khitta">
            تصدير كل الخطط
          </a>
        </div>
      </div>

      {/* تبويب المسارين */}
      <div className="flex flex-wrap gap-2">
        <Tab href={href()} active={!track} label="الكل" count={all.length} color="var(--text-secondary)" />
        {TRACKS.map((t) => (
          <Tab
            key={t.key}
            href={href(t.key)}
            active={track === t.key}
            label={t.name}
            count={countIn(t.key)}
            color={t.color}
          />
        ))}
      </div>

      <form className="card flex flex-wrap gap-2 p-3">
        {track && <input type="hidden" name="track" value={track} />}
        <input
          name="q"
          defaultValue={search ?? ""}
          className="input flex-1"
          placeholder="ابحث بالاسم أو رقم الجوال"
        />
        <button className="btn btn-ghost text-sm">بحث</button>
        {search && (
          <Link href={href(track)} className="btn btn-ghost text-sm">
            مسح
          </Link>
        )}
      </form>

      {/* حاوية السحب مستقلة عن البطاقة: overflow:hidden فيها يطغى على overflow-x-auto */}
      <div className="card">
        {students.length === 0 ? (
          <p className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            {search ? "لا نتائج للبحث." : "لا طلاب هنا بعد — أضف طالبًا أو أرسل رابط التسجيل."}
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">م</th>
                <th>الاسم</th>
                <th>المسار</th>
                <th>الجوال</th>
                <th>الوحدة</th>
                <th>المقررات</th>
                <th>المنجَز</th>
                <th>التاريخ</th>
                <th>الخطة</th>
                <th>إكسل</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const t = trackInfo(s.track);
                return (
                <tr key={s.id}>
                  <td className="num">{i + 1}</td>
                  <td className="font-semibold">{s.name}</td>
                  <td>
                    <span
                      className="whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold"
                      style={{ background: `${t.color}1f`, color: t.color }}
                    >
                      {t.name}
                    </span>
                  </td>
                  <td className="num" dir="ltr">
                    {s.phone || "—"}
                  </td>
                  <td>{cadenceInfo((s.cadence || "weekly") as Cadence).label}</td>
                  <td className="num">{counts.get(s.id)?.total ?? 0}</td>
                  <td className="whitespace-nowrap">
                    <Done n={counts.get(s.id)?.done ?? 0} total={counts.get(s.id)?.total ?? 0} color={t.color} />
                  </td>
                  <td className="num" dir="ltr">
                    {new Date(s.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td>
                    <Link
                      href={`/students/${s.id}`}
                      className="font-semibold underline"
                      style={{ color: "var(--brand-olive)" }}
                    >
                      عرض وتعديل
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    <a className="btn btn-ghost px-2 py-1 text-xs" href={`/api/export/khitta/${s.token}`}>
                      قالب
                    </a>{" "}
                    <a className="btn btn-ghost px-2 py-1 text-xs" href={`/api/export/khitta/${s.token}?format=table`}>
                      تفصيلي
                    </a>
                  </td>
                  <td>
                    <form action={deleteStudent}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmButton
                        message={`سيُحذف «${s.name}» وخطته كاملة نهائيًا.\n\nهل أنت متأكد؟`}
                        className="btn btn-ghost px-2 py-1 text-xs"
                      >
                        حذف
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** «3 / 5» مع علامة لمن أنهى مقرراته كلها */
function Done({ n, total, color }: { n: number; total: number; color: string }) {
  if (total === 0) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const all = n === total;
  return (
    <span style={{ color: all ? color : "var(--text-secondary)", fontWeight: all ? 700 : 400 }}>
      {n} من {total}
      {all && " ✓"}
    </span>
  );
}

function Tab({
  href,
  active,
  label,
  count,
  color,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border px-4 py-2 text-sm font-bold transition"
      style={{
        borderColor: active ? color : "var(--hairline)",
        background: active ? `${color}1a` : "transparent",
        color: active ? color : "var(--text-secondary)",
      }}
    >
      {label} <span className="num">({count})</span>
    </Link>
  );
}

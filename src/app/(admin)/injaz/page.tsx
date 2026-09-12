import Link from "next/link";
import ProgressBoard from "@/components/ProgressBoard";
import type { ProgressRow } from "@/components/ProgressBoard";
import { listCourses, listStudents, planItemsByTrack } from "@/lib/queries";
import { isTrack, TRACKS, trackInfo, type TrackKey } from "@/lib/tracks";

export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const { track: raw } = await searchParams;
  // لكل مسار مقرراته، فلا يجتمعان في جدول واحد — تُعرض شاشة مسار واحد
  const track = (isTrack(raw) ? raw : TRACKS[0].key) as TrackKey;
  const info = trackInfo(track);

  const [courses, students, items] = await Promise.all([
    listCourses(true, track),
    listStudents(undefined, track),
    planItemsByTrack(track),
  ]);

  // المقررات الموقوفة تظهر إن كانت في خطة طالب، وإلا فلا تزحم الجدول
  const inPlans = new Set([...items.values()].flat().map((i) => i.course_id));
  const active = courses.filter((c) => c.active || inPlans.has(c.id));
  const columns = active.map((c) => ({ id: c.id, name: c.name }));

  /**
   * المسار بلا جدول زمني: مقرراته كلها مطلوبة من كل طالب، فلكلٍّ مربّع
   * وإن لم يُسجَّل له بند بعد. أما ذو الجدول فلا مربّع إلا لما في خطته.
   */
  const open = !info.timeline;
  const rows: ProgressRow[] = students
    .map((s) => {
      const doneOf = new Map((items.get(s.id) ?? []).map((i) => [i.course_id, i.done]));
      return {
        id: s.id,
        name: s.name,
        items: open
          ? active.map((c) => ({ courseId: c.id, done: doneOf.get(c.id) ?? false }))
          : [...doneOf].map(([courseId, done]) => ({ courseId, done })),
      };
    })
    // الذين بلا خطة أسفل القائمة: لا مربّعات لهم
    .sort((a, b) => (b.items.length > 0 ? 1 : 0) - (a.items.length > 0 ? 1 : 0));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title text-xl">إنجاز الطلاب</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            سجّل من أنهى كل مقرر — كل مسار في شاشته ومقرراته.
          </p>
        </div>
        <a className="btn btn-ghost ms-auto text-sm" href={`/api/export/khitta?track=${track}`}>
          تصدير إنجاز {info.name}
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {TRACKS.map((t) => (
          <Link
            key={t.key}
            href={`/injaz?track=${t.key}`}
            className="rounded-xl border px-4 py-2 text-sm font-bold transition"
            style={{
              borderColor: track === t.key ? t.color : "var(--hairline)",
              background: track === t.key ? `${t.color}1a` : "transparent",
              color: track === t.key ? t.color : "var(--text-secondary)",
            }}
          >
            {t.name}
          </Link>
        ))}
      </div>

      <ProgressBoard
        key={track}
        track={info}
        courses={columns}
        rows={rows}
      />
    </div>
  );
}

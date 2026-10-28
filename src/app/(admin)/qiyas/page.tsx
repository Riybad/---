import Link from "next/link";
import QiyasBoard from "@/components/QiyasBoard";
import type { QiyasStudent } from "@/components/QiyasBoard";
import { metricsFor, plannedForMonth, PLAN_MONTHS } from "@/lib/performance";
import { memoUnit } from "@/lib/plan";
import type { Cadence } from "@/lib/calendar";
import { isTrack, TRACKS, trackInfo, type TrackKey } from "@/lib/tracks";
import {
  listCourses,
  listStudents,
  performanceOfMonth,
  planItemsByTrack,
  toPicks,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/** الشهر الجاري من سنة الخطة إن كنّا فيها، وإلا فأولها */
function currentMonth(): number {
  const today = new Date().toISOString().slice(0, 10);
  const found = PLAN_MONTHS.find((m) => today >= m.from.gregorian && today <= m.to.gregorian);
  return found?.no ?? 1;
}

export default async function QiyasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; track?: string }>;
}) {
  const { month: rawMonth, track: rawTrack } = await searchParams;
  const track = (isTrack(rawTrack) ? rawTrack : TRACKS[0].key) as TrackKey;
  const info = trackInfo(track);
  const asked = Math.trunc(Number(rawMonth ?? 0));
  const month = asked >= 1 && asked <= PLAN_MONTHS.length ? asked : currentMonth();
  const monthInfo = PLAN_MONTHS[month - 1];

  const [allCourses, trackCourses, students, items, saved] = await Promise.all([
    listCourses(true),
    listCourses(false, track),
    listStudents(undefined, track),
    planItemsByTrack(track),
    performanceOfMonth(month, track),
  ]);

  const rows: QiyasStudent[] = students.map((s) => {
    const mine = saved.get(s.id) ?? [];
    // المسار ذو الجدول يشتقّ مفترضه من خطة الطالب لهذا الشهر
    const planned = info.timeline
      ? plannedForMonth(
          allCourses,
          toPicks(items.get(s.id) ?? []),
          (s.cadence || "weekly") as Cadence,
          month
        )
      : new Map<string, number>();

    const metrics = metricsFor(
      allCourses,
      planned,
      mine.map((r) => ({
        part: r.part as "quran" | "memo" | "expl",
        courseId: r.course_id,
      }))
    ).map((m) => {
      const row = mine.find(
        (r) => r.part === m.part && (r.course_id ?? 0) === (m.courseId ?? 0)
      );
      return {
        ...m,
        savedPlanned: row?.planned ?? 0,
        actual: row?.actual ?? 0,
      };
    });

    // ما يمكن إضافته يدويًا: مقررات مساره التي ليست في بنوده بعد
    const used = new Set(metrics.map((m) => `${m.part}:${m.courseId ?? 0}`));
    const addable: QiyasStudent["addable"] = [];
    for (const c of trackCourses) {
      if (c.has_memo && !used.has(`memo:${c.id}`)) {
        addable.push({ key: `memo:${c.id}`, label: `${c.name} — حفظ`, unit: memoUnit(c) });
      }
      if (c.has_expl && !used.has(`expl:${c.id}`)) {
        addable.push({
          key: `expl:${c.id}`,
          label: `${c.name} — ${c.expl_label}`,
          unit: c.unit,
        });
      }
    }
    return { id: s.id, name: s.name, metrics, addable };
  });

  const href = (m: number, t: TrackKey) => `/qiyas?month=${m}&track=${t}`;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="page-title text-xl">قياس الأداء</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          إنجاز الطلاب شهرًا بشهر في <strong>القرآن</strong> و<strong>المتون العلمية</strong> —
          المفترض من خطة كل طالب، والفعلي تُدخله أنت. كل متن بوحدته.
        </p>
      </div>

      {/* المسار */}
      <div className="flex flex-wrap gap-2">
        {TRACKS.map((t) => (
          <Link
            key={t.key}
            href={href(month, t.key)}
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

      {/* الشهر */}
      <div className="card p-3">
        <div className="mb-2 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          شهر القياس
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PLAN_MONTHS.map((m) => (
            <Link
              key={m.no}
              href={href(m.no, track)}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition"
              style={{
                borderColor: m.no === month ? info.color : "var(--hairline)",
                background: m.no === month ? `${info.color}1a` : "transparent",
                color: m.no === month ? info.color : "var(--text-secondary)",
              }}
            >
              {m.short}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs num" style={{ color: "var(--text-muted)" }}>
          {monthInfo.name} · {monthInfo.from.gregorian} → {monthInfo.to.gregorian}
        </p>
      </div>

      {!info.timeline && (
        <p className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          {info.name} بلا جدول زمني، فلا مفترض يُشتقّ من خطة — اكتب المفترض والفعلي معًا، وأضف
          البنود التي يعمل عليها الطالب هذا الشهر من «أضف بندًا».
        </p>
      )}

      <QiyasBoard
        key={`${track}-${month}`}
        track={info}
        month={month}
        monthName={monthInfo.name}
        students={rows}
      />
    </div>
  );
}

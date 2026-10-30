import Link from "next/link";
import QiyasBoard from "@/components/QiyasBoard";
import type { QiyasColumn, QiyasStudent } from "@/components/QiyasBoard";
import { saveThresholds } from "@/app/plan-actions";
import {
  DEFAULT_THRESHOLDS,
  plannedForMonth,
  PLAN_MONTHS,
  type Part,
} from "@/lib/performance";
import { memoUnit } from "@/lib/plan";
import type { Course } from "@/lib/plan";
import type { Cadence } from "@/lib/calendar";
import { isTrack, TRACKS, trackInfo, type TrackKey } from "@/lib/tracks";
import {
  getSettings,
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

const QURAN: QiyasColumn = {
  key: "quran:0",
  group: "القرآن",
  label: "القرآن",
  unit: "صفحة",
  part: "quran",
  courseId: null,
};

function columnOf(course: Course, part: "memo" | "expl"): QiyasColumn {
  return {
    key: `${part}:${course.id}`,
    group: "المتون",
    label: `${course.name} — ${part === "memo" ? "حفظ" : course.expl_label}`,
    unit: part === "memo" ? memoUnit(course) : course.unit,
    part,
    courseId: course.id,
  };
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

  const [allCourses, trackCourses, students, items, saved, settings] = await Promise.all([
    listCourses(true),
    listCourses(false, track),
    listStudents(undefined, track),
    planItemsByTrack(track),
    performanceOfMonth(month, track),
    getSettings(),
  ]);

  const thresholds = {
    green: Number(settings.qiyas_green) || DEFAULT_THRESHOLDS.green,
    amber: Number(settings.qiyas_amber) || DEFAULT_THRESHOLDS.amber,
  };

  // ما توجبه خطة كل طالب هذا الشهر
  const plannedOf = new Map<number, Map<string, number>>();
  for (const s of students) {
    plannedOf.set(
      s.id,
      info.timeline
        ? plannedForMonth(
            allCourses,
            toPicks(items.get(s.id) ?? []),
            (s.cadence || "weekly") as Cadence,
            month
          )
        : new Map<string, number>()
    );
  }

  /**
   * أعمدة الشهر: القرآن دائمًا، ثم كل بند أوجبته خطة طالبٍ ما أو سبق
   * أن سُجّل له — فعمود واحد يخدم كل الطلاب وإن لم يكن في خطة بعضهم.
   */
  const byId = new Map(allCourses.map((c) => [c.id, c]));
  const wanted = new Set<string>();
  for (const map of plannedOf.values()) for (const k of map.keys()) wanted.add(k);
  for (const rows of saved.values()) {
    for (const r of rows) {
      if (r.part !== "quran" && r.course_id) wanted.add(`${r.part}:${r.course_id}`);
    }
  }

  const columns: QiyasColumn[] = [QURAN];
  for (const course of allCourses) {
    for (const part of ["memo", "expl"] as const) {
      if (wanted.has(`${part}:${course.id}`)) columns.push(columnOf(course, part));
    }
  }

  const rows: QiyasStudent[] = students.map((s) => {
    const mine = saved.get(s.id) ?? [];
    const planned = plannedOf.get(s.id) ?? new Map<string, number>();
    const cells: QiyasStudent["cells"] = {};
    for (const c of columns) {
      const row = mine.find(
        (r) => r.part === c.part && (r.course_id ?? 0) === (c.courseId ?? 0)
      );
      const fromPlan = c.part === "quran" ? undefined : planned.get(c.key);
      // لا خليّة إلا لما أوجبته خطته أو سبق تسجيله — والقرآن للجميع
      if (c.part !== "quran" && fromPlan === undefined && !row) continue;
      cells[c.key] = {
        ...(fromPlan !== undefined ? { planned: fromPlan } : {}),
        savedPlanned: row?.planned ?? 0,
        actual: row?.actual ?? 0,
      };
    }
    return { id: s.id, name: s.name, cells };
  });

  // بنود يمكن للمشرف إضافتها عمودًا لكل الطلاب
  const addable = trackCourses
    .flatMap((c) => [
      c.has_memo ? columnOf(c, "memo") : null,
      c.has_expl ? columnOf(c, "expl") : null,
    ])
    .filter((c): c is QiyasColumn => !!c && !columns.some((x) => x.key === c.key));

  const href = (m: number, t: TrackKey) => `/qiyas?month=${m}&track=${t}`;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="page-title text-xl">قياس الأداء</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          صفٌّ لكل طالب: لكل بند <strong>مفترض</strong> و<strong>فعلي</strong> ونسبة ملوّنة، ثم
          نسبة كل محور ونسبة الطالب — ليُقرأ المستوى من نظرة.
        </p>
      </div>

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

      {/* حدود الألوان */}
      <form action={saveThresholds} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">أخضر من</label>
          <input
            name="green"
            type="number"
            min={1}
            max={200}
            defaultValue={thresholds.green}
            className="input num w-24 text-center"
          />
        </div>
        <div>
          <label className="label">أصفر من</label>
          <input
            name="amber"
            type="number"
            min={1}
            max={200}
            defaultValue={thresholds.amber}
            className="input num w-24 text-center"
          />
        </div>
        <button className="btn btn-ghost text-sm">حفظ الحدود</button>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          النسبة {thresholds.green}% فأعلى خضراء، ومن {thresholds.amber}% إلى{" "}
          {thresholds.green - 1}% صفراء، وما دونها حمراء.
        </span>
      </form>

      {!info.timeline && (
        <p className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          {info.name} بلا جدول زمني، فلا مفترض يُشتقّ من خطة — اكتب المفترض والفعلي معًا، وأضف
          أعمدة ما يعمل عليه الطلاب هذا الشهر.
        </p>
      )}

      <QiyasBoard
        key={`${track}-${month}`}
        track={info}
        month={month}
        monthName={monthInfo.name}
        columns={columns}
        students={rows}
        addable={addable}
        thresholds={thresholds}
      />
    </div>
  );
}

import Link from "next/link";
import QiyasBoard from "@/components/QiyasBoard";
import type { QiyasColumn, QiyasStudent } from "@/components/QiyasBoard";
import { saveThresholds } from "@/app/plan-actions";
import {
  DEFAULT_THRESHOLDS,
  plannedForMonth,
  plannedForYear,
  PLAN_MONTHS,
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
  performanceTotals,
  planItemsByTrack,
  toPicks,
} from "@/lib/queries";

/** محاور الشاشة: القرآن وحده، أو المتون وحدها، أو الاثنان */
const VIEWS = [
  { key: "all", label: "الكل", groups: ["القرآن", "المتون"] },
  { key: "quran", label: "القرآن", groups: ["القرآن"] },
  { key: "mutoon", label: "المتون", groups: ["المتون"] },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

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
  searchParams: Promise<{ month?: string; track?: string; view?: string }>;
}) {
  const { month: rawMonth, track: rawTrack, view: rawView } = await searchParams;
  const track = (isTrack(rawTrack) ? rawTrack : TRACKS[0].key) as TrackKey;
  const info = trackInfo(track);
  const view = (VIEWS.find((v) => v.key === rawView)?.key ?? "all") as ViewKey;
  const shown = VIEWS.find((v) => v.key === view)!.groups as readonly string[];

  // «السنة كاملة»: حصيلة الأشهر كلها، تُقرأ ولا تُكتب
  const wholeYear = rawMonth === "all";
  const asked = Math.trunc(Number(rawMonth ?? 0));
  const month = asked >= 1 && asked <= PLAN_MONTHS.length ? asked : currentMonth();
  const monthInfo = PLAN_MONTHS[month - 1];
  const periodName = wholeYear ? "السنة كاملة" : monthInfo.name;

  const [allCourses, trackCourses, students, items, saved, settings] = await Promise.all([
    listCourses(true),
    listCourses(false, track),
    listStudents(undefined, track),
    planItemsByTrack(track),
    wholeYear ? performanceTotals(track) : performanceOfMonth(month, track),
    getSettings(),
  ]);

  const thresholds = {
    green: Number(settings.qiyas_green) || DEFAULT_THRESHOLDS.green,
    amber: Number(settings.qiyas_amber) || DEFAULT_THRESHOLDS.amber,
  };

  // ما توجبه خطة كل طالب في هذه المدة
  const plannedOf = new Map<number, Map<string, number>>();
  for (const s of students) {
    const picks = toPicks(items.get(s.id) ?? []);
    const cadence = (s.cadence || "weekly") as Cadence;
    plannedOf.set(
      s.id,
      info.timeline
        ? wholeYear
          ? plannedForYear(allCourses, picks, cadence)
          : plannedForMonth(allCourses, picks, cadence, month)
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
  // تصفية المحور: القرآن وحده أو المتون وحدها
  const visible = columns.filter((c) => shown.includes(c.group));

  const rows: QiyasStudent[] = students.map((s) => {
    const mine = saved.get(s.id) ?? [];
    const planned = plannedOf.get(s.id) ?? new Map<string, number>();
    const cells: QiyasStudent["cells"] = {};
    for (const c of visible) {
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
  const addable = shown.includes("المتون")
    ? trackCourses
        .flatMap((c) => [
          c.has_memo ? columnOf(c, "memo") : null,
          c.has_expl ? columnOf(c, "expl") : null,
        ])
        .filter((c): c is QiyasColumn => !!c && !columns.some((x) => x.key === c.key))
    : [];

  const href = (m: number | "all", t: TrackKey, v: ViewKey = view) =>
    `/qiyas?month=${m}&track=${t}&view=${v}`;
  const here = wholeYear ? ("all" as const) : month;

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
            href={href(here, t.key)}
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
          المحور
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href(here, track, v.key)}
              className="rounded-lg border px-3 py-1.5 text-xs font-bold transition"
              style={{
                borderColor: view === v.key ? info.color : "var(--hairline)",
                background: view === v.key ? `${info.color}1a` : "transparent",
                color: view === v.key ? info.color : "var(--text-secondary)",
              }}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card p-3">
        <div className="mb-2 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          مدة القياس
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={href("all", track)}
            className="rounded-lg border px-2.5 py-1.5 text-xs font-bold transition"
            style={{
              borderColor: wholeYear ? info.color : "var(--hairline)",
              background: wholeYear ? `${info.color}1a` : "transparent",
              color: wholeYear ? info.color : "var(--text-secondary)",
            }}
          >
            السنة كاملة
          </Link>
          {PLAN_MONTHS.map((m) => (
            <Link
              key={m.no}
              href={href(m.no, track)}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition"
              style={{
                borderColor: !wholeYear && m.no === month ? info.color : "var(--hairline)",
                background: !wholeYear && m.no === month ? `${info.color}1a` : "transparent",
                color: !wholeYear && m.no === month ? info.color : "var(--text-secondary)",
              }}
            >
              {m.short}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs num" style={{ color: "var(--text-muted)" }}>
          {wholeYear
            ? `حصيلة السنة · ${PLAN_MONTHS[0].from.gregorian} → ${PLAN_MONTHS[PLAN_MONTHS.length - 1].to.gregorian}`
            : `${monthInfo.name} · ${monthInfo.from.gregorian} → ${monthInfo.to.gregorian}`}
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

      {wholeYear && (
        <p className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          هذه <strong>حصيلة السنة</strong>: المفترض والفعلي مجموع الأشهر كلها، تُقرأ ولا تُكتب.
          للتسجيل أو التعديل اختر شهرًا من الأعلى.
        </p>
      )}

      {!wholeYear && !info.timeline && (
        <p className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          {info.name} بلا جدول زمني، فلا مفترض يُشتقّ من خطة — اكتب المفترض والفعلي معًا، وأضف
          أعمدة ما يعمل عليه الطلاب هذا الشهر.
        </p>
      )}

      <QiyasBoard
        key={`${track}-${here}-${view}`}
        track={info}
        month={month}
        monthName={periodName}
        columns={visible}
        students={rows}
        addable={addable}
        thresholds={thresholds}
        readOnly={wholeYear}
      />
    </div>
  );
}

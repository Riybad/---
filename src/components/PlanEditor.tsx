"use client";

import { useActionState, useMemo, useState } from "react";
import { updatePlan } from "@/app/plan-actions";
import { cadenceInfo } from "@/lib/calendar";
import type { Cadence } from "@/lib/calendar";
import {
  approxMonths,
  defaultWeeks,
  explTotal,
  memoTotal,
  rateFor,
  sessionsNeeded,
  spanOf,
  unitLabel,
  weeksForPeriods,
  weeksLabel,
  YEAR_WEEKS,
  type Course,
  type Pick,
} from "@/lib/plan";
import { COURSE_COLORS } from "@/components/PlanWizard";

type Row = { courseId: number; weeks: number };

/** محرّر خطة الطالب في اللوحة: المدد والترتيب والحذف والإضافة */
export default function PlanEditor({
  studentId,
  courses,
  picks,
  cadence,
}: {
  studentId: number;
  courses: Course[];
  picks: Pick[];
  cadence: Cadence;
}) {
  const [error, action, pending] = useActionState(updatePlan, null);
  const [saved, setSaved] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    picks.map((p) => {
      const c = courses.find((x) => x.id === p.courseId);
      const span = c ? sessionsNeeded(c, p.memoPer, p.explPer) : 1;
      return { courseId: p.courseId, weeks: weeksForPeriods(span, cadence) };
    })
  );

  const info = cadenceInfo(cadence);
  const colorOf = (id: number) =>
    COURSE_COLORS[Math.max(0, courses.findIndex((c) => c.id === id)) % COURSE_COLORS.length];

  const used = rows.reduce((a, r) => a + r.weeks, 0);
  const free = Math.max(0, YEAR_WEEKS - used);
  const missing = courses.filter((c) => !rows.some((r) => r.courseId === c.id));

  /** بنود جاهزة للحفظ: البداية تُشتقّ من الترتيب */
  const computed: Pick[] = useMemo(() => {
    let start = 0;
    return rows.map((r) => {
      const c = courses.find((x) => x.id === r.courseId);
      if (!c) return { courseId: r.courseId, memoPer: 0, explPer: 0, start };
      const pick = {
        courseId: r.courseId,
        memoPer: rateFor(memoTotal(c), r.weeks, cadence),
        explPer: rateFor(explTotal(c), r.weeks, cadence),
        start,
      };
      start += sessionsNeeded(c, pick.memoPer, pick.explPer);
      return pick;
    });
  }, [rows, courses, cadence]);

  /** توزيع مبدئي على مقررات المسار كلها — بالتناسب مع أحجامها */
  const autoSplit = () =>
    setRows(
      defaultWeeks(courses, cadence).map((weeks, i) => ({ courseId: courses[i].id, weeks }))
    );

  const set = (i: number, weeks: number) =>
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, weeks: Math.max(1, weeks) } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form
      action={action}
      onSubmit={() => setSaved(true)}
      className="card grid gap-4 p-5"
    >
      <input type="hidden" name="id" value={studentId} />
      <input type="hidden" name="picks" value={JSON.stringify(computed)} />

      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-bold">تعديل الخطة</h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          المدة بالأسابيع · المقررات متتابعة بترتيبها هنا
        </span>
        <span
          className="ms-auto text-sm font-bold"
          style={{ color: free > 0 ? "var(--brand-olive)" : "var(--brand-amber)" }}
        >
          {used} من {YEAR_WEEKS} أسبوعًا{free > 0 ? ` · بقي ${weeksLabel(free)}` : " · السنة ممتلئة"}
        </span>
        {courses.length > 0 && (
          <button type="button" className="btn btn-ghost text-xs" onClick={autoSplit}>
            وزّع المقررات تلقائيًا
          </button>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          لا مقررات في خطته — اضغط «وزّع المقررات تلقائيًا» أو أضف مقررًا من الأسفل.
        </p>
      )}

      <ul className="grid gap-3">
        {rows.map((r, i) => {
          const course = courses.find((c) => c.id === r.courseId);
          if (!course) return null;
          const color = colorOf(course.id);
          const span = spanOf(course, computed[i], cadence);
          const memoPer = computed[i].memoPer;
          const explPer = computed[i].explPer;
          return (
            <li
              key={r.courseId}
              className="rounded-xl border p-3"
              style={{ borderColor: `${color}55`, background: `${color}0d` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                <span className="font-bold">{course.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {course.subject}
                </span>
                <div className="ms-auto flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-xs"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="قدّم"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-xs"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="أخّر"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-xs"
                    onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}
                  >
                    حذف
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost h-9 w-9 justify-center text-lg"
                    disabled={r.weeks <= 1}
                    onClick={() => set(i, r.weeks - 1)}
                    aria-label="أنقص أسبوعًا"
                  >
                    −
                  </button>
                  <div className="min-w-24 text-center">
                    <div className="font-extrabold" style={{ color }}>
                      {weeksLabel(r.weeks)}
                    </div>
                    {approxMonths(r.weeks) && (
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {approxMonths(r.weeks)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost h-9 w-9 justify-center text-lg"
                    onClick={() => set(i, r.weeks + 1)}
                    aria-label="زد أسبوعًا"
                  >
                    +
                  </button>
                </div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {course.has_memo && <>🧠 {unitLabel(memoPer, course.unit)} </>}
                  {course.has_expl && (
                    <>
                      📖 {unitLabel(explPer, course.unit)}{" "}
                    </>
                  )}
                  <span style={{ color: "var(--text-muted)" }}>{info.per}</span>
                </div>
                <div className="w-full text-xs num" style={{ color: "var(--text-muted)" }}>
                  {span.startPeriod?.first.hijri} ← {span.endPeriod?.last.hijri}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
            أضف مقررًا:
          </span>
          {missing.map((c) => (
            <button
              key={c.id}
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() =>
                setRows((cur) => [...cur, { courseId: c.id, weeks: Math.max(1, Math.min(free || 1, 8)) }])
              }
            >
              + {c.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
      {saved && !error && !pending && (
        <p className="text-sm font-semibold" style={{ color: "var(--good-text)" }}>
          ✓ حُفظت الخطة
        </p>
      )}

      <div>
        <button className="btn btn-primary text-sm" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ الخطة"}
        </button>
      </div>
    </form>
  );
}

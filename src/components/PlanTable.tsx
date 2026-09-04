import { cadenceInfo, gregShort } from "@/lib/calendar";
import type { Cadence } from "@/lib/calendar";
import {
  buildSchedule,
  explTotal,
  memoTotal,
  periodsLabel,
  portionText,
  spanOf,
  unitLabel,
  type Course,
  type Pick,
} from "@/lib/plan";
import { COURSE_COLORS } from "@/components/PlanWizard";

export function courseColor(courses: Course[], id: number): string {
  const i = courses.findIndex((c) => c.id === id);
  return COURSE_COLORS[(i < 0 ? 0 : i) % COURSE_COLORS.length];
}

/** بطاقات المقررات: المعدل ومدى كل مقرر في السنة */
export function CourseSummary({
  courses,
  picks,
  cadence,
}: {
  courses: Course[];
  picks: Pick[];
  cadence: Cadence;
}) {
  const info = cadenceInfo(cadence);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {picks.map((p) => {
        const course = courses.find((c) => c.id === p.courseId);
        if (!course) return null;
        const span = spanOf(course, p, cadence);
        const color = courseColor(courses, course.id);
        return (
          <div
            key={p.courseId}
            className="rounded-xl border p-4"
            style={{ borderColor: `${color}55`, background: `${color}10` }}
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: color }} />
              <span className="font-bold">{course.name}</span>
              {course.subject && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {course.subject}
                </span>
              )}
              <span className="ms-auto text-xs num" style={{ color: "var(--text-muted)" }}>
                {periodsLabel(span.count, cadence)}
              </span>
            </div>
            <div className="mt-2 grid gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {p.memoPer > 0 && (
                <div>
                  حفظ: {unitLabel(p.memoPer, course.unit)} {info.per} — من{" "}
                  {unitLabel(memoTotal(course), course.unit)}
                </div>
              )}
              {p.explPer > 0 && (
                <div>
                  {course.expl_label}: {unitLabel(p.explPer, course.unit)} {info.per} — من{" "}
                  {unitLabel(explTotal(course), course.unit)}
                </div>
              )}
              <div>
                من {span.startPeriod?.first.hijri} إلى {span.endPeriod?.last.hijri}
              </div>
              <div className="num" dir="ltr">
                {gregShort(span.startPeriod?.first.gregorian ?? "")} →{" "}
                {gregShort(span.endPeriod?.last.gregorian ?? "")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** جدول اللقاءات: لكل لقاء ما يُحفظ وما يُشرح */
export default function PlanTable({
  courses,
  picks,
  cadence,
}: {
  courses: Course[];
  picks: Pick[];
  cadence: Cadence;
}) {
  const info = cadenceInfo(cadence);
  const rows = buildSchedule(courses, picks, cadence).filter((r) => r.portions.length > 0);
  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        لا توجد فترات في هذه الخطة.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th className="w-12">{info.each}</th>
            <th>التاريخ الهجري</th>
            <th>الميلادي</th>
            <th>المقرر</th>
            <th>الحفظ</th>
            <th>الشرح / القراءة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.no}>
              <td className="num">{r.no}</td>
              <td>{r.period.hijri}</td>
              <td className="num" dir="ltr">
                {r.period.gregorian.split(" → ").map(gregShort).join(" → ")}
              </td>
              <td>
                <div className="grid gap-1">
                  {r.portions.map((p) => (
                    <span
                      key={p.course.id}
                      className="font-semibold"
                      style={{ color: courseColor(courses, p.course.id) }}
                    >
                      {p.course.name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="num">
                <div className="grid gap-1">
                  {r.portions.map((p) => (
                    <span key={p.course.id}>{portionText(p.memoFrom, p.memoTo)}</span>
                  ))}
                </div>
              </td>
              <td className="num">
                <div className="grid gap-1">
                  {r.portions.map((p) => (
                    <span key={p.course.id}>{portionText(p.explFrom, p.explTo)}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

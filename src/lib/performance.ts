import { monthsOfYear, periodsOf } from "./calendar";
import type { Cadence } from "./calendar";
import { buildSchedule, memoUnit, type Course, type Pick } from "./plan";

/* ————— قياس الأداء: المفترض من الخطة، والفعلي يُدخله المشرف ————— */

/** شهور سنة الخطة بترتيبها: 1 إلى 13 */
export const PLAN_MONTHS = monthsOfYear().map((m, i) => ({
  no: i + 1,
  key: m.key,
  name: `${m.name} ${m.year}هـ`,
  short: m.name,
  from: m.days[0],
  to: m.days[m.days.length - 1],
}));

export type Part = "quran" | "memo" | "expl";

/** بند في شاشة القياس: القرآن، أو مسار من مسارَي مقرر */
export type Metric = {
  part: Part;
  courseId: number | null;
  /** اسم البند كما يُعرض */
  label: string;
  unit: string;
  /** المفترض المشتقّ من الخطة — غير محدّد يعني أنه يُدخَل يدويًا */
  planned?: number;
};

/** رقم الشهر (1..13) الذي يقع فيه هذا اليوم من السنة */
function monthOfDayIndex(dayIndex: number): number {
  for (const m of PLAN_MONTHS) {
    if (dayIndex >= m.from.index && dayIndex <= m.to.index) return m.no;
  }
  return PLAN_MONTHS.length;
}

/**
 * ما تُوجبه خطة الطالب في شهر معيّن، لكل مقرر ومساره.
 *
 * الفترة التي تعبر حدّ الشهر تُحسب في الشهر الذي تبدأ فيه — فالأسبوع
 * لا يُجزّأ، وهكذا يبقى مجموع الأشهر مساويًا لمجموع المقرر كاملًا.
 */
export function plannedForMonth(
  courses: Course[],
  picks: Pick[],
  cadence: Cadence,
  month: number
): Map<string, number> {
  const periods = periodsOf(cadence);
  const out = new Map<string, number>();
  const add = (key: string, n: number) => {
    if (n > 0) out.set(key, (out.get(key) ?? 0) + n);
  };

  for (const row of buildSchedule(courses, picks, cadence)) {
    const period = periods[row.period.index];
    if (!period || monthOfDayIndex(period.first.index) !== month) continue;
    for (const p of row.portions) {
      if (p.memoTo > 0) add(`memo:${p.course.id}`, p.memoTo - p.memoFrom + 1);
      if (p.explTo > 0) add(`expl:${p.course.id}`, p.explTo - p.explFrom + 1);
    }
  }
  return out;
}

/** بنود طالب في شهر: القرآن دائمًا، ثم ما توجبه خطته (أو ما سُجّل له) */
export function metricsFor(
  courses: Course[],
  planned: Map<string, number>,
  extra: { part: Part; courseId: number | null }[]
): Metric[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const out: Metric[] = [{ part: "quran", courseId: null, label: "القرآن", unit: "صفحة" }];
  const seen = new Set<string>();

  const push = (part: Part, courseId: number, amount?: number) => {
    const key = `${part}:${courseId}`;
    if (seen.has(key)) return;
    const course = byId.get(courseId);
    if (!course) return;
    seen.add(key);
    out.push({
      part,
      courseId,
      label: `${course.name} — ${part === "memo" ? "حفظ" : course.expl_label}`,
      unit: part === "memo" ? memoUnit(course) : course.unit,
      planned: amount,
    });
  };

  // ما توجبه الخطة هذا الشهر، بترتيب المقررات
  for (const course of courses) {
    for (const part of ["memo", "expl"] as const) {
      const amount = planned.get(`${part}:${course.id}`);
      if (amount) push(part, course.id, amount);
    }
  }
  // وما أضافه المشرف يدويًا (مسار بلا جدول، أو مقرر خارج الشهر)
  for (const e of extra) {
    if (e.part !== "quran" && e.courseId) push(e.part, e.courseId);
  }
  return out;
}

/** نسبة الإنجاز: الفعلي من المفترض */
export function ratio(planned: number, actual: number): number | null {
  if (planned <= 0) return null;
  return Math.round((actual / planned) * 100);
}

/* ————— حدود ألوان النسب — يضبطها المشرف ————— */

export type Thresholds = { green: number; amber: number };
export const DEFAULT_THRESHOLDS: Thresholds = { green: 85, amber: 60 };

export type Grade = "good" | "warn" | "bad" | "none";

export function gradeOf(pct: number | null, t: Thresholds): Grade {
  if (pct === null) return "none";
  if (pct >= t.green) return "good";
  if (pct >= t.amber) return "warn";
  return "bad";
}

/**
 * نسبة المحور: متوسط نسب بنوده لا مجموعها.
 * وحدات البنود تختلف (بيت وسطر وصفحة) فلا يصحّ جمعها، أما نسبها
 * فمقارنة بلا وحدة — ولذلك تُجمع وتُقسَّم على عددها.
 */
export function averageRatio(parts: (number | null)[]): number | null {
  const known = parts.filter((p): p is number => p !== null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((a, n) => a + n, 0) / known.length);
}

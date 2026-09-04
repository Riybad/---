import { SESSIONS, SESSION_COUNT } from "./calendar";
import type { CalDay } from "./calendar";

export type Course = {
  id: number;
  name: string;
  /** الفن: العقيدة، الفقه، اللغة… */
  subject: string;
  unit: string;
  /** حجم مسار الحفظ ومسار الشرح/القراءة — قد يختلفان (التاريخ: حفظ 30، قراءة 750) */
  memo_total: number;
  expl_total: number;
  /** مسمّى المسار الثاني: «شرح» أو «قراءة» */
  expl_label: string;
  has_memo: boolean;
  has_expl: boolean;
  sort_order: number;
  active: boolean;
};

/** حجم المسار الذي يعمل عليه الطالب */
export function memoTotal(c: Course): number {
  return c.has_memo ? Math.max(0, c.memo_total) : 0;
}

export function explTotal(c: Course): number {
  return c.has_expl ? Math.max(0, c.expl_total) : 0;
}

/** اختيار الطالب لمقرر واحد: كم يأخذ في اللقاء، ومن أي لقاء يبدأ */
export type Pick = {
  courseId: number;
  memoPer: number;
  explPer: number;
  /** ترتيب اللقاء الذي يبدأ منه المقرر (0 = أول لقاء في السنة) */
  start: number;
};

export const UNITS = ["بيت", "صفحة", "باب", "درس", "سؤال", "حديث", "فصل"];

const PLURALS: Record<string, string> = {
  بيت: "أبيات",
  صفحة: "صفحات",
  باب: "أبواب",
  درس: "دروس",
  سؤال: "أسئلة",
  حديث: "أحاديث",
  فصل: "فصول",
};

/**
 * صياغة عربية سليمة للعدد مع وحدته:
 * بيت / بيتان / 5 أبيات / 15 بيتًا — وللمؤنث: صفحة / صفحتان / 5 صفحات / 15 صفحةً
 */
export function unitLabel(n: number, unit: string): string {
  if (n <= 0) return "—";
  const feminine = unit.endsWith("ة");
  if (n === 1) return unit;
  if (n === 2) return feminine ? `${unit.slice(0, -1)}تان` : `${unit}ان`;
  if (n <= 10) return `${n} ${PLURALS[unit] ?? unit}`;
  return `${n} ${unit}${feminine ? "ً" : "ًا"}`;
}

/** صياغة عدد اللقاءات: لقاء / لقاءان / 5 لقاءات / 15 لقاءً */
export function sessionsLabel(n: number): string {
  if (n <= 0) return "لا لقاءات";
  if (n === 1) return "لقاء واحد";
  if (n === 2) return "لقاءان";
  if (n <= 10) return `${n} لقاءات`;
  return `${n} لقاءً`;
}

/** عدد اللقاءات التي يستهلكها المقرر بهذا المعدل */
export function sessionsNeeded(course: Course, memoPer: number, explPer: number): number {
  const a = memoPer > 0 ? Math.ceil(memoTotal(course) / memoPer) : 0;
  const b = explPer > 0 ? Math.ceil(explTotal(course) / explPer) : 0;
  return Math.max(a, b);
}

/** المعدل المقترح لإنهاء المقرر خلال عدد لقاءات محدد */
export function suggestRate(total: number, sessions: number): number {
  if (sessions <= 0) return total;
  return Math.max(1, Math.ceil(total / sessions));
}

export type Span = {
  course: Course;
  pick: Pick;
  sessions: number;
  startDay: CalDay | null;
  endDay: CalDay | null;
  /** يتجاوز آخر لقاء في السنة */
  overflow: boolean;
};

export function spanOf(course: Course, pick: Pick): Span {
  const sessions = sessionsNeeded(course, pick.memoPer, pick.explPer);
  const start = Math.max(0, Math.min(pick.start, SESSION_COUNT - 1));
  const endIdx = start + sessions - 1;
  return {
    course,
    pick,
    sessions,
    startDay: sessions > 0 ? SESSIONS[start] ?? null : null,
    endDay: sessions > 0 ? SESSIONS[Math.min(endIdx, SESSION_COUNT - 1)] ?? null : null,
    overflow: sessions > 0 && endIdx > SESSION_COUNT - 1,
  };
}

export type Portion = {
  course: Course;
  /** رقم اللقاء ضمن المقرر نفسه (يبدأ من 1) */
  nth: number;
  memoFrom: number;
  memoTo: number;
  explFrom: number;
  explTo: number;
};

export type ScheduleRow = {
  session: CalDay;
  /** ترتيب اللقاء في السنة (يبدأ من 1) */
  no: number;
  portions: Portion[];
};

function range(total: number, per: number, nth: number): [number, number] {
  if (per <= 0) return [0, 0];
  const from = (nth - 1) * per + 1;
  if (from > total) return [0, 0];
  return [from, Math.min(nth * per, total)];
}

/** يبني جدول السنة: لكل لقاء ما الذي يُحفظ ويُشرح فيه */
export function buildSchedule(courses: Course[], picks: Pick[]): ScheduleRow[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const rows: ScheduleRow[] = SESSIONS.map((session, i) => ({ session, no: i + 1, portions: [] }));

  for (const pick of picks) {
    const course = byId.get(pick.courseId);
    if (!course) continue;
    const { sessions, pick: p } = spanOf(course, pick);
    for (let k = 0; k < sessions; k++) {
      const idx = p.start + k;
      if (idx >= rows.length) break;
      const [memoFrom, memoTo] = range(memoTotal(course), pick.memoPer, k + 1);
      const [explFrom, explTo] = range(explTotal(course), pick.explPer, k + 1);
      if (!memoTo && !explTo) continue;
      rows[idx].portions.push({ course, nth: k + 1, memoFrom, memoTo, explFrom, explTo });
    }
  }
  return rows;
}

/** نص مختصر للمقدار: «1 – 12» أو «—» */
export function portionText(from: number, to: number): string {
  if (!to) return "—";
  return from === to ? `${from}` : `${from} – ${to}`;
}

export const YEAR_SESSIONS = SESSION_COUNT;

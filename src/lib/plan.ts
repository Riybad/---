import { cadenceInfo, periodsOf } from "./calendar";
import type { Cadence, Period } from "./calendar";

export type Course = {
  id: number;
  name: string;
  /** الفن: العقيدة، الفقه، اللغة… */
  subject: string;
  /** وحدة المسار الثاني (القراءة/الشرح) */
  unit: string;
  /** وحدة الحفظ إن اختلفت — فارغة تعني أنها وحدة المقرر نفسها */
  memo_unit: string;
  /** نوع المتن: نظم، نثر، كتاب… */
  kind: string;
  /** معيار الضبط: حفظ، ملخص، اختبار… */
  mastery: string;
  /** حجم مسار الحفظ ومسار الشرح/القراءة — قد يختلفان (التاريخ: حفظ 30، قراءة 750) */
  memo_total: number;
  expl_total: number;
  /** مسمّى المسار الثاني: «شرح» أو «قراءة» */
  expl_label: string;
  /** التسجيل الصوتي للمتن (للحفظ): من يقرؤه ورابطه */
  recitation_name: string;
  recitation_url: string;
  /** الشرح: الشارح، ورابط الكتاب، ورابط المرئيات */
  sharh_name: string;
  sharh_book_url: string;
  sharh_video_url: string;
  has_memo: boolean;
  has_expl: boolean;
  /** المسار الذي ينتمي له المقرر: tarbawi | ilmi */
  track: string;
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

/** اختيار الطالب لمقرر واحد: كم يأخذ في الفترة، ومن أي فترة يبدأ */
export type Pick = {
  courseId: number;
  memoPer: number;
  explPer: number;
  /** ترتيب الفترة التي يبدأ منها المقرر (0 = أول فترة في السنة) */
  start: number;
  /** هل أنهى الطالب هذا المقرر — يسجّله المشرف، ويُقرأ في التصدير */
  done?: boolean;
};

export const UNITS = ["بيت", "سطر", "صفحة", "باب", "درس", "سؤال", "حديث", "فصل"];

/** وحدة الحفظ — قد تختلف عن وحدة القراءة (أسطر حفظ مقابل صفحات قراءة) */
export function memoUnit(c: Course): string {
  return c.memo_unit || c.unit;
}

const PLURALS: Record<string, string> = {
  بيت: "أبيات",
  سطر: "أسطر",
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

const PERIOD_WORDS: Record<Cadence, [string, string, string, string]> = {
  daily: ["يوم واحد", "يومان", "أيام", "يومًا"],
  weekly: ["أسبوع واحد", "أسبوعان", "أسابيع", "أسبوعًا"],
  monthly: ["شهر واحد", "شهران", "أشهر", "شهرًا"],
};

/** صياغة عدد الفترات: أسبوع واحد / أسبوعان / 5 أسابيع / 15 أسبوعًا */
export function periodsLabel(n: number, cadence: Cadence): string {
  const [one, two, few, many] = PERIOD_WORDS[cadence];
  if (n <= 0) return "—";
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** عدد الفترات التي يستهلكها المقرر بهذا المعدل */
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
  /** عدد الفترات التي يستغرقها المقرر */
  count: number;
  startPeriod: Period | null;
  endPeriod: Period | null;
  /** يتجاوز آخر فترة في السنة */
  overflow: boolean;
};

export function spanOf(course: Course, pick: Pick, cadence: Cadence): Span {
  const periods = periodsOf(cadence);
  const count = sessionsNeeded(course, pick.memoPer, pick.explPer);
  const start = Math.max(0, Math.min(pick.start, periods.length - 1));
  const endIdx = start + count - 1;
  return {
    course,
    pick,
    count,
    startPeriod: count > 0 ? periods[start] ?? null : null,
    endPeriod: count > 0 ? periods[Math.min(endIdx, periods.length - 1)] ?? null : null,
    overflow: count > 0 && endIdx > periods.length - 1,
  };
}

export type Portion = {
  course: Course;
  /** رقم الفترة ضمن المقرر نفسه (يبدأ من 1) */
  nth: number;
  memoFrom: number;
  memoTo: number;
  explFrom: number;
  explTo: number;
};

export type ScheduleRow = {
  period: Period;
  /** ترتيب الفترة في السنة (يبدأ من 1) */
  no: number;
  portions: Portion[];
};

function range(total: number, per: number, nth: number): [number, number] {
  if (per <= 0) return [0, 0];
  const from = (nth - 1) * per + 1;
  if (from > total) return [0, 0];
  return [from, Math.min(nth * per, total)];
}

/** يبني جدول السنة: لكل فترة ما الذي يُحفظ ويُقرأ فيها */
export function buildSchedule(
  courses: Course[],
  picks: Pick[],
  cadence: Cadence
): ScheduleRow[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const rows: ScheduleRow[] = periodsOf(cadence).map((period, i) => ({
    period,
    no: i + 1,
    portions: [],
  }));

  for (const pick of picks) {
    const course = byId.get(pick.courseId);
    if (!course) continue;
    const { count, pick: p } = spanOf(course, pick, cadence);
    for (let k = 0; k < count; k++) {
      const idx = Math.max(0, Math.min(p.start, rows.length - 1)) + k;
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

/** عدد الفترات المتاحة في السنة حسب الوحدة */
export function periodCount(cadence: Cadence): number {
  return periodsOf(cadence).length;
}

/* ————— المدة بالأسابيع: وحدة اختيار الطالب —————
   الطالب يفكّر بـ«في كم أنهيه؟» لا بـ«كم آخذ في الأسبوع». والأسبوع
   أدقّ من الشهر: يتيح إنهاء متن قصير في أسبوعين بدل شهر كامل. */

/** أسابيع السنة كاملة (366 يومًا) */
export const YEAR_WEEKS = 53;

/** كم فترة تقابل هذه الأسابيع في الوحدة المختارة */
export function periodsForWeeks(weeks: number, cadence: Cadence): number {
  return Math.max(1, Math.round((weeks / YEAR_WEEKS) * periodCount(cadence)));
}

/** كم أسبوعًا تقابل هذه الفترات */
export function weeksForPeriods(periods: number, cadence: Cadence): number {
  return Math.max(1, Math.round((periods / periodCount(cadence)) * YEAR_WEEKS));
}

/** صياغة المدة بالأسابيع، ومعها ما يقابلها بالأشهر إذا طالت */
export function weeksLabel(n: number): string {
  if (n <= 0) return "—";
  if (n === 1) return "أسبوع واحد";
  if (n === 2) return "أسبوعان";
  if (n <= 10) return `${n} أسابيع`;
  return `${n} أسبوعًا`;
}

/** «شهران تقريبًا» — تُعرض بجانب الأسابيع لتقريب المدة الطويلة */
export function approxMonths(weeks: number): string {
  const months = Math.round(weeks / 4.4);
  if (months < 1) return "";
  if (months === 1) return "شهر تقريبًا";
  if (months === 2) return "شهران تقريبًا";
  if (months <= 10) return `${months} أشهر تقريبًا`;
  return `${months} شهرًا تقريبًا`;
}

/** المقدار اللازم في الفترة الواحدة لإنهاء هذا الحجم خلال مدة معيّنة */
export function rateFor(total: number, weeks: number, cadence: Cadence): number {
  if (total <= 0) return 0;
  return Math.max(1, Math.ceil(total / periodsForWeeks(weeks, cadence)));
}

/**
 * توزيع افتراضي لمدد المقررات على السنة بالتناسب مع أحجامها — لا بالتساوي،
 * فالتاريخ (750 صفحة) لا يساوي متنًا من 154 بيتًا. ثم يُضيَّق التوزيع حتى
 * تنتهي المقررات كلها قبل آخر فترة في السنة.
 */
export function defaultWeeks(courses: Course[], cadence: Cadence): number[] {
  if (courses.length === 0) return [];
  const weight = (c: Course) => Math.max(memoTotal(c), explTotal(c), 1);
  const sum = courses.reduce((a, c) => a + weight(c), 0) || 1;
  const weeks = courses.map((c) => Math.max(1, Math.floor((YEAR_WEEKS * weight(c)) / sum)));

  // ما بقي من أسابيع السنة يُعطى للأكبر أولًا
  const bySize = courses.map((_, i) => i).sort((a, b) => weight(courses[b]) - weight(courses[a]));
  let rest = YEAR_WEEKS - weeks.reduce((a, n) => a + n, 0);
  for (let k = 0; rest > 0 && k < bySize.length * YEAR_WEEKS; k++) {
    weeks[bySize[k % bySize.length]]++;
    rest--;
  }

  // التقريب في rateFor قد يجعل المجموع يتجاوز السنة، فيُقلَّص من الأطول
  const total = periodCount(cadence);
  const spanOfWeeks = (i: number) =>
    sessionsNeeded(
      courses[i],
      rateFor(memoTotal(courses[i]), weeks[i], cadence),
      rateFor(explTotal(courses[i]), weeks[i], cadence)
    );
  for (let guard = 0; guard < YEAR_WEEKS * courses.length; guard++) {
    const spans = courses.map((_, i) => spanOfWeeks(i));
    if (spans.reduce((a, n) => a + n, 0) <= total) break;
    let longest = 0;
    for (let i = 1; i < weeks.length; i++) if (weeks[i] > weeks[longest]) longest = i;
    if (weeks[longest] <= 1) break;
    weeks[longest]--;
  }
  return weeks;
}

/** يبني بنود خطة متتابعة من مدد بالأسابيع */
export function picksFromWeeks(courses: Course[], weeks: number[], cadence: Cadence): Pick[] {
  let start = 0;
  return courses.map((course, i) => {
    const w = Math.max(1, weeks[i] ?? 1);
    const pick: Pick = {
      courseId: course.id,
      memoPer: rateFor(memoTotal(course), w, cadence),
      explPer: rateFor(explTotal(course), w, cadence),
      start,
    };
    start += sessionsNeeded(course, pick.memoPer, pick.explPer);
    return pick;
  });
}

export { cadenceInfo };
export type { Cadence, Period };

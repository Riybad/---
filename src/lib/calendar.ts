import { YEAR_DAYS, WEEKDAYS, TERM_OF_MONTH, HIJRI_MONTH_NAMES } from "./calendar-data";
import type { EventKey } from "./calendar-data";

export { WEEKDAYS, HIJRI_MONTH_NAMES };
export type { EventKey };

export type CalDay = {
  /** ترتيب اليوم في السنة كاملة */
  index: number;
  hy: number;
  hm: number;
  hd: number;
  monthName: string;
  weekday: string;
  /** رقم اليوم في الأسبوع (0 = الجمعة) — لمحاذاة شبكة الشهر */
  weekdayIndex: number;
  event: EventKey;
  /** التاريخ الميلادي بصيغة YYYY-MM-DD */
  gregorian: string;
  term: string;
  hijri: string;
};

export const EVENT_LABEL: Record<EventKey, string> = {
  none: "",
  weekend: "عطلة أسبوعية",
  session: "لقاء الدفعة",
  tamkeen: "لقاء تمكين",
  quran: "الأيام القرآنية",
  himma: "أيام الهمة",
  intensive: "دورة مكثفة",
  break: "إجازة دراسية",
  sleepover: "مبيت",
  forum: "ملتقى",
  recital: "عرض المحفوظ",
  summer: "النادي الصيفي",
  ramadan10: "برنامج العشر الأواخر",
};

/** ألوان الدليل كما هي في ملف «الخطة الزمنية» */
export const EVENT_COLOR: Record<EventKey, string> = {
  none: "transparent",
  weekend: "#d9d9d9",
  session: "#d8e4bc",
  tamkeen: "#e4dfec",
  quran: "#ffc000",
  himma: "#ffff00",
  intensive: "#4f6228",
  break: "#f2dbdb",
  sleepover: "#31869b",
  forum: "#980000",
  recital: "#02ffff",
  summer: "#b2a1c7",
  ramadan10: "#76933b",
};

/** الأحداث ذات الخلفية الداكنة تحتاج نصًا فاتحًا */
export const DARK_EVENTS: EventKey[] = ["intensive", "sleepover", "forum", "ramadan10"];

export const CALENDAR: CalDay[] = YEAR_DAYS.map(([hy, hm, hd, wd, event, gregorian], index) => ({
  index,
  hy,
  hm,
  hd,
  monthName: HIJRI_MONTH_NAMES[hm - 1],
  weekday: WEEKDAYS[wd],
  weekdayIndex: wd,
  event,
  gregorian,
  term: TERM_OF_MONTH[`${hy}-${hm}`] ?? "",
  hijri: `${hd} ${HIJRI_MONTH_NAMES[hm - 1]} ${hy}هـ`,
}));

/** أيام لقاء الدفعة — وهي وحدة التقسيم التي تُبنى عليها خطة الطالب */
export const SESSIONS: CalDay[] = CALENDAR.filter((d) => d.event === "session");

export const SESSION_COUNT = SESSIONS.length;

export const YEAR_SESSIONS_LABEL = `${SESSION_COUNT} لقاءً على مدار السنة`;

/** أيام عرض المحفوظ — محطات مراجعة تظهر في الخطة كتذكير */
export const RECITALS: CalDay[] = CALENDAR.filter((d) => d.event === "recital");

/* ————— فترات الدراسة الذاتية ————— */

/** وحدة التقسيم التي يختارها الطالب */
export type Cadence = "daily" | "weekly" | "monthly";

export const CADENCES: {
  key: Cadence;
  label: string;
  /** المفرد المعرّف: «اليوم» */
  each: string;
  /** الجمع المعرّف: «الأيام» */
  plural: string;
  per: string;
}[] = [
  { key: "daily", label: "يوميًا", each: "اليوم", plural: "الأيام", per: "في اليوم" },
  { key: "weekly", label: "أسبوعيًا", each: "الأسبوع", plural: "الأسابيع", per: "في الأسبوع" },
  { key: "monthly", label: "شهريًا", each: "الشهر", plural: "الأشهر", per: "في الشهر" },
];

export function cadenceInfo(c: Cadence) {
  return CADENCES.find((x) => x.key === c) ?? CADENCES[1];
}

export type Period = {
  index: number;
  /** «اليوم 12» أو «الأسبوع 3» أو «الشهر 2» */
  label: string;
  /** المدى الهجري: يوم واحد، أو «8 – 14 ربيع الأول 1448هـ» */
  hijri: string;
  gregorian: string;
  first: CalDay;
  last: CalDay;
  /** أبرز أحداث الفترة من الخطة الزمنية (إجازة، ملتقى، دورة…) */
  events: EventKey[];
};

/** المدى الهجري بصيغة مختصرة: يدمج الشهر والسنة إذا كانا متطابقين */
function hijriRange(a: CalDay, b: CalDay): string {
  if (a.index === b.index) return a.hijri;
  if (a.hy === b.hy && a.hm === b.hm) return `${a.hd} – ${b.hd} ${a.monthName} ${a.hy}هـ`;
  if (a.hy === b.hy) return `${a.hd} ${a.monthName} – ${b.hd} ${b.monthName} ${a.hy}هـ`;
  return `${a.hijri} – ${b.hijri}`;
}

/** الأحداث الجديرة بالذكر داخل الفترة — نتجاهل العطلة الأسبوعية وأيام الفراغ */
const NOTABLE: EventKey[] = [
  "break",
  "forum",
  "intensive",
  "sleepover",
  "summer",
  "ramadan10",
  "quran",
  "recital",
];

function periodOf(index: number, days: CalDay[], each: string): Period {
  const first = days[0];
  const last = days[days.length - 1];
  return {
    index,
    label: `${each} ${index + 1}`,
    hijri: hijriRange(first, last),
    gregorian:
      first.index === last.index
        ? first.gregorian
        : `${first.gregorian} → ${last.gregorian}`,
    first,
    last,
    events: NOTABLE.filter((e) => days.some((d) => d.event === e)),
  };
}

/** يقسّم السنة كاملة (366 يومًا) إلى فترات حسب الوحدة المختارة */
export function periodsOf(cadence: Cadence): Period[] {
  const each = cadenceInfo(cadence).each;
  if (cadence === "daily") {
    return CALENDAR.map((d, i) => periodOf(i, [d], each));
  }
  if (cadence === "weekly") {
    const out: Period[] = [];
    for (let i = 0; i < CALENDAR.length; i += 7) {
      out.push(periodOf(out.length, CALENDAR.slice(i, i + 7), each));
    }
    return out;
  }
  const groups: CalDay[][] = [];
  for (const d of CALENDAR) {
    const g = groups[groups.length - 1];
    if (!g || g[0].hy !== d.hy || g[0].hm !== d.hm) groups.push([d]);
    else g.push(d);
  }
  return groups.map((days, i) => ({
    ...periodOf(i, days, each),
    hijri: `${days[0].monthName} ${days[0].hy}هـ`,
  }));
}

/** أول يوم وآخر يوم في السنة — تُعرض في ترويسة الخطة */
export const YEAR_START = CALENDAR[0];
export const YEAR_END = CALENDAR[CALENDAR.length - 1];

/** الأشهر مجمّعة للعرض في شبكة التقويم */
export function monthsOfYear(): { key: string; name: string; year: number; term: string; days: CalDay[] }[] {
  const out: { key: string; name: string; year: number; term: string; days: CalDay[] }[] = [];
  for (const d of CALENDAR) {
    const key = `${d.hy}-${d.hm}`;
    let m = out[out.length - 1];
    if (!m || m.key !== key) {
      m = { key, name: d.monthName, year: d.hy, term: d.term, days: [] };
      out.push(m);
    }
    m.days.push(d);
  }
  return out;
}

/** التاريخ الميلادي بصيغة مختصرة للعرض بجانب الهجري */
export function gregShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

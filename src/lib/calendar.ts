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

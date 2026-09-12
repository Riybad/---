import * as XLSX from "xlsx";
import { CALENDAR, cadenceInfo, EVENT_LABEL } from "./calendar";
import type { Cadence } from "./calendar";
import {
  buildSchedule,
  explTotal,
  memoTotal,
  memoUnit,
  periodCount,
  portionText,
  spanOf,
  type Course,
  type Pick,
} from "./plan";
import { trackInfo } from "./tracks";
import type { Student } from "./db";

type Sheet = XLSX.WorkSheet;

function sheet(rows: (string | number)[][], widths: number[]): Sheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  return ws;
}

/** ورقة «الخطة الزمنية» — كل أيام السنة وأحداثها كما في الملف الأصلي */
function calendarSheet(): Sheet {
  const rows: (string | number)[][] = [
    ["التاريخ الهجري", "اليوم", "التاريخ الميلادي", "الفصل", "النشاط"],
  ];
  for (const d of CALENDAR) {
    rows.push([d.hijri, d.weekday, d.gregorian, d.term, EVENT_LABEL[d.event]]);
  }
  return sheet(rows, [20, 12, 14, 14, 20]);
}

/** ورقة خطة طالب واحد: صف لكل فترة ومقرر */
function planRows(courses: Course[], picks: Pick[], cadence: Cadence): (string | number)[][] {
  const info = cadenceInfo(cadence);
  const rows: (string | number)[][] = [
    [
      info.each,
      "التاريخ الهجري",
      "من (ميلادي)",
      "إلى (ميلادي)",
      "المقرر",
      "الحفظ",
      "الشرح / القراءة",
      "المسار الثاني",
      "وحدة الحفظ",
      "وحدة المسار الثاني",
      "أحداث الفترة",
    ],
  ];
  for (const r of buildSchedule(courses, picks, cadence)) {
    for (const p of r.portions) {
      rows.push([
        r.no,
        r.period.hijri,
        r.period.first.gregorian,
        r.period.last.gregorian,
        p.course.name,
        portionText(p.memoFrom, p.memoTo),
        portionText(p.explFrom, p.explTo),
        p.course.expl_label,
        p.course.has_memo ? memoUnit(p.course) : "—",
        p.course.has_expl ? p.course.unit : "—",
        r.period.events.map((e) => EVENT_LABEL[e]).join("، "),
      ]);
    }
  }
  return rows;
}

const PLAN_WIDTHS = [8, 26, 14, 14, 26, 14, 16, 14, 12, 14, 24];

/* ————— المسار بلا جدول زمني: قائمة مقررات تُنجَز ————— */

const CHECKLIST_HEAD = [
  "الفرع",
  "المقرر",
  "النوع",
  "معيار الضبط",
  "حجم الحفظ",
  "وحدة الحفظ",
  "حجم القراءة",
  "وحدة القراءة",
  "الحالة",
];
const CHECKLIST_WIDTHS = [18, 34, 12, 14, 12, 12, 12, 12, 14];

function checklistRow(c: Course, done: boolean): (string | number)[] {
  return [
    c.subject || "—",
    c.name,
    c.kind || "—",
    c.mastery || "—",
    memoTotal(c) || "—",
    c.has_memo ? memoUnit(c) : "—",
    explTotal(c) || "—",
    c.has_expl ? c.unit : "—",
    done ? "أنهاه" : "لم ينهه بعد",
  ];
}

/** ملف طالب في مسار بلا جدول زمني: بياناته ومقرراته وما أنجزه */
export function checklistWorkbook(
  student: Student,
  courses: Course[],
  done: Set<number>
): Buffer {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };

  const rows: (string | number)[][] = [
    ["الطالب", student.name],
    ["المسار", trackInfo(student.track).name],
    ["الجوال", student.phone || "—"],
    ["ملاحظات", student.notes || "—"],
    ["المنجَز", `${courses.filter((c) => done.has(c.id)).length} من ${courses.length}`],
    [],
    CHECKLIST_HEAD,
  ];
  for (const c of courses) rows.push(checklistRow(c, done.has(c.id)));

  XLSX.utils.book_append_sheet(wb, sheet(rows, CHECKLIST_WIDTHS), "المقررات والإنجاز");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** ملف طلاب مسار بلا جدول زمني: من أنهى ماذا */
export function trackChecklistWorkbook(
  entries: { student: Student; done: Set<number> }[],
  courses: Course[]
): Buffer {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };

  // ورقة الطلاب: عمود لكل مقرر ✓ أو —
  const board: (string | number)[][] = [
    ["م", "الطالب", "الجوال", "المنجَز", ...courses.map((c) => c.name), "ملاحظات"],
  ];
  entries.forEach(({ student, done }, i) => {
    board.push([
      i + 1,
      student.name,
      student.phone || "—",
      `${courses.filter((c) => done.has(c.id)).length} من ${courses.length}`,
      ...courses.map((c) => (done.has(c.id) ? "✓" : "—")),
      student.notes || "",
    ]);
  });

  // ورقة تفصيلية: صف لكل طالب ومقرر
  const detail: (string | number)[][] = [["الطالب", ...CHECKLIST_HEAD]];
  for (const { student, done } of entries) {
    for (const c of courses) detail.push([student.name, ...checklistRow(c, done.has(c.id))]);
  }

  const courseSheet: (string | number)[][] = [CHECKLIST_HEAD.slice(0, -1)];
  for (const c of courses) courseSheet.push(checklistRow(c, false).slice(0, -1));

  XLSX.utils.book_append_sheet(
    wb,
    sheet(board, [6, 26, 14, 12, ...courses.map(() => 16), 30]),
    "الإنجاز"
  );
  XLSX.utils.book_append_sheet(wb, sheet(detail, [26, ...CHECKLIST_WIDTHS]), "تفصيل الإنجاز");
  XLSX.utils.book_append_sheet(wb, sheet(courseSheet, CHECKLIST_WIDTHS.slice(0, -1)), "المقررات");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** ملف خطة طالب واحد */
export function studentWorkbook(student: Student, courses: Course[], picks: Pick[]): Buffer {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const cadence = (student.cadence || "weekly") as Cadence;
  const info = cadenceInfo(cadence);

  const head: (string | number)[][] = [
    ["الطالب", student.name],
    ["المسار", trackInfo(student.track).name],
    ["الجوال", student.phone || "—"],
    ["ملاحظات", student.notes || "—"],
    ["وحدة التقسيم", info.label],
    ["المنجَز", `${picks.filter((p) => p.done).length} من ${picks.length}`],
    [`عدد ${info.plural} في السنة`, periodCount(cadence)],
    [],
    [
      "المقرر",
      "الفن",
      "النوع",
      "معيار الضبط",
      "وحدة الحفظ",
      "حجم الحفظ",
      `حفظ ${info.per}`,
      "المسار الثاني",
      "حجمه",
      `المقدار ${info.per}`,
      `عدد ${info.plural}`,
      "من",
      "إلى",
      "الحالة",
    ],
  ];
  for (const p of picks) {
    const course = courses.find((c) => c.id === p.courseId);
    if (!course) continue;
    const span = spanOf(course, p, cadence);
    head.push([
      course.name,
      course.subject,
      course.kind || "—",
      course.mastery || "—",
      course.has_memo ? memoUnit(course) : "—",
      memoTotal(course) || "—",
      p.memoPer || "—",
      course.has_expl ? course.expl_label : "—",
      explTotal(course) || "—",
      p.explPer || "—",
      span.count,
      span.startPeriod?.first.hijri ?? "—",
      span.endPeriod?.last.hijri ?? "—",
      p.done ? "أنهاه" : "لم ينهه بعد",
    ]);
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheet(head, [30, 12, 12, 12, 12, 12, 14, 12, 10, 14, 12, 22, 22, 14]),
    "ملخص الخطة"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(planRows(courses, picks, cadence), PLAN_WIDTHS),
    "جدول الخطة"
  );
  XLSX.utils.book_append_sheet(wb, calendarSheet(), "الخطة الزمنية");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** ملف كل الطلاب: ملخص + كل صفوف الخطط في ورقة واحدة */
export function allStudentsWorkbook(
  entries: { student: Student; picks: Pick[] }[],
  courses: Course[]
): Buffer {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };

  const summary: (string | number)[][] = [
    [
      "م",
      "الطالب",
      "المسار",
      "الجوال",
      "وحدة التقسيم",
      "عدد المقررات",
      "المنجَز",
      "الفترات المشغولة",
      "تاريخ التسجيل",
      "ملاحظات",
    ],
  ];
  const detail: (string | number)[][] = [
    [
      "الطالب",
      "المسار",
      "وحدة التقسيم",
      "رقم الفترة",
      "التاريخ الهجري",
      "من (ميلادي)",
      "إلى (ميلادي)",
      "المقرر",
      "الحفظ",
      "الشرح / القراءة",
      "المسار الثاني",
      "وحدة الحفظ",
      "وحدة المسار الثاني",
    ],
  ];

  entries.forEach(({ student, picks }, i) => {
    const cadence = (student.cadence || "weekly") as Cadence;
    const info = cadenceInfo(cadence);
    const schedule = buildSchedule(courses, picks, cadence);
    summary.push([
      i + 1,
      student.name,
      trackInfo(student.track).name,
      student.phone || "—",
      info.label,
      picks.length,
      `${picks.filter((x) => x.done).length} من ${picks.length}`,
      schedule.filter((r) => r.portions.length > 0).length,
      new Date(student.created_at).toISOString().slice(0, 10),
      student.notes || "",
    ]);
    for (const r of schedule) {
      for (const p of r.portions) {
        detail.push([
          student.name,
          trackInfo(student.track).name,
          info.label,
          r.no,
          r.period.hijri,
          r.period.first.gregorian,
          r.period.last.gregorian,
          p.course.name,
          portionText(p.memoFrom, p.memoTo),
          portionText(p.explFrom, p.explTo),
          p.course.expl_label,
          p.course.has_memo ? memoUnit(p.course) : "—",
          p.course.has_expl ? p.course.unit : "—",
        ]);
      }
    }
  });

  const coursesSheet: (string | number)[][] = [
    [
      "المقرر",
      "المسار",
      "الفن",
      "النوع",
      "معيار الضبط",
      "حجم الحفظ",
      "وحدة الحفظ",
      "المسار الثاني",
      "حجمه",
      "وحدته",
      "الحالة",
    ],
  ];
  for (const c of courses) {
    coursesSheet.push([
      c.name,
      trackInfo(c.track).name,
      c.subject,
      c.kind || "—",
      c.mastery || "—",
      memoTotal(c) || "—",
      c.has_memo ? memoUnit(c) : "—",
      c.has_expl ? c.expl_label : "—",
      explTotal(c) || "—",
      c.has_expl ? c.unit : "—",
      c.active ? "مفعّل" : "موقوف",
    ]);
  }

  XLSX.utils.book_append_sheet(wb, sheet(summary, [6, 26, 18, 14, 14, 12, 12, 16, 14, 30]), "الطلاب");
  XLSX.utils.book_append_sheet(
    wb,
    sheet(detail, [24, 18, 12, 10, 26, 14, 14, 30, 14, 16, 14, 12, 14]),
    "تفاصيل الخطط"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(coursesSheet, [30, 18, 14, 12, 12, 12, 12, 14, 10, 12, 12]),
    "المقررات"
  );
  XLSX.utils.book_append_sheet(wb, calendarSheet(), "الخطة الزمنية");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

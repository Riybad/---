import * as XLSX from "xlsx";
import { CALENDAR, cadenceInfo, EVENT_LABEL } from "./calendar";
import type { Cadence } from "./calendar";
import {
  buildSchedule,
  explTotal,
  memoTotal,
  periodCount,
  portionText,
  spanOf,
  type Course,
  type Pick,
} from "./plan";
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
      "الوحدة",
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
        p.course.unit,
        r.period.events.map((e) => EVENT_LABEL[e]).join("، "),
      ]);
    }
  }
  return rows;
}

const PLAN_WIDTHS = [8, 26, 14, 14, 26, 14, 16, 14, 10, 24];

/** ملف خطة طالب واحد */
export function studentWorkbook(student: Student, courses: Course[], picks: Pick[]): Buffer {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const cadence = (student.cadence || "weekly") as Cadence;
  const info = cadenceInfo(cadence);

  const head: (string | number)[][] = [
    ["الطالب", student.name],
    ["الجوال", student.phone || "—"],
    ["ملاحظات", student.notes || "—"],
    ["وحدة التقسيم", info.label],
    [`عدد ${info.plural} في السنة`, periodCount(cadence)],
    [],
    [
      "المقرر",
      "الفن",
      "الوحدة",
      "حجم الحفظ",
      `حفظ ${info.per}`,
      "المسار الثاني",
      "حجمه",
      `المقدار ${info.per}`,
      `عدد ${info.plural}`,
      "من",
      "إلى",
    ],
  ];
  for (const p of picks) {
    const course = courses.find((c) => c.id === p.courseId);
    if (!course) continue;
    const span = spanOf(course, p, cadence);
    head.push([
      course.name,
      course.subject,
      course.unit,
      memoTotal(course) || "—",
      p.memoPer || "—",
      course.has_expl ? course.expl_label : "—",
      explTotal(course) || "—",
      p.explPer || "—",
      span.count,
      span.startPeriod?.first.hijri ?? "—",
      span.endPeriod?.last.hijri ?? "—",
    ]);
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheet(head, [24, 12, 10, 12, 12, 14, 10, 14, 14, 22, 22]),
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
      "الجوال",
      "وحدة التقسيم",
      "عدد المقررات",
      "الفترات المشغولة",
      "تاريخ التسجيل",
      "ملاحظات",
    ],
  ];
  const detail: (string | number)[][] = [
    [
      "الطالب",
      "وحدة التقسيم",
      "رقم الفترة",
      "التاريخ الهجري",
      "من (ميلادي)",
      "إلى (ميلادي)",
      "المقرر",
      "الحفظ",
      "الشرح / القراءة",
      "المسار الثاني",
      "الوحدة",
    ],
  ];

  entries.forEach(({ student, picks }, i) => {
    const cadence = (student.cadence || "weekly") as Cadence;
    const info = cadenceInfo(cadence);
    const schedule = buildSchedule(courses, picks, cadence);
    summary.push([
      i + 1,
      student.name,
      student.phone || "—",
      info.label,
      picks.length,
      schedule.filter((r) => r.portions.length > 0).length,
      new Date(student.created_at).toISOString().slice(0, 10),
      student.notes || "",
    ]);
    for (const r of schedule) {
      for (const p of r.portions) {
        detail.push([
          student.name,
          info.label,
          r.no,
          r.period.hijri,
          r.period.first.gregorian,
          r.period.last.gregorian,
          p.course.name,
          portionText(p.memoFrom, p.memoTo),
          portionText(p.explFrom, p.explTo),
          p.course.expl_label,
          p.course.unit,
        ]);
      }
    }
  });

  const coursesSheet: (string | number)[][] = [
    [
      "المقرر",
      "الفن",
      "الوحدة",
      "حجم الحفظ",
      "المسار الثاني",
      "حجمه",
      "الحالة",
    ],
  ];
  for (const c of courses) {
    coursesSheet.push([
      c.name,
      c.subject,
      c.unit,
      memoTotal(c) || "—",
      c.has_expl ? c.expl_label : "—",
      explTotal(c) || "—",
      c.active ? "مفعّل" : "موقوف",
    ]);
  }

  XLSX.utils.book_append_sheet(wb, sheet(summary, [6, 26, 14, 14, 12, 16, 14, 30]), "الطلاب");
  XLSX.utils.book_append_sheet(
    wb,
    sheet(detail, [24, 12, 10, 26, 14, 14, 26, 14, 16, 14, 10]),
    "تفاصيل الخطط"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(coursesSheet, [26, 14, 10, 12, 14, 10, 12]),
    "المقررات"
  );
  XLSX.utils.book_append_sheet(wb, calendarSheet(), "الخطة الزمنية");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

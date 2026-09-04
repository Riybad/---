import * as XLSX from "xlsx";
import { CALENDAR, EVENT_LABEL, SESSIONS } from "./calendar";
import {
  buildSchedule,
  explTotal,
  memoTotal,
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

/** ورقة خطة طالب واحد: صف لكل لقاء ومقرر */
function planRows(courses: Course[], picks: Pick[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      "اللقاء",
      "التاريخ الهجري",
      "اليوم",
      "التاريخ الميلادي",
      "المقرر",
      "الحفظ",
      "الشرح / القراءة",
      "المسار الثاني",
      "الوحدة",
    ],
  ];
  for (const r of buildSchedule(courses, picks)) {
    for (const p of r.portions) {
      rows.push([
        r.no,
        r.session.hijri,
        r.session.weekday,
        r.session.gregorian,
        p.course.name,
        portionText(p.memoFrom, p.memoTo),
        portionText(p.explFrom, p.explTo),
        p.course.expl_label,
        p.course.unit,
      ]);
    }
  }
  return rows;
}

const PLAN_WIDTHS = [8, 22, 12, 14, 26, 14, 16, 14, 10];

/** ملف خطة طالب واحد */
export function studentWorkbook(student: Student, courses: Course[], picks: Pick[]): Buffer {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };

  const head: (string | number)[][] = [
    ["الطالب", student.name],
    ["الجوال", student.phone || "—"],
    ["المرحلة", student.stage || "—"],
    ["ملاحظات", student.notes || "—"],
    ["عدد لقاءات السنة", SESSIONS.length],
    [],
    [
      "المقرر",
      "الفن",
      "الوحدة",
      "حجم الحفظ",
      "حفظ/لقاء",
      "المسار الثاني",
      "حجمه",
      "المقدار/لقاء",
      "عدد اللقاءات",
      "من",
      "إلى",
    ],
  ];
  for (const p of picks) {
    const course = courses.find((c) => c.id === p.courseId);
    if (!course) continue;
    const span = spanOf(course, p);
    head.push([
      course.name,
      course.subject,
      course.unit,
      memoTotal(course) || "—",
      p.memoPer || "—",
      course.has_expl ? course.expl_label : "—",
      explTotal(course) || "—",
      p.explPer || "—",
      span.sessions,
      span.startDay?.hijri ?? "—",
      span.endDay?.hijri ?? "—",
    ]);
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheet(head, [24, 12, 10, 12, 12, 14, 10, 14, 14, 22, 22]),
    "ملخص الخطة"
  );
  XLSX.utils.book_append_sheet(wb, sheet(planRows(courses, picks), PLAN_WIDTHS), "جدول اللقاءات");
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
    ["م", "الطالب", "الجوال", "المرحلة", "عدد المقررات", "اللقاءات المشغولة", "تاريخ التسجيل", "ملاحظات"],
  ];
  const detail: (string | number)[][] = [
    [
      "الطالب",
      "اللقاء",
      "التاريخ الهجري",
      "اليوم",
      "التاريخ الميلادي",
      "المقرر",
      "الحفظ",
      "الشرح / القراءة",
      "المسار الثاني",
      "الوحدة",
    ],
  ];

  entries.forEach(({ student, picks }, i) => {
    const schedule = buildSchedule(courses, picks);
    summary.push([
      i + 1,
      student.name,
      student.phone || "—",
      student.stage || "—",
      picks.length,
      schedule.filter((r) => r.portions.length > 0).length,
      new Date(student.created_at).toISOString().slice(0, 10),
      student.notes || "",
    ]);
    for (const r of schedule) {
      for (const p of r.portions) {
        detail.push([
          student.name,
          r.no,
          r.session.hijri,
          r.session.weekday,
          r.session.gregorian,
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
    ["المقرر", "الفن", "الوحدة", "حجم الحفظ", "المسار الثاني", "حجمه", "الحالة"],
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
    sheet(detail, [24, 8, 22, 12, 14, 26, 14, 16, 14, 10]),
    "تفاصيل الخطط"
  );
  XLSX.utils.book_append_sheet(wb, sheet(coursesSheet, [26, 14, 10, 12, 14, 10, 12]), "المقررات");
  XLSX.utils.book_append_sheet(wb, calendarSheet(), "الخطة الزمنية");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

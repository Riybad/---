import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { CALENDAR, periodsOf } from "./calendar";
import type { Cadence } from "./calendar";
import { buildSchedule, portionText, type Course, type Pick } from "./plan";
import type { Student } from "./db";

export const TEMPLATE_PATH = path.join(process.cwd(), "docs", "الخطة-الزمنية.xlsx");

/**
 * كتل الأشهر في القالب: صف أرقام الأيام، ويليه صفّان فارغان —
 * الأول للحفظ والثاني للشرح/القراءة. الترتيب يطابق أشهر السنة في التقويم.
 */
const MONTH_ROWS = [18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54];

/** الصفوف 1..13 هي «إجمالي الموازنة المالية» و«المعطيات» — تُحذف من المخرج */
const TOP_ROWS_TO_DELETE = 13;

const FIRST_COL = 9; // I
const LAST_COL = 44; // AR
const LABEL_COL = 7; // G — مدموج مع H

/** خلايا الأيام في كتلة شهر: العمود ورقم اليوم، مقروءة من صف التواريخ نفسه */
function dayCells(ws: ExcelJS.Worksheet, row: number): { col: number; day: number }[] {
  const cols: number[] = [];
  for (let c = FIRST_COL; c <= LAST_COL; c++) {
    if (ws.getRow(row).getCell(c).value != null) cols.push(c);
  }
  if (cols.length === 0) return [];
  const first = Number(ws.getRow(row).getCell(cols[0]).value) || 1;
  return cols.map((col, i) => ({ col, day: first + i }));
}

type Cell = { text: string; course: string };

const WEEKEND_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9D9D9" },
};
const NO_FILL: ExcelJS.Fill = { type: "pattern", pattern: "none" };

/** أعمدة الشبكة تبدأ بالجمعة ثم السبت وتتكرر كل سبعة */
function isWeekend(col: number): boolean {
  return (col - FIRST_COL) % 7 < 2;
}

/**
 * توحيد الألوان: أيام الجمعة والسبت رمادية كما هي، وبقية الخلايا بيضاء —
 * تُزال شرائط الأحداث الملوّنة من صف التواريخ وصفّي التعبئة. وأرقام الأيام
 * التي كانت بخط أبيض فوق شريط داكن تُعاد إلى الخط الأسود حتى لا تختفي.
 */
function whitenMonth(ws: ExcelJS.Worksheet, row: number, cells: { col: number }[]) {
  for (const { col } of cells) {
    const day = ws.getCell(row, col);
    day.fill = isWeekend(col) ? WEEKEND_FILL : NO_FILL;
    const color = day.font?.color as { argb?: string; theme?: number } | undefined;
    if (color && (color.argb === "FFFFFFFF" || color.theme === 0)) {
      day.font = { ...day.font, color: { theme: 1 } };
    }
    ws.getCell(row + 1, col).fill = NO_FILL;
    ws.getCell(row + 2, col).fill = NO_FILL;
  }
}

/**
 * يحذف الصفوف العلوية (الموازنة المالية والمعطيات). spliceRows في ExcelJS
 * ينقل القيم والتنسيق لكنه يُسقط الدمج، فنسجّل الدمج ونفكّه ثم نعيده مُزاحًا.
 */
function deleteTopRows(ws: ExcelJS.Worksheet, count: number) {
  const all = Object.values(
    (ws as unknown as { _merges: Record<string, { model: ExcelJS.Location } | undefined> })._merges ?? {}
  )
    .map((m) => m?.model)
    .filter((m): m is ExcelJS.Location => !!m);
  for (const m of all) ws.unMergeCells(m.top, m.left, m.bottom, m.right);
  ws.spliceRows(1, count);
  for (const m of all) {
    if (m.top <= count) continue;
    ws.mergeCells(m.top - count, m.left, m.bottom - count, m.right);
  }
}

/**
 * صفوف التعبئة فيها دمج مسبق يرسم شرائط الأحداث (المبيت، العشر الأواخر،
 * الدورة المكثفة…). نفكّه لنتحكّم في الدمج، وننسخ تنسيق الخلية الأصلية
 * إلى كل خلايا النطاق حتى تبقى الشريطة ظاهرة كما هي.
 */
function unmergeFillRow(ws: ExcelJS.Worksheet, row: number) {
  const ranges = Object.values(
    (ws as unknown as { _merges: Record<string, { model: ExcelJS.Location } | undefined> })._merges ?? {}
  )
    .map((m) => m?.model)
    .filter(
      (m): m is ExcelJS.Location =>
        !!m && m.top === row && m.bottom === row && m.right >= FIRST_COL && m.left <= LAST_COL
    );

  for (const m of ranges) {
    const anchor = ws.getCell(m.top, m.left);
    const kept = { style: { ...anchor.style }, value: anchor.value };
    ws.unMergeCells(m.top, m.left, m.bottom, m.right);
    for (let c = m.left; c <= m.right; c++) {
      ws.getCell(row, c).style = { ...kept.style };
    }
    ws.getCell(m.top, m.left).value = kept.value;
  }
}

function style(cell: ExcelJS.Cell, color: string) {
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
  cell.font = { name: "Arial", size: 8, bold: true, color: { argb: color } };
  cell.fill = NO_FILL;
}

/**
 * يملأ قالب «الخطة الزمنية» بخطة طالب: لكل شهر يكتب في الصف الذي تحت التواريخ
 * ما يُحفظ، وفي الذي تحته ما يُشرح أو يُقرأ — ويدمج الخلايا المتتابعة لنفس الفترة.
 */
export async function templateWorkbook(
  student: Student,
  courses: Course[],
  picks: Pick[]
): Promise<Buffer> {
  const cadence = (student.cadence || "weekly") as Cadence;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.worksheets[0];
  ws.name = student.name.slice(0, 30) || "الخطة";

  // فهرس: رقم اليوم في السنة ← ما يُدرس فيه
  const periods = periodsOf(cadence);
  const rows = buildSchedule(courses, picks, cadence);
  const memoByDay = new Map<number, Cell>();
  const explByDay = new Map<number, Cell>();

  for (const r of rows) {
    // الطالب لا يدرس مقررين معًا، فالفترة فيها جزء واحد على الأكثر
    const p = r.portions[0];
    if (!p) continue;
    const period = periods[r.no - 1];
    for (let d = period.first.index; d <= period.last.index; d++) {
      if (p.memoTo) {
        memoByDay.set(d, { text: portionText(p.memoFrom, p.memoTo), course: p.course.name });
      }
      if (p.explTo) {
        explByDay.set(d, { text: portionText(p.explFrom, p.explTo), course: p.course.name });
      }
    }
  }

  // فهرس: (شهر، يوم) ← ترتيب اليوم في السنة
  const dayIndex = new Map<string, number>();
  CALENDAR.forEach((d) => dayIndex.set(`${d.hy}-${d.hm}-${d.hd}`, d.index));

  const monthsOfCalendar: { hy: number; hm: number }[] = [];
  for (const d of CALENDAR) {
    const last = monthsOfCalendar[monthsOfCalendar.length - 1];
    if (!last || last.hy !== d.hy || last.hm !== d.hm) monthsOfCalendar.push({ hy: d.hy, hm: d.hm });
  }

  MONTH_ROWS.forEach((row, mi) => {
    const month = monthsOfCalendar[mi];
    if (!month) return;
    const cells = dayCells(ws, row);
    if (cells.length === 0) return;

    unmergeFillRow(ws, row + 1);
    unmergeFillRow(ws, row + 2);
    whitenMonth(ws, row, cells);
    ws.getCell(row + 1, LABEL_COL).value = "الحفظ";
    ws.getCell(row + 2, LABEL_COL).value = "الشرح";
    // ارتفاع الصفوف ثابت في القالب (20.25) فلا يسع اسم المقرر فوق الأرقام
    ws.getRow(row + 1).height = 30;
    ws.getRow(row + 2).height = 30;

    for (const [offset, byDay] of [
      [1, memoByDay],
      [2, explByDay],
    ] as [number, Map<number, Cell>][]) {
      const target = row + offset;
      let lastCourse = "";
      let i = 0;
      while (i < cells.length) {
        const idx = dayIndex.get(`${month.hy}-${month.hm}-${cells[i].day}`);
        const entry = idx == null ? undefined : byDay.get(idx);
        if (!entry) {
          i++;
          continue;
        }
        // كل الأيام التي تحمل نفس المقدار تنتمي لفترة واحدة — تُدمج في خانة
        let j = i;
        while (j + 1 < cells.length) {
          const nextIdx = dayIndex.get(`${month.hy}-${month.hm}-${cells[j + 1].day}`);
          const next = nextIdx == null ? undefined : byDay.get(nextIdx);
          if (!next || next.text !== entry.text || next.course !== entry.course) break;
          j++;
        }
        // اسم المقرر يُكتب أول مرة في الشهر وكلما تغيّر المقرر
        const showName = entry.course !== lastCourse;
        lastCourse = entry.course;
        const cell = ws.getCell(target, cells[i].col);
        cell.value = showName ? `${entry.course}\n${entry.text}` : entry.text;
        style(cell, offset === 1 ? "FF4F6228" : "FF974806");
        if (j > i) {
          ws.mergeCells(target, cells[i].col, target, cells[j].col);
        }
        i = j + 1;
      }
    }
  });

  // أعلى الورقة (الموازنة المالية والمعطيات) يُحذف — تبقى الخطة الزمنية من عنوانها
  deleteTopRows(ws, TOP_ROWS_TO_DELETE);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function templateExists(): boolean {
  return fs.existsSync(TEMPLATE_PATH);
}

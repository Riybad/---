import { q, type Student, type PlanItem } from "./db";
import type { Course, Pick } from "./plan";

/* ————— المقررات وخطط الطلاب ————— */

export async function listCourses(includeInactive = false): Promise<Course[]> {
  const sql = includeInactive
    ? "SELECT * FROM courses ORDER BY sort_order, id"
    : "SELECT * FROM courses WHERE active ORDER BY sort_order, id";
  return (await q(sql)) as Course[];
}

export async function getCourse(id: number): Promise<Course | undefined> {
  const rows = await q("SELECT * FROM courses WHERE id = $1", [id]);
  return rows[0] as Course | undefined;
}

export async function listStudents(search?: string): Promise<Student[]> {
  if (search) {
    return (await q(
      "SELECT * FROM students WHERE name ILIKE $1 OR phone ILIKE $1 ORDER BY id DESC",
      [`%${search}%`]
    )) as Student[];
  }
  return (await q("SELECT * FROM students ORDER BY id DESC")) as Student[];
}

export async function getStudent(id: number): Promise<Student | undefined> {
  const rows = await q("SELECT * FROM students WHERE id = $1", [id]);
  return rows[0] as Student | undefined;
}

export async function getStudentByToken(token: string): Promise<Student | undefined> {
  const rows = await q("SELECT * FROM students WHERE token = $1", [token]);
  return rows[0] as Student | undefined;
}

export async function listPlanItems(studentId: number): Promise<PlanItem[]> {
  return (await q("SELECT * FROM plan_items WHERE student_id = $1 ORDER BY ord, id", [
    studentId,
  ])) as PlanItem[];
}

/** عدد المقررات في خطة كل طالب — لعرضه في قائمة الطلاب دون استعلام لكل صف */
export async function planCounts(): Promise<Map<number, number>> {
  const rows = (await q(
    "SELECT student_id, COUNT(*)::int AS n FROM plan_items GROUP BY student_id"
  )) as { student_id: number; n: number }[];
  return new Map(rows.map((r) => [r.student_id, r.n]));
}

export function toPicks(items: PlanItem[]): Pick[] {
  return items.map((i) => ({
    courseId: i.course_id,
    memoPer: i.memo_per,
    explPer: i.expl_per,
    start: i.start_session,
  }));
}

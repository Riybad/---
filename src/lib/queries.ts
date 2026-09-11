import { q, type Student, type PlanItem } from "./db";
import type { Course, Pick } from "./plan";
import type { TrackKey } from "./tracks";

/* ————— المقررات وخطط الطلاب ————— */

/**
 * مقررات مسار واحد أو المقررات كلها.
 * `track` غير محدّد يعني الكل — وهو ما تحتاجه التصديرات وحلّ مقررات
 * الخطط المحفوظة، فمقرر الطالب يُطلب بمعرّفه لا بمساره.
 */
export async function listCourses(
  includeInactive = false,
  track?: TrackKey
): Promise<Course[]> {
  const where = [includeInactive ? "" : "active", track ? "track = $1" : ""]
    .filter(Boolean)
    .join(" AND ");
  const sql = `SELECT * FROM courses${where ? ` WHERE ${where}` : ""} ORDER BY sort_order, id`;
  return (await q(sql, track ? [track] : [])) as Course[];
}

export async function getCourse(id: number): Promise<Course | undefined> {
  const rows = await q("SELECT * FROM courses WHERE id = $1", [id]);
  return rows[0] as Course | undefined;
}

export async function listStudents(search?: string, track?: TrackKey): Promise<Student[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length})`);
  }
  if (track) {
    params.push(track);
    where.push(`track = $${params.length}`);
  }
  const sql = `SELECT * FROM students${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC`;
  return (await q(sql, params)) as Student[];
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

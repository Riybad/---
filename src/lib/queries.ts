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

/** بنود خطط طلاب مسار كامل في استعلام واحد — مفتاحها معرّف الطالب */
export async function planItemsByTrack(track?: TrackKey): Promise<Map<number, PlanItem[]>> {
  const rows = (await q(
    `SELECT pi.* FROM plan_items pi
       JOIN students s ON s.id = pi.student_id
      ${track ? "WHERE s.track = $1" : ""}
      ORDER BY pi.student_id, pi.ord, pi.id`,
    track ? [track] : []
  )) as PlanItem[];
  const map = new Map<number, PlanItem[]>();
  for (const r of rows) {
    const list = map.get(r.student_id);
    if (list) list.push(r);
    else map.set(r.student_id, [r]);
  }
  return map;
}

/** إنجاز كل طالب: كم مقررًا أنهى من مقررات خطته */
export async function progressCounts(): Promise<Map<number, { done: number; total: number }>> {
  const rows = (await q(
    `SELECT student_id,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE done)::int AS done
       FROM plan_items GROUP BY student_id`
  )) as { student_id: number; total: number; done: number }[];
  return new Map(rows.map((r) => [r.student_id, { done: r.done, total: r.total }]));
}

export function toPicks(items: PlanItem[]): Pick[] {
  return items.map((i) => ({
    courseId: i.course_id,
    memoPer: i.memo_per,
    explPer: i.expl_per,
    start: i.start_session,
    done: i.done,
  }));
}

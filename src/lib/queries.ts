import { q, type Custody, type Invoice, type Transaction, type Student, type PlanItem } from "./db";
import type { Course, Pick } from "./plan";

export async function getTotals(): Promise<{ revenue: number; expense: number }> {
  const rows = await q(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount END), 0)::float8 AS revenue,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0)::float8 AS expense
    FROM transactions`
  );
  return rows[0] as { revenue: number; expense: number };
}

export async function getCustodyStats() {
  const rows = (await q(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float8 AS amount
     FROM custodies GROUP BY status`
  )) as { status: string; count: number; amount: number }[];
  const stat = (s: string) => rows.find((r) => r.status === s) ?? { count: 0, amount: 0 };
  return {
    pending: stat("pending"),
    open: stat("open"),
    pendingClose: stat("pending_close"),
    closed: stat("closed"),
  };
}

export async function listTransactions(limit?: number): Promise<Transaction[]> {
  if (limit) {
    return (await q("SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT $1", [
      limit,
    ])) as Transaction[];
  }
  return (await q("SELECT * FROM transactions ORDER BY date DESC, id DESC")) as Transaction[];
}

export async function listCustodies(status?: string, limit?: number): Promise<Custody[]> {
  let sql = "SELECT * FROM custodies";
  const params: (string | number)[] = [];
  if (status) {
    params.push(status);
    sql += ` WHERE status = $${params.length}`;
  }
  sql += " ORDER BY id DESC";
  if (limit) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  return (await q(sql, params)) as Custody[];
}

export async function getCustody(id: number): Promise<Custody | undefined> {
  const rows = await q("SELECT * FROM custodies WHERE id = $1", [id]);
  return rows[0] as Custody | undefined;
}

export async function getCustodyByCloseToken(token: string): Promise<Custody | undefined> {
  const rows = await q("SELECT * FROM custodies WHERE close_token = $1", [token]);
  return rows[0] as Custody | undefined;
}

export async function listInvoices(custodyId: number): Promise<Invoice[]> {
  return (await q("SELECT * FROM invoices WHERE custody_id = $1 ORDER BY id", [
    custodyId,
  ])) as Invoice[];
}

export async function getInvoice(id: number): Promise<Invoice | undefined> {
  const rows = await q("SELECT * FROM invoices WHERE id = $1", [id]);
  return rows[0] as Invoice | undefined;
}

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

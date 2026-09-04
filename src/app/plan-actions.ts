"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { newPlanToken, q } from "@/lib/db";
import { listCourses } from "@/lib/queries";
import { explTotal, memoTotal, periodCount, sessionsNeeded, UNITS } from "@/lib/plan";
import type { Cadence } from "@/lib/calendar";

/* ————— خطة الطالب (من الرابط العام) ————— */

type SubmittedPick = { courseId: number; memoPer: number; explPer: number; start: number };

const CADENCES: Cadence[] = ["daily", "weekly", "monthly"];

function parseCadence(raw: string): Cadence {
  return (CADENCES as string[]).includes(raw) ? (raw as Cadence) : "weekly";
}

function parsePicks(raw: string, total: number): SubmittedPick[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const int = (v: unknown) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? n : 0;
  };
  return parsed
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return {
        courseId: int(o.courseId),
        memoPer: Math.max(0, int(o.memoPer)),
        explPer: Math.max(0, int(o.explPer)),
        start: Math.min(Math.max(0, int(o.start)), total - 1),
      };
    })
    .filter((p) => p.courseId > 0 && (p.memoPer > 0 || p.explPer > 0));
}

/**
 * يحفظ خطة الطالب. تُعاد التحقّقات كلها هنا لأن الحسابات في المتصفح
 * قابلة للتلاعب — لا نثق إلا بالمقررات القادمة من قاعدة البيانات.
 */
export async function savePlan(_prev: string | null, formData: FormData): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const stage = String(formData.get("stage") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (name.length < 3) return "فضلًا اكتب الاسم كاملًا";
  if (phone && !/^[0-9+\s-]{8,20}$/.test(phone)) return "رقم الجوال غير صحيح";

  const cadence = parseCadence(String(formData.get("cadence") ?? "weekly"));
  const total = periodCount(cadence);
  const picks = parsePicks(String(formData.get("picks") ?? "[]"), total);
  if (picks.length === 0) return "لم تختر أي مقرر — ارجع واختر مقررًا واحدًا على الأقل";

  const courses = await listCourses();
  const byId = new Map(courses.map((c) => [c.id, c]));
  const seen = new Set<number>();

  for (const p of picks) {
    const course = byId.get(p.courseId);
    if (!course) return "أحد المقررات لم يعد متاحًا — حدّث الصفحة وأعد التقسيم";
    if (seen.has(p.courseId)) return `المقرر «${course.name}» مكرر في الخطة`;
    seen.add(p.courseId);
    if (!course.has_memo && p.memoPer > 0) return `المقرر «${course.name}» ليس فيه حفظ`;
    if (!course.has_expl && p.explPer > 0) {
      return `المقرر «${course.name}» ليس فيه ${course.expl_label}`;
    }
    if (p.memoPer > memoTotal(course)) {
      return `مقدار الحفظ في «${course.name}» أكبر من المقرر كاملًا`;
    }
    if (p.explPer > explTotal(course)) {
      return `مقدار ال${course.expl_label} في «${course.name}» أكبر من المقرر كاملًا`;
    }
    const needed = sessionsNeeded(course, p.memoPer, p.explPer);
    if (p.start + needed > total) {
      return `«${course.name}» لا ينتهي قبل نهاية السنة — زد المقدار أو قدّم بدايته`;
    }
  }

  const token = newPlanToken();
  const rows = await q(
    `INSERT INTO students (name, phone, stage, notes, cadence, token)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [name, phone, stage, notes, cadence, token]
  );
  const studentId = rows[0].id as number;

  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    await q(
      `INSERT INTO plan_items (student_id, course_id, ord, memo_per, expl_per, start_session)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentId, p.courseId, i, p.memoPer, p.explPer, p.start]
    );
  }

  revalidatePath("/", "layout");
  redirect(`/khitta/${token}`);
}

/* ————— إدارة المقررات (اللوحة) ————— */

const EXPL_LABELS = ["شرح", "قراءة"];

export async function saveCourse(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const size = (key: string) => Math.max(0, Math.trunc(Number(formData.get(key) ?? 0)) || 0);
  const unit = String(formData.get("unit") ?? "صفحة");
  const explLabel = String(formData.get("expl_label") ?? "شرح");
  const memoTotalValue = size("memo_total");
  const explTotalValue = size("expl_total");
  // حجم صفر يعني «بلا هذا المسار»، ولا بد أن يبقى مسار واحد على الأقل
  if (memoTotalValue === 0 && explTotalValue === 0) return;

  const params = [
    name,
    String(formData.get("subject") ?? "").trim(),
    UNITS.includes(unit) ? unit : "صفحة",
    memoTotalValue,
    explTotalValue,
    EXPL_LABELS.includes(explLabel) ? explLabel : "شرح",
    memoTotalValue > 0,
    explTotalValue > 0,
  ];

  if (id > 0) {
    await q(
      `UPDATE courses SET name = $1, subject = $2, unit = $3, memo_total = $4, expl_total = $5,
         expl_label = $6, has_memo = $7, has_expl = $8
       WHERE id = $9`,
      [...params, id]
    );
  } else {
    const max = (await q("SELECT COALESCE(MAX(sort_order), -1)::int AS m FROM courses"))[0];
    await q(
      `INSERT INTO courses
         (name, subject, unit, memo_total, expl_total, expl_label, has_memo, has_expl, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [...params, Number(max?.m ?? -1) + 1]
    );
  }
  revalidatePath("/", "layout");
}

export async function toggleCourse(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  if (id > 0) await q("UPDATE courses SET active = NOT active WHERE id = $1", [id]);
  revalidatePath("/", "layout");
}

/* ————— إدارة الطلاب (اللوحة) ————— */

export async function deleteStudent(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  if (id > 0) await q("DELETE FROM students WHERE id = $1", [id]);
  revalidatePath("/", "layout");
  redirect("/students");
}

export async function updateStudentNotes(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  if (id > 0) {
    await q("UPDATE students SET notes = $1, updated_at = now() WHERE id = $2", [notes, id]);
  }
  revalidatePath("/", "layout");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { newPlanToken, q } from "@/lib/db";
import { listCourses } from "@/lib/queries";
import { sessionsNeeded, UNITS, YEAR_SESSIONS } from "@/lib/plan";

/* ————— خطة الطالب (من الرابط العام) ————— */

type SubmittedPick = { courseId: number; memoPer: number; explPer: number; start: number };

function parsePicks(raw: string): SubmittedPick[] {
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
        start: Math.min(Math.max(0, int(o.start)), YEAR_SESSIONS - 1),
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

  const picks = parsePicks(String(formData.get("picks") ?? "[]"));
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
    if (!course.has_expl && p.explPer > 0) return `المقرر «${course.name}» ليس فيه شرح`;
    if (p.memoPer > course.total || p.explPer > course.total) {
      return `المقدار في «${course.name}» أكبر من حجم المقرر كاملًا`;
    }
    const needed = sessionsNeeded(course, p.memoPer, p.explPer);
    if (p.start + needed > YEAR_SESSIONS) {
      return `«${course.name}» لا ينتهي قبل آخر لقاء في السنة — زد المقدار أو قدّم بدايته`;
    }
  }

  const token = newPlanToken();
  const rows = await q(
    `INSERT INTO students (name, phone, stage, notes, token)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, phone, stage, notes, token]
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

export async function saveCourse(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const unit = String(formData.get("unit") ?? "صفحة");
  const total = Math.max(1, Math.trunc(Number(formData.get("total") ?? 1)) || 1);
  const hasMemo = formData.get("has_memo") === "on";
  const hasExpl = formData.get("has_expl") === "on";
  const params = [
    name,
    UNITS.includes(unit) ? unit : "صفحة",
    total,
    hasMemo || !hasExpl,
    hasExpl || !hasMemo,
  ];

  if (id > 0) {
    await q(
      `UPDATE courses SET name = $1, unit = $2, total = $3, has_memo = $4, has_expl = $5
       WHERE id = $6`,
      [...params, id]
    );
  } else {
    const max = (await q("SELECT COALESCE(MAX(sort_order), -1)::int AS m FROM courses"))[0];
    await q(
      `INSERT INTO courses (name, unit, total, has_memo, has_expl, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
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

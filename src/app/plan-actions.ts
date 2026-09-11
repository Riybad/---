"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { newPlanToken, q } from "@/lib/db";
import { listCourses, listPlanItems } from "@/lib/queries";
import {
  defaultWeeks,
  explTotal,
  memoTotal,
  periodCount,
  picksFromWeeks,
  sessionsNeeded,
  UNITS,
} from "@/lib/plan";
import type { Cadence } from "@/lib/calendar";
import { parseTrack, PUBLIC_TRACK, trackInfo, type TrackKey } from "@/lib/tracks";

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
 * يتحقّق من بنود الخطة ويعيد اشتقاق بداية كل مقرر من ترتيبه.
 * الحسابات في المتصفح قابلة للتلاعب، فلا نثق إلا بالمقررات من القاعدة.
 * يعيد نصّ خطأ، أو البنود جاهزة للحفظ.
 */
async function validatePlan(
  picks: SubmittedPick[],
  cadence: Cadence,
  track: TrackKey,
  { requireAll = true }: { requireAll?: boolean } = {}
): Promise<string | SubmittedPick[]> {
  if (picks.length === 0) return "لم تختر أي مقرر — اختر مقررًا واحدًا على الأقل";

  const total = periodCount(cadence);
  // خطة الطالب لا تُبنى إلا من مقررات مساره
  const courses = await listCourses(false, track);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const seen = new Set<number>();

  if (requireAll) {
    const missing = courses.filter((c) => !picks.some((p) => p.courseId === c.id));
    if (missing.length > 0) {
      return `الخطة ناقصة — لم تقسّم: ${missing.map((c) => c.name).join("، ")}`;
    }
  }

  // الطالب لا يدرس مقررين في وقت واحد: البداية تُشتقّ من الترتيب
  let cursor = 0;
  for (const p of picks) {
    const course = byId.get(p.courseId);
    if (!course) {
      return `أحد المقررات ليس من مقررات ${trackInfo(track).name} أو لم يعد متاحًا — حدّث الصفحة وأعد التقسيم`;
    }
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
    p.start = cursor;
    cursor += sessionsNeeded(course, p.memoPer, p.explPer);
    if (cursor > total) {
      return `«${course.name}» لا ينتهي قبل نهاية السنة — زد المقدار أو احذف مقررًا`;
    }
  }
  return picks;
}

/**
 * يستبدل بنود خطة طالب دفعةً واحدة.
 * الإنجاز المسجّل يبقى مربوطًا بالمقرر نفسه، فتعديل المدد أو الترتيب
 * لا يمحو ما سجّله المشرف من إنهاء المقررات.
 */
async function replacePlanItems(studentId: number, picks: SubmittedPick[]): Promise<void> {
  const prev = (await q(
    "SELECT course_id, done_at FROM plan_items WHERE student_id = $1 AND done",
    [studentId]
  )) as { course_id: number; done_at: Date | null }[];
  const doneAt = new Map(prev.map((r) => [r.course_id, r.done_at]));

  await q("DELETE FROM plan_items WHERE student_id = $1", [studentId]);
  if (picks.length === 0) return;
  const values = picks
    .map((_, i) => {
      const b = 2 + i * 7;
      return `($1::int, $${b}::int, $${b + 1}::int, $${b + 2}::int, $${b + 3}::int, $${b + 4}::int, $${b + 5}::boolean, $${b + 6}::timestamptz)`;
    })
    .join(", ");
  await q(
    `INSERT INTO plan_items
       (student_id, course_id, ord, memo_per, expl_per, start_session, done, done_at)
     VALUES ${values}`,
    [
      studentId,
      ...picks.flatMap((p, i) => [
        p.courseId,
        i,
        p.memoPer,
        p.explPer,
        p.start,
        doneAt.has(p.courseId),
        doneAt.get(p.courseId) ?? null,
      ]),
    ]
  );
}

/**
 * يحفظ خطة الطالب. تُعاد التحقّقات كلها هنا لأن الحسابات في المتصفح
 * قابلة للتلاعب — لا نثق إلا بالمقررات القادمة من قاعدة البيانات.
 */
export async function savePlan(_prev: string | null, formData: FormData): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (name.length < 3) return "فضلًا اكتب الاسم كاملًا";
  if (phone && !/^[0-9+\s-]{8,20}$/.test(phone)) return "رقم الجوال غير صحيح";

  const cadence = parseCadence(String(formData.get("cadence") ?? "weekly"));
  const picks = parsePicks(String(formData.get("picks") ?? "[]"), periodCount(cadence));
  // الرابط العام يخدم المسار العام وحده
  const checked = await validatePlan(picks, cadence, PUBLIC_TRACK);
  if (typeof checked === "string") return checked;

  const token = newPlanToken();
  const rows = await q(
    `INSERT INTO students (name, phone, notes, cadence, track, token)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [name, phone, notes, cadence, PUBLIC_TRACK, token]
  );
  await replacePlanItems(rows[0].id as number, checked);

  revalidatePath("/", "layout");
  redirect(`/khitta/${token}`);
}

/**
 * يقسّم طالبٌ سجّله المشرفُ مسبقًا خطتَه من رابطه الخاص.
 * لا يُنشئ طالبًا جديدًا، ولا يقبل إلا خطةً واحدة: بعدها يعدّلها المشرف.
 */
export async function savePlanForToken(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const token = String(formData.get("token") ?? "").trim();
  const rows = await q("SELECT id, cadence, track FROM students WHERE token = $1", [token]);
  if (rows.length === 0) return "الرابط غير صحيح — راجع المشرف";
  const id = rows[0].id as number;

  const existing = await q("SELECT COUNT(*)::int AS n FROM plan_items WHERE student_id = $1", [id]);
  if (Number(existing[0]?.n ?? 0) > 0) return "خطتك محفوظة — راجع المشرف إن أردت تعديلها";

  const cadence = parseCadence(String(formData.get("cadence") ?? "weekly"));
  const track = parseTrack(rows[0].track);
  const picks = parsePicks(String(formData.get("picks") ?? "[]"), periodCount(cadence));
  const checked = await validatePlan(picks, cadence, track);
  if (typeof checked === "string") return checked;

  const notes = String(formData.get("notes") ?? "").trim();
  await q("UPDATE students SET cadence = $1, notes = $2, updated_at = now() WHERE id = $3", [
    cadence,
    notes,
    id,
  ]);
  await replacePlanItems(id, checked);

  revalidatePath("/", "layout");
  redirect(`/khitta/${token}`);
}

/* ————— الطلاب من اللوحة: إضافة وتعديل ————— */

/** يضيف طالبًا من اللوحة — بخطة جاهزة أو بلا خطة ليقسّمها بنفسه */
export async function createStudent(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (name.length < 3) return "فضلًا اكتب الاسم كاملًا";
  if (phone && !/^[0-9+\s-]{8,20}$/.test(phone)) return "رقم الجوال غير صحيح";

  const cadence = parseCadence(String(formData.get("cadence") ?? "weekly"));
  const track = parseTrack(formData.get("track"));
  const raw = String(formData.get("picks") ?? "[]");
  const picks = parsePicks(raw, periodCount(cadence));

  // «قسّم له الآن»: توزيع مبدئي على مقررات مساره يعدّله المشرف بعدها
  let checked: SubmittedPick[] = [];
  if (String(formData.get("mode") ?? "") === "plan" && picks.length === 0) {
    const trackCourses = await listCourses(false, track);
    picks.push(...picksFromWeeks(trackCourses, defaultWeeks(trackCourses, cadence), cadence));
  }
  // خطة فارغة مقصودة: يُنشأ الطالب ليقسّم له المشرف لاحقًا أو يقسّم هو من رابطه
  if (picks.length > 0) {
    const result = await validatePlan(picks, cadence, track, { requireAll: false });
    if (typeof result === "string") return result;
    checked = result;
  }

  const token = newPlanToken();
  const rows = await q(
    `INSERT INTO students (name, phone, notes, cadence, track, token)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [name, phone, notes, cadence, track, token]
  );
  await replacePlanItems(rows[0].id as number, checked);

  revalidatePath("/", "layout");
  redirect(`/students/${rows[0].id}`);
}

/** نتيجة إضافة دفعة أسماء */
export type BulkResult = {
  error?: string;
  added?: number;
  /** أسماء كانت مسجّلة في المسار فلم تُكرَّر */
  skipped?: string[];
} | null;

/** ينظّف سطرًا ملصوقًا: يزيل الترقيم والمسافات والجدولة الزائدة */
function cleanName(line: string): string {
  return line
    .replace(/^[\s\u200f\u200e]*(?:[-–—•*]|\d+[.)\-،]?)\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * يضيف قائمة أسماء دفعةً واحدة إلى مسار.
 * الاسم المسجَّل في المسار نفسه يُتخطّى، فإعادة اللصق لا تكرّر أحدًا.
 */
export async function createStudents(_prev: BulkResult, formData: FormData): Promise<BulkResult> {
  await requireAdmin();
  const track = parseTrack(formData.get("track"));
  const cadence = parseCadence(String(formData.get("cadence") ?? "weekly"));

  const lines = String(formData.get("names") ?? "")
    .split(/\r?\n/)
    .map(cleanName)
    .filter(Boolean);
  if (lines.length === 0) return { error: "الصق الأسماء أولًا — اسمًا في كل سطر" };

  const short = lines.find((n) => n.length < 3);
  if (short) return { error: `«${short}» اسم قصير — اكتبه كاملًا` };

  // تكرار داخل اللصقة نفسها، ثم تكرار مع المسجّلين في المسار
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const n of lines) {
    if (seen.has(n)) continue;
    seen.add(n);
    unique.push(n);
  }
  const existing = new Set(
    ((await q("SELECT name FROM students WHERE track = $1", [track])) as { name: string }[]).map(
      (r) => r.name
    )
  );
  const skipped = unique.filter((n) => existing.has(n));
  const fresh = unique.filter((n) => !existing.has(n));
  if (fresh.length === 0) {
    return { added: 0, skipped, error: "كل الأسماء مسجّلة في هذا المسار من قبل" };
  }

  // رمز خاص لكل طالب — هو رابط خطته
  const values = fresh
    .map((_, i) => `($${i * 4 + 1}::text, $${i * 4 + 2}::text, $${i * 4 + 3}::text, $${i * 4 + 4}::text)`)
    .join(", ");
  const inserted = (await q(
    `INSERT INTO students (name, cadence, track, token)
     VALUES ${values} RETURNING id`,
    fresh.flatMap((name) => [name, cadence, track, newPlanToken()])
  )) as { id: number }[];

  // «قسّم لهم الآن»: التوزيع نفسه للجميع، يعدّله المشرف لكل طالب بعدها
  if (String(formData.get("mode") ?? "") === "plan") {
    const courses = await listCourses(false, track);
    const picks = picksFromWeeks(courses, defaultWeeks(courses, cadence), cadence);
    if (picks.length > 0) {
      const rows = inserted.flatMap((st) =>
        picks.map((p, i) => [st.id, p.courseId, i, p.memoPer, p.explPer, p.start])
      );
      const planValues = rows
        .map((_, i) => {
          const b = i * 6;
          return `($${b + 1}::int, $${b + 2}::int, $${b + 3}::int, $${b + 4}::int, $${b + 5}::int, $${b + 6}::int)`;
        })
        .join(", ");
      await q(
        `INSERT INTO plan_items
           (student_id, course_id, ord, memo_per, expl_per, start_session)
         VALUES ${planValues}`,
        rows.flat()
      );
    }
  }

  revalidatePath("/", "layout");
  return { added: fresh.length, skipped };
}

/** يعدّل بيانات الطالب: الاسم والجوال والمسار ووحدة العرض والملاحظات */
export async function updateStudent(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (id <= 0) return "الطالب غير موجود";
  if (name.length < 3) return "فضلًا اكتب الاسم كاملًا";
  if (phone && !/^[0-9+\s-]{8,20}$/.test(phone)) return "رقم الجوال غير صحيح";

  const cadence = parseCadence(String(formData.get("cadence") ?? "weekly"));
  const track = parseTrack(formData.get("track"));
  const rows = await q("SELECT cadence, track FROM students WHERE id = $1", [id]);
  if (rows.length === 0) return "الطالب غير موجود";
  const oldCadence = ((rows[0].cadence as string) || "weekly") as Cadence;
  const oldTrack = parseTrack(rows[0].track);

  if (oldTrack !== track) {
    // مقررات المسارين مختلفة، فخطته القديمة لا تصلح للمسار الجديد
    await replacePlanItems(id, []);
  } else if (oldCadence !== cadence) {
    // تغيير وحدة العرض يغيّر عدد الفترات، فتُعاد الخطة إلى الحدود الجديدة
    const items = await listPlanItems(id);
    const courses = await listCourses(false, track);
    const byId = new Map(courses.map((c) => [c.id, c]));
    const oldTotal = periodCount(oldCadence);
    const newTotal = periodCount(cadence);
    const rescaled: SubmittedPick[] = [];
    for (const it of items) {
      const course = byId.get(it.course_id);
      if (!course) continue;
      // الفترات التي كان يشغلها المقرر تُحوَّل بنسبتها إلى الوحدة الجديدة
      const span = Math.max(1, sessionsNeeded(course, it.memo_per, it.expl_per));
      const n = Math.max(1, Math.round((span / oldTotal) * newTotal));
      rescaled.push({
        courseId: it.course_id,
        memoPer: course.has_memo ? Math.max(1, Math.ceil(memoTotal(course) / n)) : 0,
        explPer: course.has_expl ? Math.max(1, Math.ceil(explTotal(course) / n)) : 0,
        start: 0,
      });
    }
    if (rescaled.length > 0) {
      const checked = await validatePlan(rescaled, cadence, track, { requireAll: false });
      if (typeof checked === "string") {
        return `تعذّر تحويل الخطة إلى الوحدة الجديدة: ${checked}`;
      }
      await replacePlanItems(id, checked);
    }
  }

  await q(
    `UPDATE students SET name = $1, phone = $2, notes = $3, cadence = $4, track = $5,
       updated_at = now()
     WHERE id = $6`,
    [name, phone, notes, cadence, track, id]
  );
  revalidatePath("/", "layout");
  return null;
}

/** يستبدل خطة طالب قائم بما عدّله المشرف */
export async function updatePlan(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  if (id <= 0) return "الطالب غير موجود";
  const rows = await q("SELECT cadence, track FROM students WHERE id = $1", [id]);
  if (rows.length === 0) return "الطالب غير موجود";

  const cadence = ((rows[0].cadence as string) || "weekly") as Cadence;
  const track = parseTrack(rows[0].track);
  const raw = String(formData.get("picks") ?? "[]");
  const picks = parsePicks(raw, periodCount(cadence));

  // خطة فارغة تعني حذف كل المقررات — تصرّف مقصود من المشرف
  if (picks.length === 0) {
    await replacePlanItems(id, []);
    revalidatePath("/", "layout");
    return null;
  }

  const checked = await validatePlan(picks, cadence, track, { requireAll: false });
  if (typeof checked === "string") return checked;

  await replacePlanItems(id, checked);
  revalidatePath("/", "layout");
  return null;
}

/* ————— إنجاز الطلاب: أنهى المقرر أو لا ————— */

/** يقرأ أزواج «طالب:مقرر» من حقل نموذج */
function parsePairs(values: string[]): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const [a, b] = String(v).split(":");
    const sid = Math.trunc(Number(a));
    const cid = Math.trunc(Number(b));
    if (sid > 0 && cid > 0 && !seen.has(`${sid}:${cid}`)) {
      seen.add(`${sid}:${cid}`);
      out.push([sid, cid]);
    }
  }
  return out;
}

/**
 * يحفظ إنجاز شاشة كاملة دفعةً واحدة.
 * «scope» كل المربّعات المعروضة، و«done» ما أشّر عليه المشرف — فما كان
 * في النطاق ولم يُؤشَّر يُرجَع غير منجَز. تاريخ الإنجاز يُحفظ أول مرة
 * ولا يتغيّر ما دام المقرر منجزًا.
 */
export async function saveProgress(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  await requireAdmin();
  const scope = parsePairs(String(formData.get("scope") ?? "").split(",").filter(Boolean));
  if (scope.length === 0) return null;
  const done = new Set(
    parsePairs(formData.getAll("done").map(String)).map(([s, c]) => `${s}:${c}`)
  );

  const values = scope
    .map((_, i) => `($${i * 3 + 1}::int, $${i * 3 + 2}::int, $${i * 3 + 3}::boolean)`)
    .join(", ");
  await q(
    `UPDATE plan_items AS p
        SET done = v.done,
            done_at = CASE WHEN v.done THEN COALESCE(p.done_at, now()) ELSE NULL END
       FROM (VALUES ${values}) AS v(sid, cid, done)
      WHERE p.student_id = v.sid AND p.course_id = v.cid
        AND p.done IS DISTINCT FROM v.done`,
    scope.flatMap(([sid, cid]) => [sid, cid, done.has(`${sid}:${cid}`)])
  );

  revalidatePath("/", "layout");
  return null;
}

/** يقلب إنجاز مقرر واحد لطالب واحد — من صفحة الطالب */
export async function toggleItemDone(formData: FormData): Promise<void> {
  await requireAdmin();
  const studentId = Number(formData.get("student_id") ?? 0);
  const courseId = Number(formData.get("course_id") ?? 0);
  if (studentId <= 0 || courseId <= 0) return;
  await q(
    `UPDATE plan_items
        SET done = NOT done,
            done_at = CASE WHEN done THEN NULL ELSE now() END
      WHERE student_id = $1 AND course_id = $2`,
    [studentId, courseId]
  );
  revalidatePath("/", "layout");
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

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  // الروابط تُقبل http/https فقط، وما عداه يُهمل
  const url = (key: string) => (/^https?:\/\//i.test(text(key)) ? text(key) : "");
  const params = [
    name,
    text("subject"),
    UNITS.includes(unit) ? unit : "صفحة",
    memoTotalValue,
    explTotalValue,
    EXPL_LABELS.includes(explLabel) ? explLabel : "شرح",
    memoTotalValue > 0,
    explTotalValue > 0,
    text("sharh_name"),
    url("sharh_book_url"),
    url("sharh_video_url"),
    parseTrack(formData.get("track")),
  ];

  if (id > 0) {
    await q(
      `UPDATE courses SET name = $1, subject = $2, unit = $3, memo_total = $4, expl_total = $5,
         expl_label = $6, has_memo = $7, has_expl = $8,
         sharh_name = $9, sharh_book_url = $10, sharh_video_url = $11, track = $12
       WHERE id = $13`,
      [...params, id]
    );
  } else {
    const max = (await q("SELECT COALESCE(MAX(sort_order), -1)::int AS m FROM courses"))[0];
    await q(
      `INSERT INTO courses
         (name, subject, unit, memo_total, expl_total, expl_label, has_memo, has_expl,
          sharh_name, sharh_book_url, sharh_video_url, track, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [...params, Number(max?.m ?? -1) + 1]
    );
  }
  revalidatePath("/", "layout");
}

/** يحذف مقررًا — ويُمنع إن كان في خطة طالب حتى لا تُمسح خطط محفوظة */
export async function deleteCourse(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  if (id <= 0) return;
  const used = await q("SELECT COUNT(*)::int AS n FROM plan_items WHERE course_id = $1", [id]);
  if (Number(used[0]?.n ?? 0) > 0) {
    // مستعمل في خطط — الإيقاف يخفيه عن الجدد ويُبقي الخطط سليمة
    await q("UPDATE courses SET active = FALSE WHERE id = $1", [id]);
  } else {
    await q("DELETE FROM courses WHERE id = $1", [id]);
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

import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import CopyButton from "@/components/CopyButton";
import PlanEditor from "@/components/PlanEditor";
import PlanTable, { CourseSummary } from "@/components/PlanTable";
import { EditStudentForm } from "@/components/StudentForm";
import { deleteStudent, toggleItemDone, updateStudentNotes } from "@/app/plan-actions";
import { buildSchedule, periodsLabel } from "@/lib/plan";
import { cadenceInfo } from "@/lib/calendar";
import type { Cadence } from "@/lib/calendar";
import { parseTrack, trackInfo } from "@/lib/tracks";
import { getStudent, listCourses, listPlanItems, toPicks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await getStudent(Number(id));
  if (!student) notFound();

  const track = parseTrack(student.track);
  const info2 = trackInfo(track);
  // الجدول يُحلّ من كل المقررات (قد تكون خطته فيها مقرر أُوقف)، والمحرّر من مقررات مساره
  const [allCourses, trackCourses, items] = await Promise.all([
    listCourses(true),
    listCourses(false, track),
    listPlanItems(student.id),
  ]);
  const picks = toPicks(items);
  const cadence = (student.cadence || "weekly") as Cadence;
  const info = cadenceInfo(cadence);
  const timeline = info2.timeline;
  const used = timeline
    ? buildSchedule(allCourses, picks, cadence).filter((r) => r.portions.length > 0).length
    : 0;

  /**
   * بلا جدول زمني: مقررات المسار كلها مطلوبة منه، فتُعرض كلها ولو لم
   * يُسجَّل له بند بعد. وبالجدول: لا يُعرض إلا ما في خطته.
   */
  const doneOf = new Map(items.map((i) => [i.course_id, i.done]));
  const checklist = timeline
    ? items.map((i) => ({
        course: allCourses.find((c) => c.id === i.course_id),
        done: i.done,
      }))
    : trackCourses.map((c) => ({ course: c, done: doneOf.get(c.id) ?? false }));
  const doneCount = checklist.filter((x) => x.done).length;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const planUrl = `${proto}://${host}/khitta/${student.token}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title text-xl">{student.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <span
              className="rounded-md px-2 py-0.5 text-xs font-bold"
              style={{ background: `${info2.color}1f`, color: info2.color }}
            >
              {info2.name}
            </span>
            {[student.stage, student.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          <a className="btn btn-primary text-sm" href={`/api/export/khitta/${student.token}`}>
            {timeline ? "تصدير على القالب" : "تصدير مقرراته"}
          </a>
          {timeline && (
            <a
              className="btn btn-ghost text-sm"
              href={`/api/export/khitta/${student.token}?format=table`}
            >
              جدول تفصيلي
            </a>
          )}
          <CopyButton
            text={planUrl}
            label={!timeline ? "نسخ رابط صفحته" : picks.length === 0 ? "نسخ رابط تقسيمه" : "نسخ رابط خطته"}
          />
          <Link className="btn btn-ghost text-sm" href="/students">
            رجوع
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="عدد المقررات" value={`${checklist.length}`} />
        <Stat
          label="المنجَز"
          value={checklist.length ? `${doneCount} من ${checklist.length}` : "—"}
        />
        {timeline ? (
          <Stat label={`${info.plural} المشغولة`} value={periodsLabel(used, cadence)} />
        ) : (
          <Stat label="طريقة المسار" value="بلا جدول زمني" />
        )}
      </div>

      {timeline && picks.length === 0 && trackCourses.length > 0 && (
        <div className="card p-5" style={{ borderInlineStart: `3px solid ${info2.color}` }}>
          <h2 className="font-bold">لا خطة له بعد</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            إمّا أن تقسّم له من <strong>«تعديل الخطة»</strong> بالأسفل، وإمّا أن ترسل له هذا
            الرابط ليقسّم بنفسه ثم تراجع خطته هنا:
          </p>
          <p
            className="mt-2 break-all rounded-lg px-3 py-2 text-sm num"
            style={{ background: "var(--surface-stripe)", color: "var(--text-secondary)" }}
          >
            {planUrl}
          </p>
        </div>
      )}

      <EditStudentForm student={student} />

      {!timeline ? null : trackCourses.length === 0 ? (
        <p className="card p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          لا مقررات في {info2.name} بعد — أضفها من{" "}
          <Link href="/courses" className="font-semibold underline">
            صفحة المقررات
          </Link>{" "}
          لتقسّم له خطته.
        </p>
      ) : (
        <PlanEditor
          key={`${student.id}-${cadence}-${track}-${picks.length}`}
          studentId={student.id}
          courses={trackCourses}
          picks={picks}
          cadence={cadence}
        />
      )}

      {checklist.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h2 className="font-bold">{timeline ? "إنجاز المقررات" : "مقررات المسار"}</h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              اضغط المقرر لتسجّل أنه أنهاه أو لم ينهه
            </span>
            <span className="ms-auto text-sm font-bold" style={{ color: info2.color }}>
              {doneCount} من {checklist.length}
              {doneCount === checklist.length && " ✓ أنهى الكل"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {checklist.map(({ course, done }) => {
              if (!course) return null;
              return (
                <form key={course.id} action={toggleItemDone}>
                  <input type="hidden" name="student_id" value={student.id} />
                  <input type="hidden" name="course_id" value={course.id} />
                  <button
                    className="rounded-xl border px-3 py-2 text-sm font-semibold transition"
                    style={{
                      borderColor: done ? info2.color : "var(--hairline)",
                      background: done ? `${info2.color}18` : "transparent",
                      color: done ? info2.color : "var(--text-secondary)",
                    }}
                    title={[course.subject, course.kind, course.mastery && `ضبطه: ${course.mastery}`]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    {done ? "✓" : "○"} {course.name}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      )}

      {timeline && picks.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-bold">مقررات الخطة</h2>
          <CourseSummary courses={allCourses} picks={picks} cadence={cadence} />
        </div>
      )}

      {timeline && (
        <div className="card">
          <h2 className="p-4 pb-0 font-bold">جدول الخطة</h2>
          <PlanTable courses={allCourses} picks={picks} cadence={cadence} />
        </div>
      )}

      <form action={updateStudentNotes} className="card grid gap-3 p-5">
        <input type="hidden" name="id" value={student.id} />
        <label className="label">ملاحظات المشرف</label>
        <textarea name="notes" className="input" rows={3} defaultValue={student.notes} />
        <button className="btn btn-ghost w-fit text-sm">حفظ الملاحظات</button>
      </form>

      <form action={deleteStudent} className="card flex flex-wrap items-center gap-3 p-5">
        <input type="hidden" name="id" value={student.id} />
        <div className="min-w-0">
          <div className="font-bold">حذف الطالب وخطته</div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            يمسح الطالب وكل ما سُجّل له ولا يمكن التراجع، ورابطه يتوقف عن العمل.
          </p>
        </div>
        <ConfirmButton
          message={`سيُحذف «${student.name}» وخطته كاملة نهائيًا.\n\nهل أنت متأكد؟`}
          className="btn btn-danger ms-auto text-sm"
        >
          حذف نهائيًا
        </ConfirmButton>
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

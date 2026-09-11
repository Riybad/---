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
  const used = buildSchedule(allCourses, picks, cadence).filter((r) => r.portions.length > 0).length;

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
            تصدير على القالب
          </a>
          <a
            className="btn btn-ghost text-sm"
            href={`/api/export/khitta/${student.token}?format=table`}
          >
            جدول تفصيلي
          </a>
          <CopyButton
            text={planUrl}
            label={picks.length === 0 ? "نسخ رابط تقسيمه" : "نسخ رابط خطته"}
          />
          <Link className="btn btn-ghost text-sm" href="/students">
            رجوع
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="عدد المقررات" value={`${picks.length}`} />
        <Stat
          label="المنجَز"
          value={items.length ? `${items.filter((i) => i.done).length} من ${items.length}` : "—"}
        />
        <Stat label={`${info.plural} المشغولة`} value={periodsLabel(used, cadence)} />
      </div>

      {picks.length === 0 && trackCourses.length > 0 && (
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

      {trackCourses.length === 0 ? (
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

      {items.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h2 className="font-bold">إنجاز المقررات</h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              اضغط المقرر لتسجّل أنه أنهاه أو لم ينهه
            </span>
            <span className="ms-auto text-sm font-bold" style={{ color: info2.color }}>
              {items.filter((i) => i.done).length} من {items.length}
              {items.every((i) => i.done) && " ✓ أنهى الكل"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((i) => {
              const course = allCourses.find((c) => c.id === i.course_id);
              if (!course) return null;
              return (
                <form key={i.id} action={toggleItemDone}>
                  <input type="hidden" name="student_id" value={student.id} />
                  <input type="hidden" name="course_id" value={i.course_id} />
                  <button
                    className="rounded-xl border px-3 py-2 text-sm font-semibold transition"
                    style={{
                      borderColor: i.done ? info2.color : "var(--hairline)",
                      background: i.done ? `${info2.color}18` : "transparent",
                      color: i.done ? info2.color : "var(--text-secondary)",
                    }}
                  >
                    {i.done ? "✓" : "○"} {course.name}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      )}

      {picks.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-bold">مقررات الخطة</h2>
          <CourseSummary courses={allCourses} picks={picks} cadence={cadence} />
        </div>
      )}

      <div className="card">
        <h2 className="p-4 pb-0 font-bold">جدول الخطة</h2>
        <PlanTable courses={allCourses} picks={picks} cadence={cadence} />
      </div>

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
            يمسح الطالب وخطته كاملة ولا يمكن التراجع. رابط خطته يتوقف عن العمل، وإن أراد خطة
            جديدة يسجّل من رابط التسجيل من جديد.
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

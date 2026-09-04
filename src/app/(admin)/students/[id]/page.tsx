import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import PlanTable, { CourseSummary } from "@/components/PlanTable";
import { deleteStudent, updateStudentNotes } from "@/app/plan-actions";
import { buildSchedule, periodsLabel } from "@/lib/plan";
import { cadenceInfo } from "@/lib/calendar";
import type { Cadence } from "@/lib/calendar";
import { getStudent, listCourses, listPlanItems, toPicks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await getStudent(Number(id));
  if (!student) notFound();

  const [courses, items] = await Promise.all([listCourses(true), listPlanItems(student.id)]);
  const picks = toPicks(items);
  const cadence = (student.cadence || "weekly") as Cadence;
  const info = cadenceInfo(cadence);
  const used = buildSchedule(courses, picks, cadence).filter((r) => r.portions.length > 0).length;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const planUrl = `${proto}://${host}/khitta/${student.token}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title text-xl">{student.name}</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {[student.stage, student.phone].filter(Boolean).join(" · ") || "بدون بيانات إضافية"}
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
          <CopyButton text={planUrl} label="نسخ رابط خطته" />
          <Link className="btn btn-ghost text-sm" href="/students">
            رجوع
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="عدد المقررات" value={`${picks.length}`} />
        <Stat label={`${info.plural} المشغولة`} value={periodsLabel(used, cadence)} />
        <Stat label="وحدة التقسيم" value={info.label} />
      </div>

      {picks.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-bold">مقررات الخطة</h2>
          <CourseSummary courses={courses} picks={picks} cadence={cadence} />
        </div>
      )}

      <div className="card">
        <h2 className="p-4 pb-0 font-bold">جدول الخطة</h2>
        <PlanTable courses={courses} picks={picks} cadence={cadence} />
      </div>

      <form action={updateStudentNotes} className="card grid gap-3 p-5">
        <input type="hidden" name="id" value={student.id} />
        <label className="label">ملاحظات المشرف</label>
        <textarea name="notes" className="input" rows={3} defaultValue={student.notes} />
        <button className="btn btn-ghost w-fit text-sm">حفظ الملاحظات</button>
      </form>

      <form action={deleteStudent} className="text-left">
        <input type="hidden" name="id" value={student.id} />
        <button className="btn btn-danger text-sm">حذف الطالب وخطته</button>
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

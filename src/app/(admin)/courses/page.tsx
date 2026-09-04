import { saveCourse, toggleCourse } from "@/app/plan-actions";
import { UNITS, unitLabel } from "@/lib/plan";
import { listCourses } from "@/lib/queries";
import type { Course } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listCourses(true);
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="page-title text-xl">المقررات</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          حجم المقرر ووحدته هما أساس التقسيم عند الطالب — عدّلها هنا وتنعكس على التسجيل الجديد.
        </p>
      </div>

      <div className="grid gap-3">
        {courses.map((c) => (
          <CourseRow key={c.id} course={c} />
        ))}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-bold">إضافة مقرر</h2>
        <CourseForm />
      </div>
    </div>
  );
}

function CourseRow({ course }: { course: Course }) {
  return (
    <div className="card p-4" style={{ opacity: course.active ? 1 : 0.55 }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-bold">{course.name}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {unitLabel(course.total, course.unit)} ·{" "}
          {course.has_memo && course.has_expl ? "حفظ وشرح" : course.has_memo ? "حفظ" : "شرح"}
        </span>
        {!course.active && <span className="badge badge-warning">موقوف</span>}
        <form action={toggleCourse} className="ms-auto">
          <input type="hidden" name="id" value={course.id} />
          <button className="btn btn-ghost text-xs">
            {course.active ? "إيقاف" : "تفعيل"}
          </button>
        </form>
      </div>
      <CourseForm course={course} />
    </div>
  );
}

function CourseForm({ course }: { course?: Course }) {
  return (
    <form action={saveCourse} className="grid gap-3 sm:grid-cols-5 sm:items-end">
      {course && <input type="hidden" name="id" value={course.id} />}
      <div className="sm:col-span-2">
        <label className="label">اسم المقرر</label>
        <input name="name" className="input" defaultValue={course?.name ?? ""} required />
      </div>
      <div>
        <label className="label">الوحدة</label>
        <select name="unit" className="input" defaultValue={course?.unit ?? "صفحة"}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">حجم المقرر</label>
        <input
          name="total"
          type="number"
          min={1}
          className="input num"
          defaultValue={course?.total ?? 100}
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm font-semibold">
          <input type="checkbox" name="has_memo" defaultChecked={course?.has_memo ?? true} />
          حفظ
        </label>
        <label className="flex items-center gap-1.5 text-sm font-semibold">
          <input type="checkbox" name="has_expl" defaultChecked={course?.has_expl ?? true} />
          شرح
        </label>
      </div>
      <div className="sm:col-span-5">
        <button className="btn btn-primary text-sm">{course ? "حفظ التعديل" : "أضف المقرر"}</button>
      </div>
    </form>
  );
}

import { saveCourse, toggleCourse } from "@/app/plan-actions";
import { explTotal, memoTotal, UNITS, unitLabel } from "@/lib/plan";
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
          لكل مقرر مساران بحجمين مستقلين: <strong>الحفظ</strong> و<strong>الشرح أو القراءة</strong>
          {" "}— مثل التاريخ: حفظ 30 صفحة وقراءة 750. اجعل الحجم <strong>صفرًا</strong> لإلغاء
          المسار. هذه الأحجام هي أساس التقسيم عند الطالب.
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
          {course.subject && <>{course.subject} · </>}
          {[
            course.has_memo && `حفظ ${unitLabel(memoTotal(course), course.unit)}`,
            course.has_expl && `${course.expl_label} ${unitLabel(explTotal(course), course.unit)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
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
    <form action={saveCourse} className="grid gap-3 sm:grid-cols-6 sm:items-end">
      {course && <input type="hidden" name="id" value={course.id} />}
      <div className="sm:col-span-2">
        <label className="label">اسم المقرر</label>
        <input name="name" className="input" defaultValue={course?.name ?? ""} required />
      </div>
      <div>
        <label className="label">الفن</label>
        <input
          name="subject"
          className="input"
          placeholder="الفقه، اللغة…"
          defaultValue={course?.subject ?? ""}
        />
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
        <label className="label">حجم الحفظ</label>
        <input
          name="memo_total"
          type="number"
          min={0}
          className="input num"
          defaultValue={course ? memoTotal(course) : 100}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">المسار الثاني</label>
          <select name="expl_label" className="input" defaultValue={course?.expl_label ?? "شرح"}>
            <option value="شرح">شرح</option>
            <option value="قراءة">قراءة</option>
          </select>
        </div>
        <div>
          <label className="label">حجمه</label>
          <input
            name="expl_total"
            type="number"
            min={0}
            className="input num"
            defaultValue={course ? explTotal(course) : 100}
            required
          />
        </div>
      </div>
      <div className="sm:col-span-6">
        <button className="btn btn-primary text-sm">{course ? "حفظ التعديل" : "أضف المقرر"}</button>
      </div>
    </form>
  );
}

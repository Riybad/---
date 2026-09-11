import Link from "next/link";
import { deleteCourse, saveCourse, toggleCourse } from "@/app/plan-actions";
import { explTotal, memoTotal, UNITS, unitLabel } from "@/lib/plan";
import { listCourses } from "@/lib/queries";
import type { Course } from "@/lib/plan";
import { TRACKS, type Track, type TrackKey } from "@/lib/tracks";
import ConfirmButton from "@/components/ConfirmButton";
import CourseResources from "@/components/CourseResources";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listCourses(true);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="page-title text-xl">المقررات</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          لكل مسار مقرراته الخاصة، وخطة الطالب لا تُبنى إلا من مقررات مساره. ولكل مقرر مساران
          بحجمين مستقلين: <strong>الحفظ</strong> و<strong>الشرح أو القراءة</strong> — مثل التاريخ:
          حفظ 30 صفحة وقراءة 750. اجعل الحجم <strong>صفرًا</strong> لإلغاء المسار.
        </p>
      </div>

      {TRACKS.map((track) => (
        <TrackSection
          key={track.key}
          track={track}
          courses={courses.filter((c) => c.track === track.key)}
        />
      ))}
    </div>
  );
}

function TrackSection({ track, courses }: { track: Track; courses: Course[] }) {
  return (
    <section className="grid gap-3">
      <div
        className="flex flex-wrap items-baseline gap-2 border-b pb-2"
        style={{ borderColor: `${track.color}55` }}
      >
        <h2 className="text-lg font-bold" style={{ color: track.color }}>
          {track.name}
        </h2>
        <span className="text-xs num" style={{ color: "var(--text-muted)" }}>
          {courses.length} مقرر
        </span>
        <span className="ms-auto text-xs" style={{ color: "var(--text-muted)" }}>
          {track.note}
        </span>
      </div>

      {courses.length === 0 ? (
        <p className="card p-5 text-sm" style={{ color: "var(--text-muted)" }}>
          لا مقررات في هذا المسار بعد — أضف أول مقرر من النموذج بالأسفل، ثم{" "}
          <Link href="/students/new" className="font-semibold underline">
            أضف طلابه
          </Link>
          .
        </p>
      ) : (
        courses.map((c) => <CourseRow key={c.id} course={c} track={track} />)
      )}

      <details className="card p-5">
        <summary className="cursor-pointer font-bold">إضافة مقرر إلى {track.name}</summary>
        <div className="mt-4">
          <CourseForm track={track.key} />
        </div>
      </details>
    </section>
  );
}

function CourseRow({ course, track }: { course: Course; track: Track }) {
  return (
    <div
      className="card p-4"
      style={{ opacity: course.active ? 1 : 0.55, borderInlineStart: `3px solid ${track.color}` }}
    >
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
        <div className="ms-auto flex gap-2">
          <form action={toggleCourse}>
            <input type="hidden" name="id" value={course.id} />
            {course.active ? (
              <ConfirmButton
                message={`سيُخفى «${course.name}» عن الطلاب الجدد.\n\nالخطط المحفوظة لا تتأثر. متابعة؟`}
                className="btn btn-ghost text-xs"
              >
                إيقاف
              </ConfirmButton>
            ) : (
              <button className="btn btn-ghost text-xs">تفعيل</button>
            )}
          </form>
          <form action={deleteCourse}>
            <input type="hidden" name="id" value={course.id} />
            <ConfirmButton
              message={`سيُحذف «${course.name}» نهائيًا.\n\nوإن كان في خطة طالب فسيُوقَف بدل الحذف حتى لا تُمسح خططهم.\n\nمتابعة؟`}
              className="btn btn-ghost text-xs"
            >
              حذف
            </ConfirmButton>
          </form>
        </div>
      </div>
      <div className="mb-3">
        <CourseResources course={course} />
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--accent)" }}>
          تعديل المقرر
        </summary>
        <div className="mt-3">
          <CourseForm course={course} track={(course.track as TrackKey) ?? track.key} />
        </div>
      </details>
    </div>
  );
}

function CourseForm({ course, track }: { course?: Course; track: TrackKey }) {
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
        <label className="label">المسار</label>
        <select name="track" className="input" defaultValue={track}>
          {TRACKS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
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
      <div className="grid grid-cols-2 gap-2 sm:col-span-2">
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
      <div className="sm:col-span-6 mt-1 grid gap-3 rounded-lg border p-3" style={{ borderColor: "var(--hairline)" }}>
        <div className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          الشرح المعتمد — يراه الطالب في صفحة خطته بعد حفظها
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">الشرح (الشارح أو الكتاب)</label>
            <input
              name="sharh_name"
              className="input"
              placeholder="شرح الشيخ فلان"
              defaultValue={course?.sharh_name ?? ""}
            />
          </div>
          <div>
            <label className="label">رابط الشرح القرائي</label>
            <input
              name="sharh_book_url"
              className="input"
              dir="ltr"
              placeholder="https://"
              defaultValue={course?.sharh_book_url ?? ""}
            />
          </div>
          <div>
            <label className="label">رابط الشرح السماعي</label>
            <input
              name="sharh_video_url"
              className="input"
              dir="ltr"
              placeholder="https://"
              defaultValue={course?.sharh_video_url ?? ""}
            />
          </div>
        </div>
      </div>
      <div className="sm:col-span-6">
        <button className="btn btn-primary text-sm">{course ? "حفظ التعديل" : "أضف المقرر"}</button>
      </div>
    </form>
  );
}

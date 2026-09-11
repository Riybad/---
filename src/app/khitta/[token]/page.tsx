import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Brand from "@/components/Brand";
import CopyButton from "@/components/CopyButton";
import PlanTable, { CourseSummary } from "@/components/PlanTable";
import CourseResources, { hasSharh } from "@/components/CourseResources";
import PlanWizard from "@/components/PlanWizard";
import { parseTrack, trackInfo } from "@/lib/tracks";
import type { Cadence } from "@/lib/calendar";
import { getStudentByToken, listCourses, listPlanItems, toPicks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "خطتي السنوية — نخب",
  description: "خطة الطالب السنوية: المقررات موزّعة على السنة بين الحفظ والشرح.",
  openGraph: {
    title: "خطتي السنوية — نخب",
    description: "خطة الطالب السنوية: المقررات موزّعة على السنة بين الحفظ والشرح.",
    images: ["/logo-nokhab.png"],
  },
};

export default async function StudentPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const student = await getStudentByToken(token);
  if (!student) notFound();

  const track = parseTrack(student.track);
  const [courses, trackCourses, items] = await Promise.all([
    listCourses(true),
    listCourses(false, track),
    listPlanItems(student.id),
  ]);
  const picks = toPicks(items);
  const cadence = (student.cadence || "weekly") as Cadence;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const planUrl = `${proto}://${host}/khitta/${token}`;

  // سجّله المشرف ولم يقسّم بعد: هذا الرابط هو مكان تقسيمه
  if (picks.length === 0) {
    return (
      <main className="sunny sunny-bg min-h-screen p-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="card sunny-card mb-4 p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-nokhab.png" alt="شعار نخب" className="mx-auto mb-3 h-16 w-auto" />
            <h1 className="page-title text-xl">خطة {student.name} السنوية</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {trackInfo(track).name}
            </p>
          </div>
          {trackCourses.length === 0 ? (
            <div className="card sunny-card p-8 text-center">
              <p className="text-3xl">📚</p>
              <p className="mt-3 font-bold">لا توجد مقررات متاحة حاليًا</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                راجع المشرف لإضافة المقررات.
              </p>
            </div>
          ) : (
            <div className="card sunny-card p-5">
              <PlanWizard
                courses={trackCourses}
                student={{ name: student.name, phone: student.phone, token }}
              />
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="sunny sunny-bg min-h-screen p-4">
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <div className="card sunny-card p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Brand />
            <div className="ms-auto flex flex-wrap gap-2">
              <a className="btn btn-primary text-sm" href={`/api/export/khitta/${token}`}>
                تحميل الخطة إكسل
              </a>
              <a
                className="btn btn-ghost text-sm"
                href={`/api/export/khitta/${token}?format=table`}
              >
                جدول تفصيلي
              </a>
              <CopyButton text={planUrl} label="نسخ رابط خطتي" />
            </div>
          </div>
          <div className="tamkeen-band mt-5 text-center">
            ✅ خطة {student.name} محفوظة
          </div>
          <p className="mt-3 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            احتفظ برابط هذه الصفحة — ترجع له وقت ما تبي، والمشرف يشوف خطتك في اللوحة.
          </p>
          <p
            className="mt-2 break-all text-center text-xs num"
            style={{ color: "var(--text-muted)" }}
          >
            {planUrl}
          </p>
        </div>

        <div className="card sunny-card p-5">
          <h2 className="mb-1 font-bold">الشروح المعتمدة</h2>
          <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
            لكل مقرر شرحه القرائي (كتاب) والسماعي (مرئيات) — ادرس منها.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {picks.map((p) => {
              const course = courses.find((c) => c.id === p.courseId);
              if (!course) return null;
              return (
                <li
                  key={p.courseId}
                  className="rounded-xl border p-3"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <div className="mb-1 font-bold">{course.name}</div>
                  {hasSharh(course) ? (
                    <CourseResources course={course} />
                  ) : (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      لا شرح معتمد لهذا المقرر.
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card sunny-card p-5">
          <h2 className="mb-3 font-bold">مقررات الخطة</h2>
          <CourseSummary courses={courses} picks={picks} cadence={cadence} />
        </div>

        <div className="card sunny-card">
          <h2 className="p-4 pb-0 font-bold">جدول الخطة</h2>
          <PlanTable courses={courses} picks={picks} cadence={cadence} />
        </div>

        {trackInfo(track).publicSignup && (
          <p className="text-center text-sm">
            <Link href="/khitta" className="underline" style={{ color: "var(--brand-olive)" }}>
              تسجيل خطة طالب آخر
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

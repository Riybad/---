import PlanWizard from "@/components/PlanWizard";
import { SESSIONS, YEAR_SESSIONS_LABEL } from "@/lib/calendar";
import { listCourses } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "خطتي السنوية — طُود" };

export default async function KhittaPage() {
  const courses = await listCourses();

  return (
    <main className="sunny sunny-bg min-h-screen p-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="card sunny-card mb-4 p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nabgh.png" alt="شعار نبغ" className="mx-auto mb-3 h-16 w-auto" />
          <h1 className="page-title text-xl">خطتي السنوية — حفظ وشرح</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {YEAR_SESSIONS_LABEL} — من {SESSIONS[0]?.hijri} إلى {SESSIONS[SESSIONS.length - 1]?.hijri}
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="card sunny-card p-8 text-center">
            <p className="text-3xl">📚</p>
            <p className="mt-3 font-bold">لا توجد مقررات متاحة حاليًا</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              راجع المشرف لإضافة المقررات.
            </p>
          </div>
        ) : (
          <div className="card sunny-card p-5">
            <PlanWizard courses={courses} />
          </div>
        )}
      </div>
    </main>
  );
}
